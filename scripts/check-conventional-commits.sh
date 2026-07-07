#!/usr/bin/env bash
# Validate that every commit subject in a range follows Conventional Commits
# (SKILL §5) — the CI counterpart of the local commit-msg hook, so the rule
# holds even for contributors who never ran `pnpm install`.
# Usage: check-conventional-commits.sh <base-ref> <head-ref>
set -euo pipefail

BASE="${1:?base ref required}"
HEAD="${2:-HEAD}"

PATTERN='^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([a-z0-9._/-]+\))?!?: .{1,}$'

fail=0
while IFS= read -r sha; do
  subject="$(git log -1 --format=%s "$sha")"
  case "$subject" in
    Merge*|Revert*|fixup!*|squash!*) continue ;;
  esac
  if ! printf '%s' "$subject" | grep -qE "$PATTERN"; then
    echo "✗ $sha  $subject"
    fail=1
  fi
done < <(git rev-list "$BASE..$HEAD")

if [ "$fail" -ne 0 ]; then
  echo "Some commit messages are not Conventional Commits." >&2
  echo "Expected: type(scope): summary — types: feat fix docs style refactor perf test build ci chore revert" >&2
  exit 1
fi
echo "All commit messages follow Conventional Commits."
