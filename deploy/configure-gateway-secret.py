"""Read only the gateway token from SSH stdin; patch one key without replacing HR/DB secrets."""
import base64
import json
import re
import subprocess
import sys

token = sys.stdin.read().strip()
if not re.fullmatch(r"[a-f0-9]{64}", token):
    sys.exit("Invalid gateway token format")
patch = json.dumps({"data": {"OTB_GATEWAY_TOKEN": base64.b64encode(token.encode()).decode()}})
result = subprocess.run(["kubectl", "-n", "oneteambooster-preview", "patch", "secret", "otb-runtime", "--type=merge", "--patch-file=/dev/stdin"], input=patch, capture_output=True, text=True)
if result.returncode:
    sys.exit("Gateway Secret update failed; upstream output suppressed")
result = subprocess.run(["kubectl", "-n", "oneteambooster-preview", "get", "secret", "otb-runtime", "-o", "json"], capture_output=True, text=True)
if result.returncode:
    sys.exit("Gateway Secret read-back failed")
data = json.loads(result.stdout)["data"]
if base64.b64decode(data["OTB_GATEWAY_TOKEN"]).decode() != token or not all(key in data for key in ["DATA_API_KEY", "PGPASSWORD"]):
    sys.exit("Gateway Secret verification failed")
print("PASS: gateway token configured; existing HR and database keys retained; no secret values displayed")
