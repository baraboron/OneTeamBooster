#!/usr/bin/env bash
set -euo pipefail
export PATH="$PWD/tmp/ci/bin:$PATH"
namespace=oneteambooster-preview
# Queued old commits must not replace a newer main commit.
latest="$(git ls-remote origin refs/heads/main | cut -f1)"
if [[ "$latest" != "$GIT_COMMIT" ]]; then
  echo 'main changed during this build; the next poll will deploy the newer commit.'
  exit 1
fi
frontend_digest="$(cat tmp/ci/frontend.digest)"
backend_digest="$(cat tmp/ci/backend.digest)"
[[ "$frontend_digest" =~ ^sha256:[a-f0-9]{64}$ && "$backend_digest" =~ ^sha256:[a-f0-9]{64}$ ]]
previous_revision="$(helm list -n "$namespace" -f '^otb$' -o json | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>process.stdout.write(String(JSON.parse(s)[0]?.revision||"")))')"
helm upgrade --install otb deploy/helm/oneteambooster -n "$namespace" \
  -f deploy/values-preview.yaml -f deploy/values-ci.yaml \
  --set-string frontend.image.tag="$IMAGE_TAG",backend.image.tag="$IMAGE_TAG" \
  --set-string frontend.image.digest="$frontend_digest",backend.image.digest="$backend_digest" \
  --description "Jenkins ${BUILD_NUMBER}: ${GIT_COMMIT}" \
  --atomic --wait --timeout 5m --history-max 10
if ! node deploy/ci/smoke.mjs; then
  if [[ "$previous_revision" =~ ^[0-9]+$ ]]; then
    helm rollback otb "$previous_revision" -n "$namespace" --wait --timeout 5m
  fi
  exit 1
fi
kubectl -n "$namespace" get deployments
