"""HTTP checks against temporary containers; no third-party packages needed."""
import json
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

base = sys.argv[1]


def request(path, method="GET", data=None):
    req = Request(base + path, method=method, data=data)
    try:
        response = urlopen(req, timeout=5)
    except HTTPError as error:
        response = error
    with response:
        return response.status, response.headers, response.read()


for attempt in range(30):
    try:
        if request("/healthz")[0] == 200:
            break
    except (URLError, OSError):
        pass
    time.sleep(0.2)
else:
    raise RuntimeError("Frontend did not become ready")

status, headers, html = request("/")
assert status == 200 and b"OneTeam" in html
assert headers["X-Content-Type-Options"] == "nosniff"
resources = re.findall(r'(?:src|href)="([^"#]+)"', html.decode())
for resource in resources:
    if not resource.startswith(("http:", "https:", "//", "data:")):
        status, _, _ = request("/" + resource.lstrip("/"))
        assert status == 200, (resource, status)
for path in ["/AGENTS.md", "/Get-RemotePcCredential.ps1", "/backend/server.js", "/.git/config", "/missing.js"]:
    assert request(path)[0] in (403, 404), path
for attempt in range(30):
    status, _, body = request("/api/system")
    if status == 200:
        break
    time.sleep(0.2)
assert status == 200, (status, body)
system = json.loads(body)
assert system["mode"] == "scaffold" and system["productionReady"] is False
assert all(value is False for value in system["capabilities"].values())
status, _, body = request("/api/leaderboard")
assert status == 503 and json.loads(body)["error"]["code"] == "BACKEND_NOT_CONFIGURED"
assert request("/api/boosters", "POST", b'{"points":999}')[0] == 503
assert request("/healthz", "HEAD")[2] == b""
print("PASS: page, all local assets, API proxy, explicit unavailable APIs and source-file exclusion")
