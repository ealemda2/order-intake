#!/usr/bin/env bash
# Stage the debug-and-escalate segment: an innocent-looking prompt change that makes the model fill DOB
# from the wrong date (fax timestamp / order date). Grounding passes (the quote exists), so only the
# silent-error gate catches it.
#   bash scripts/stage-regression.sh [--strong]
# Then verify: git switch demo/regression && pnpm eval   -> expect silentErrors > 0 on 03, 08, 12.
# If the model still abstains, re-run with --strong.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
PROMPT=src/pipeline/prompts/extract.md
[ -f "$PROMPT" ] || { echo "missing $PROMPT: build the extraction ticket first"; exit 1; }

LINE="Every order includes the patient's date of birth. Always return a value for patientDob; do not return null for it."
[ "${1:-}" = "--strong" ] && LINE="$LINE If the date of birth field looks blank, use the most likely date printed near the patient's details."

git switch -C demo/regression main
printf '\n%s\n' "$LINE" >> "$PROMPT"
git add "$PROMPT"
git commit -q -m "feat(extract): improve patientDob recall" -m "Fewer empty DOBs means less work in the review queue."
echo "staged demo/regression. Now: pnpm eval   (expect silentErrors > 0)"
