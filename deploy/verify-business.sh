#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
image_tag="${IMAGE_TAG:-preview-20260918-v2}"
postgres_image='postgres:17-alpine@sha256:f02121de6f74d30d8a94cd1d9584125e2178d7e6c377d8130112d4e52d867995'
work_dir="$(mktemp -d)"; network_id=''; database_id=''
cleanup(){
  if [[ -n "$database_id" ]]; then docker rm -f "$database_id" >/dev/null; fi
  if [[ -n "$network_id" ]]; then docker network rm "$network_id" >/dev/null; fi
  rm -rf -- "$work_dir"
}
trap cleanup EXIT
umask 077
python3 - "$work_dir" <<'PY'
import pathlib,secrets,sys
folder=pathlib.Path(sys.argv[1]); password=secrets.token_hex(32)
(folder/'db.env').write_text('POSTGRES_USER=otb\nPOSTGRES_DB=otb_test\nPOSTGRES_PASSWORD='+password+'\n')
(folder/'test.env').write_text('TEST_DATABASE_URL=postgresql://otb:'+password+'@test-db:5432/otb_test\n')
PY
network_id="$(docker network create "otb-business-$(date +%s)-$$")"
database_id="$(docker run -d --network "$network_id" --network-alias test-db --env-file "$work_dir/db.env" --tmpfs /var/lib/postgresql/data:rw,size=256m "$postgres_image")"
for attempt in $(seq 1 60); do
  if docker exec "$database_id" pg_isready -U otb -d otb_test >/dev/null 2>&1; then break; fi
  sleep 0.5
done
docker run --rm --network "$network_id" --env-file "$work_dir/test.env" \
  --read-only --cap-drop ALL --security-opt no-new-privileges \
  "oneteambooster/backend:$image_tag" node --test integration.test.js
