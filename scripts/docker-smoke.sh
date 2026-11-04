#!/usr/bin/env bash
# Builds the image and checks it against a stand-in backend: the app and its
# deep links, cached assets, /api proxied unbuffered with the forwarded scheme,
# the upload limit, the health check, and no root. Leaves nothing behind.
#   scripts/docker-smoke.sh
set -euo pipefail

image="${IMAGE:-homeflix-web:smoke}"
net="homeflix-web-smoke-$$"
port="${SMOKE_PORT:-18080}"
base="http://127.0.0.1:${port}"

cleanup() {
  docker rm -f "$net-web" "$net-api" >/dev/null 2>&1 || true
  docker network rm "$net" >/dev/null 2>&1 || true
}
trap cleanup EXIT
fail() {
  echo "FAIL: $*" >&2
  docker logs "$net-web" >&2 2>&1 | tail -20 || true
  exit 1
}
check() { echo "ok   $*"; }

docker build -q -t "$image" "$(dirname "$0")/.." >/dev/null
docker network create "$net" >/dev/null

# Stand-in backend: echoes what it saw; /api/v1/stream/ sends three chunks a second apart.
docker run -d --name "$net-api" --network "$net" --network-alias backend python:3.12-alpine python -c '
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
class H(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    def do_GET(self):
        if self.path.startswith("/api/v1/stream/"):
            self.send_response(200); self.send_header("Transfer-Encoding", "chunked"); self.end_headers()
            for i in range(3):
                self.wfile.write(b"6\r\nchunk%d\r\n" % i); self.wfile.flush(); time.sleep(1)
            self.wfile.write(b"0\r\n\r\n"); return
        body = ("saw %s proto=%s" % (self.path, self.headers.get("X-Forwarded-Proto"))).encode()
        self.send_response(200); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_POST(self):
        n = int(self.headers.get("Content-Length", 0)); self.rfile.read(n)
        self.send_response(200); self.send_header("Content-Length", "2"); self.end_headers(); self.wfile.write(b"ok")
    def log_message(self, *a): pass
ThreadingHTTPServer(("0.0.0.0", 8005), H).serve_forever()
' >/dev/null

# The image's default HOMEFLIX_API is http://backend:8005, as in the compose file.
docker run -d --name "$net-web" --network "$net" -p "127.0.0.1:${port}:8080" "$image" >/dev/null
for _ in $(seq 1 30); do curl -fs "$base/healthz" >/dev/null 2>&1 && break; sleep 1; done
curl -fs "$base/healthz" >/dev/null || fail "/healthz does not answer"
check "nginx up, /healthz"

curl -fs "$base/" | grep -q '<div id="root">' || fail "/ is not the app"
curl -fs "$base/browse/movies/42" | grep -q '<div id="root">' || fail "a deep link is not the app"
curl -fsI "$base/" | grep -qi '^cache-control: no-cache' || fail "index.html is cached"
check "app and deep links, index not cached"

asset="$(curl -fs "$base/" | grep -o '/assets/[^"]*\.js' | head -1)"
curl -fsI "$base$asset" | grep -qi 'immutable' || fail "$asset is not cached as immutable"
[ "$(curl -s -o /dev/null -w '%{http_code}' "$base/assets/nope.js")" = 404 ] || fail "a missing asset is not a 404"
check "hashed assets immutable, missing asset 404"

[ "$(curl -fs "$base/api/v1/auth/me")" = "saw /api/v1/auth/me proto=http" ] || fail "/api is not proxied"
[ "$(curl -fs -H 'X-Forwarded-Proto: https' "$base/api/v1/auth/me")" = "saw /api/v1/auth/me proto=https" ] ||
  fail "X-Forwarded-Proto from the TLS proxy is not passed on"
curl -fs "$base/health/ready" | grep -q "saw /health/ready" || fail "/health is not proxied"
check "/api and /health proxied, forwarded scheme kept"

ttfb="$(curl -sN -o /dev/null -w '%{time_starttransfer}' "$base/api/v1/stream/movie/1/master.m3u8")"
awk -v t="$ttfb" 'BEGIN { exit !(t < 0.9) }' || fail "the stream is buffered (first byte after ${ttfb}s)"
check "streams unbuffered (first byte after ${ttfb}s of 3s)"

[ "$(head -c 20000000 /dev/zero | curl -s -o /dev/null -w '%{http_code}' -X POST --data-binary @- "$base/api/v1/x")" = 200 ] ||
  fail "a 20 MB upload is refused"
[ "$(head -c 30000000 /dev/zero | curl -s -o /dev/null -w '%{http_code}' -X POST --data-binary @- "$base/api/v1/x")" = 413 ] ||
  fail "a 30 MB upload is not refused"
check "uploads: 20 MB passes, 30 MB is 413"

[ "$(docker exec "$net-web" id -u)" = 101 ] || fail "nginx runs as root"
check "runs as uid 101"
for _ in $(seq 1 30); do
  [ "$(docker inspect -f '{{.State.Health.Status}}' "$net-web")" = healthy ] && break
  sleep 2
done
[ "$(docker inspect -f '{{.State.Health.Status}}' "$net-web")" = healthy ] || fail "HEALTHCHECK did not turn healthy"
check "HEALTHCHECK healthy"

echo "image: all checks passed"
