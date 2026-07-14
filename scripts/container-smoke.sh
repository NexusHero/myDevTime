#!/usr/bin/env bash
# Container smoke test (ADR-0052): black-box HTTP checks against the *built*
# production images running under docker compose — the api (migrate-on-boot +
# NestJS), the web/nginx edge, Postgres and Redis. This is the artifact-parity
# gate: it proves the thing we ship boots, migrates, and serves — not just that
# vitest passes. It assumes the stack is already up (the workflow / caller runs
# `docker compose up -d` first).
#
# Endpoints (see apps/api health controller + apps/mobile/nginx.conf):
#   api  :3000/health        liveness (no I/O)
#   api  :3000/health/ready  readiness — pings the DB (proves migrate-on-boot + DB)
#   web  :8080/              the SPA that nginx serves
#   web  :8080/api/billing/… nginx → api proxy; unauthenticated ⇒ 401 (guard active)
set -euo pipefail

API=${API_URL:-http://localhost:3000}
WEB=${WEB_URL:-http://localhost:8080}

code_of() { curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$1" 2>/dev/null || echo 000; }

# Wait until the api's readiness probe answers 200 — the image booted, migrations
# ran (the CMD is `migrate && main`, so main only starts if migrate succeeded), and
# the DB is reachable. ~120s budget covers the cold image start.
wait_ready() {
  local url="$API/health/ready"
  printf 'Waiting for %s ' "$url"
  for _ in $(seq 1 60); do
    if [ "$(code_of "$url")" = "200" ]; then
      printf ' ready\n'
      return 0
    fi
    printf '.'
    sleep 2
  done
  printf ' TIMEOUT\n'
  return 1
}

# assert <name> <url> <expected-code>
FAILED=0
assert() {
  local name="$1" url="$2" want="$3" got
  got=$(code_of "$url")
  if [ "$got" = "$want" ]; then
    printf '  ✓ %-34s %s → %s\n' "$name" "$url" "$got"
  else
    printf '  ✗ %-34s %s → %s (expected %s)\n' "$name" "$url" "$got" "$want"
    FAILED=1
  fi
}

wait_ready

echo 'Smoke checks:'
assert 'api liveness'      "$API/health"                  200
assert 'api readiness'     "$API/health/ready"            200
assert 'web SPA served'    "$WEB/"                        200
# Edge → backend: nginx proxies /api to the api; the auth guard rejects the
# anonymous request. A 401 proves the whole path (nginx → NestJS → guard) is live.
assert 'edge → api (guard)' "$WEB/api/billing/invoices"   401

if [ "$FAILED" -ne 0 ]; then
  echo 'Container smoke test FAILED' >&2
  exit 1
fi
echo 'Container smoke test passed'
