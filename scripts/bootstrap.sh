#!/usr/bin/env bash
# One-time setup: git repo, GitHub repo, labels, secrets, branch protection, prod environment, plugins.
# usage: bash scripts/bootstrap.sh [repo-name]      (VISIBILITY=private to make it private)
set -euo pipefail
cd "$(dirname "$0")/.."

NAME="${1:-order-intake}"
VISIBILITY="${VISIBILITY:-public}"   # public: free branch protection + environments + Pages. Data is synthetic.
say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
warn() { printf '\033[33m! %s\033[0m\n' "$*"; }

for bin in git gh pnpm node; do command -v "$bin" >/dev/null || { echo "missing: $bin"; exit 1; }; done
gh auth status >/dev/null 2>&1 || { echo "run: gh auth login"; exit 1; }

say "1/7 install + sanity check"
pnpm install
pnpm typecheck && pnpm test

say "2/7 git"
[ -d .git ] || git init -b main
if [ -z "$(git log --oneline -1 2>/dev/null)" ]; then
  git add -A
  git commit -q -F - <<'MSG'
chore: scaffold agentic SDLC harness for order intake

Contract, human-owned golden set + deterministic scorer + baseline, guard/typecheck/stop hooks,
eval-check and escalate skills, mattpocock/skills config, CI with eval gate, release with prod approval.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01AU4sJmZvFxC7HQgXsmkskB
MSG
fi

say "3/7 GitHub repo ($VISIBILITY)"
if ! git remote get-url origin >/dev/null 2>&1; then
  gh repo create "$NAME" "--$VISIBILITY" --source . --remote origin --push
else
  git push -u origin main
fi
REPO="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

say "4/7 labels (mattpocock triage roles + harness labels)"
label() { gh label create "$1" --color "$2" --description "$3" --force >/dev/null && echo "  $1"; }
label needs-triage      ededed "Maintainer needs to evaluate this issue"
label needs-info        fbca04 "Waiting on reporter for more information"
label ready-for-agent   0e8a16 "Fully specified, ready for an AFK agent"
label ready-for-human   1d76db "Requires human implementation"
label wontfix           ffffff "Will not be actioned"
label needs-human       b60205 "Escalated by an agent: blocks merge until a human removes it"
label baseline-approved 5319e7 "Human approved a change to the grader, golden set or baseline"
label demo-live         f9d0c4 "Reserved for the live interview demo: do not implement ahead of time"

say "5/7 secrets"
if [ -z "${ANTHROPIC_API_KEY:-}" ] && [ -f .env ]; then set -a; . ./.env; set +a; fi
if [ -n "${ANTHROPIC_API_KEY:-}" ]; then
  gh secret set ANTHROPIC_API_KEY --body "$ANTHROPIC_API_KEY" && echo "  ANTHROPIC_API_KEY set"
else warn "ANTHROPIC_API_KEY not set: CI evals will fail once extraction calls Claude (gh secret set ANTHROPIC_API_KEY)"; fi
if [ -n "${LANGSMITH_API_KEY:-}" ]; then
  gh secret set LANGSMITH_API_KEY --body "$LANGSMITH_API_KEY" && echo "  LANGSMITH_API_KEY set"
else warn "LANGSMITH_API_KEY not set (optional)"; fi

say "6/7 branch protection + prod environment"
gh api -X PUT "repos/$REPO/branches/main/protection" --input - >/dev/null <<'JSON' && echo "  main: PR + green check/eval/guardrails required" || warn "branch protection failed (private repo on a free plan?)"
{ "required_status_checks": { "strict": false, "contexts": ["check", "eval", "guardrails"] },
  "enforce_admins": true, "required_pull_request_reviews": null, "restrictions": null }
JSON
ME_ID="$(gh api user --jq .id)"
printf '{"reviewers":[{"type":"User","id":%s}]}' "$ME_ID" \
  | gh api -X PUT "repos/$REPO/environments/prod" --input - >/dev/null && echo "  prod environment: you are the required reviewer" \
  || warn "prod environment reviewer failed (needs a public repo or a paid plan)"
gh api -X PUT "repos/$REPO/environments/dev" >/dev/null && echo "  dev environment" || true
if [ "$VISIBILITY" = "public" ]; then
  gh api -X POST "repos/$REPO/pages" -f build_type=workflow >/dev/null 2>&1 || true
  gh variable set PAGES_ENABLED --body true >/dev/null && echo "  dev deploy to GitHub Pages enabled"
fi

say "7/7 Claude Code plugins"
if command -v claude >/dev/null; then
  if claude plugin list 2>/dev/null | grep -q "mattpocock-skills@claude-plugins-official"; then
    warn "mattpocock-skills is already installed globally from claude-plugins-official. This repo enables it from the mattpocock marketplace; disable one of them or you'll see every skill twice."
  fi
  claude plugin marketplace add mattpocock/skills >/dev/null 2>&1 || true
  claude plugin install mattpocock-skills@mattpocock --scope project >/dev/null 2>&1 \
    || claude plugin install mattpocock-skills@mattpocock >/dev/null 2>&1 \
    || warn "plugin install via CLI failed: inside Claude run /plugin and install mattpocock-skills"
  echo "  verify inside Claude: /plugin (installed) and type /grill-with-docs (autocomplete)"
else
  warn "claude CLI not found"
fi

say "done: https://github.com/$REPO"
echo "next: open KICKOFF.md"
