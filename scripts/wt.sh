#!/usr/bin/env bash
# Git worktree per ticket, so parallel Claude sessions never share a working tree.
#   bash scripts/wt.sh <issue> [slug]     create ../<repo>-wt/<issue>-<slug> on feat/<issue>-<slug>
#   bash scripts/wt.sh ls                 list worktrees
#   bash scripts/wt.sh rm <issue>         remove the worktree (branch is kept)
set -euo pipefail
ROOT="$(git worktree list --porcelain | head -1 | cut -d' ' -f2-)"   # main checkout, even from a worktree
BASE="$(dirname "$ROOT")/$(basename "$ROOT")-wt"

case "${1:-}" in
  ""|-h|--help) sed -n '2,6p' "$0"; exit 0 ;;
  ls) git -C "$ROOT" worktree list; exit 0 ;;
  rm)
    dir="$(ls -d "$BASE/$2"-* 2>/dev/null | head -1)"
    [ -n "$dir" ] || { echo "no worktree for #$2"; exit 1; }
    git -C "$ROOT" worktree remove "$dir" && echo "removed $dir"; exit 0 ;;
esac

ISSUE="$1"
SLUG="${2:-}"
if [ -z "$SLUG" ]; then
  TITLE="$(gh issue view "$ISSUE" --json title --jq .title 2>/dev/null || echo "issue-$ISSUE")"
  SLUG="$(echo "$TITLE" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-|-$//g' | cut -c1-40 | sed -E 's/-$//')"
fi
BRANCH="feat/$ISSUE-$SLUG"
DIR="$BASE/$ISSUE-$SLUG"

mkdir -p "$BASE"
git -C "$ROOT" fetch -q origin main 2>/dev/null || true
START="$(git -C "$ROOT" rev-parse --verify -q origin/main || git -C "$ROOT" rev-parse main)"
if git -C "$ROOT" show-ref -q --verify "refs/heads/$BRANCH"; then
  git -C "$ROOT" worktree add "$DIR" "$BRANCH"
else
  git -C "$ROOT" worktree add -b "$BRANCH" "$DIR" "$START"
fi
[ -f "$ROOT/.env" ] && cp "$ROOT/.env" "$DIR/.env"
(cd "$DIR" && pnpm install --frozen-lockfile --prefer-offline)

echo
echo "worktree ready: $DIR  (branch $BRANCH)"
echo "start the agent:  cd \"$DIR\" && claude \"/implement #$ISSUE\""
