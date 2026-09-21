#!/usr/bin/env bash
# Run from any directory on a Linux host with Docker, Helm 3, Python 3 and optional kubectl.
# Builds images and temporary loopback-only containers; never installs a Helm release.
set -euo pipefail
cd "$(dirname "$0")/.."
image_tag="${IMAGE_TAG:-prep-20260918}"
chart=deploy/helm/oneteambooster
work_dir="$(mktemp -d)"
network_id=''
backend_id=''
frontend_id=''
cleanup() {
  if [[ -n "$frontend_id" ]]; then docker rm -f "$frontend_id" >/dev/null; fi
  if [[ -n "$backend_id" ]]; then docker rm -f "$backend_id" >/dev/null; fi
  if [[ -n "$network_id" ]]; then docker network rm "$network_id" >/dev/null; fi
  # Only remove the directory created by this invocation of mktemp.
  rm -rf -- "$work_dir"
}
trap cleanup EXIT

helm lint "$chart" --strict --kube-version 1.34.5
helm lint "$chart" --strict --kube-version 1.34.5 -f deploy/values-k3s.example.yaml
helm template otb "$chart" --namespace default --kube-version 1.34.5 > "$work_dir/default.yaml"
helm template otb "$chart" --show-only templates/configmap.yaml > "$work_dir/configmap.yaml"
python3 - "$work_dir/configmap.yaml" "$work_dir/default.conf" <<'PY'
import pathlib, sys, textwrap
config = pathlib.Path(sys.argv[1]).read_text().split('  default.conf: |\n', 1)[1]
config = textwrap.dedent(config)
assert 'proxy_pass http://otb-oneteambooster-backend:3000;' in config
pathlib.Path(sys.argv[2]).write_text(config)
PY
# Nginx runs as UID 101 and must be able to read the bind-mounted file.
chmod 644 "$work_dir/default.conf"
helm template otb "$chart" --namespace default --kube-version 1.34.5 \
  -f deploy/values-k3s.example.yaml --set ingress.enabled=true \
  --set ingress.host=otb.validation.invalid --set ingress.tlsSecretName=otb-test-tls > "$work_dir/ingress.yaml"
if helm template otb "$chart" --set ingress.enabled=true > /dev/null 2>&1; then
  echo 'FAIL: ingress accepted an empty hostname' >&2
  exit 1
fi
if [[ "${VALIDATE_CLUSTER:-0}" == 1 ]]; then
  # Existing namespace is used for API validation only. No resources are persisted.
  kubectl --namespace default apply --dry-run=server -f "$work_dir/default.yaml"
  kubectl --namespace default apply --dry-run=server -f "$work_dir/ingress.yaml"
fi

docker build -f deploy/backend.Dockerfile -t "oneteambooster/backend:$image_tag" .
docker build -f deploy/frontend.Dockerfile -t "oneteambooster/frontend:$image_tag" .
docker run --rm --network none --read-only --cap-drop ALL --security-opt no-new-privileges \
  "oneteambooster/backend:$image_tag" npm test

network_id="$(docker network create "otb-verify-$(date +%s)-$$")"
backend_id="$(docker run -d --network "$network_id" --network-alias otb-oneteambooster-backend \
  --user 1000:1000 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --cap-drop ALL --security-opt no-new-privileges --memory 256m --cpus 0.5 \
  "oneteambooster/backend:$image_tag")"
frontend_id="$(docker run -d --network "$network_id" -p 127.0.0.1::8080 \
  --mount "type=bind,src=$work_dir/default.conf,dst=/etc/nginx/conf.d/default.conf,readonly" \
  --user 101:101 --read-only --tmpfs /tmp:rw,noexec,nosuid,size=64m \
  --cap-drop ALL --security-opt no-new-privileges --memory 128m --cpus 0.25 \
  "oneteambooster/frontend:$image_tag")"
endpoint="$(docker port "$frontend_id" 8080/tcp)"
python3 deploy/smoke.py "http://$endpoint"
docker exec "$frontend_id" nginx -t
docker exec "$backend_id" node --version
echo 'PASS: Helm checks, image builds, backend tests and frontend-to-backend HTTP smoke checks.'
