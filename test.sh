#!/usr/bin/env bash
# THE local gate — this is exactly what CI runs (SKILL §5).
# "Did you run the checks?" is never a review question.
set -euo pipefail

run() {
  printf '\n\033[1m▶ %s\033[0m\n' "$1"
  shift
  "$@"
}

# Build the workspace libraries first: apps/api consumes @mydevtime/domain (and
# @mydevtime/shared) through their published `dist` entrypoints, so typecheck,
# type-aware lint, and the tests all need those built before they run.
run "Build packages" pnpm --filter "./packages/*" build
run "Format check"  pnpm format:check
run "Lint"          pnpm lint
run "Typecheck"     pnpm typecheck
run "Tests + coverage" pnpm coverage
run "Domain purity" pnpm check:purity
run "Docs staleness" pnpm check:docs
run "Req coverage"  pnpm check:req-coverage

printf '\n\033[32m✓ local gate passed\033[0m\n'
