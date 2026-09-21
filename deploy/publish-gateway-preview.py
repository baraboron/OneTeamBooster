"""Publish already tested local images and atomically update the preview release.

Uses the existing Harbor credential only in a private temporary Docker config.
The gateway caller token must already exist in otb-runtime; no secrets are printed.
"""
import base64
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile

tag, expected_revision = sys.argv[1:]
assert re.fullmatch(r"gateway-[0-9-]+", tag)
assert expected_revision.isdigit()
namespace = "oneteambooster-preview"
registry = "wonix-ops.ips.co.kr/library"
endpoint = "https://uadmxxpoxaukuwwvfdpr.supabase.co/functions/v1/openai-gateway"


def capture(args, **kwargs):
    result = subprocess.run(args, capture_output=True, text=True, **kwargs)
    if result.returncode:
        raise RuntimeError("Command failed: " + args[0])
    return result.stdout


def revision():
    history = json.loads(capture(["helm", "history", "otb", "-n", namespace, "-o", "json"]))
    assert history[-1]["status"] == "deployed", "Release is not ready for an update"
    return str(history[-1]["revision"])


assert revision() == expected_revision, "Deployment changed; inspect before continuing"
secret = json.loads(capture(["kubectl", "-n", namespace, "get", "secret", "otb-runtime", "-o", "json"]))
assert len(base64.b64decode(secret["data"].get("OTB_GATEWAY_TOKEN", ""))) >= 32
assert "OPENAI_API_KEY" not in secret["data"]
secret = None
live_values = json.loads(capture(["helm", "get", "values", "otb", "-n", namespace, "-o", "json"]))
harbor = json.loads(capture(["kubectl", "-n", "jenkins", "get", "secret", "harbor-credentials", "-o", "json"]))
with tempfile.TemporaryDirectory(prefix="otb-gateway-registry-", dir="/dev/shm") as directory:
    config = Path(directory) / "config.json"
    config.write_bytes(base64.b64decode(harbor["data"][".dockerconfigjson"]))
    config.chmod(0o600)
    harbor = None
    overrides = {"backend": {"openaiGatewayUrl": endpoint}}
    for component in ("backend", "frontend"):
        repository = f"{registry}/oneteambooster-{component}"
        image = f"{repository}:{tag}"
        subprocess.run(["docker", "tag", f"oneteambooster/{component}:{tag}", image], check=True)
        subprocess.run(["docker", "--config", directory, "push", image], check=True)
        manifest = json.loads(capture(["docker", "--config", directory, "manifest", "inspect", "--verbose", image]))
        if isinstance(manifest, list):
            # Docker BuildKit includes an attestation descriptor in the OCI index.
            # Pin the actual Linux amd64 image used by the existing preview node.
            manifest = next(item for item in manifest if item["Descriptor"].get("platform", {}).get("os") == "linux" and item["Descriptor"]["platform"].get("architecture") == "amd64")
        digest = manifest["Descriptor"]["digest"]
        assert re.fullmatch(r"sha256:[a-f0-9]{64}", digest)
        overrides.setdefault(component, {})["image"] = {"repository": repository, "tag": tag, "digest": digest, "pullPolicy": "IfNotPresent"}

Path("release-before.json").write_text(json.dumps(live_values))
Path("gateway-image-values.json").write_text(json.dumps(overrides))
chart = "deploy/helm/oneteambooster"
values = ["-f", "release-before.json", "-f", "gateway-image-values.json"]
subprocess.run(["helm", "lint", chart, "--strict", *values], check=True)
rendered = capture(["helm", "template", "otb", chart, "-n", namespace, *values])
capture(["kubectl", "-n", namespace, "apply", "--dry-run=server", "-f", "-"], input=rendered)
assert revision() == expected_revision, "Deployment changed during build; inspect before continuing"
subprocess.run(["helm", "upgrade", "otb", chart, "-n", namespace, *values,
                "--description", f"Supabase OpenAI gateway: {tag}", "--atomic", "--wait", "--timeout", "5m", "--history-max", "15"], check=True)
try:
    script = Path("deploy/verify-ai-gateway.mjs").read_text()
    subprocess.run(["kubectl", "-n", namespace, "exec", "-i", "deployment/otb-oneteambooster-backend", "--", "node", "--input-type=module"], input=script, text=True, check=True)
except Exception:
    subprocess.run(["helm", "rollback", "otb", expected_revision, "-n", namespace, "--wait", "--timeout", "5m"], check=True)
    raise
print(json.dumps({"status": "deployed", "revision": revision(), "images": overrides}, indent=2))
