#!/usr/bin/env bash
# FALLBACK ONLY. The intended path is /to-spec + /to-tickets (see KICKOFF.md), so the issues are written by
# the workflow you're demoing. If that runs long, this creates the same backlog from docs/backlog/*.md.
# File format: line 1 "# Title", line 2 "labels: a,b", rest = body.
set -euo pipefail
cd "$(dirname "$0")/.."
for f in docs/backlog/*.md; do
  title="$(sed -n '1s/^# //p' "$f")"
  labels="$(sed -n '2s/^labels: *//p' "$f")"
  body="$(tail -n +4 "$f")"
  url="$(gh issue create --title "$title" --label "$labels" --body "$body")"
  echo "$(basename "$f") -> $url"
done
