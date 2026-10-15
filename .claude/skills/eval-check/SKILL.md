---
name: eval-check
description: Run the Order Intake eval suite and compare it to the human-accepted baseline. Use after any change under src/pipeline/ (prompts, extraction, validators, model or route config), before opening or updating a PR, and whenever asked whether a change made the AI better or worse.
---

# Eval check

The eval suite grades the product's AI, not your code. It is deterministic (no LLM judge) and human-owned: `evals/` is write-protected for you.

1. Run `pnpm eval`. It prints a gate table and writes `.eval/report.md`, `.eval/latest.json` (metrics, gate results, findings) and `.eval/outputs.json` (raw pipeline outputs). Exit code 1 means a gate failed.
   - Debugging one document: `pnpm eval --filter <doc-id>` (gates are skipped on subsets, so never use a subset run as evidence).
2. Read the gate table, then the findings in `.eval/latest.json`, worst first. `silent_error` is the one that matters most: a wrong or ungrounded value that carries no Flag (see GLOSSARY.md).
3. **All gates pass**: put the contents of `.eval/report.md` in the PR body's Evidence section (the `pr` skill's shape), with the baseline row visible.
4. **Any gate fails**: stop changing code and use the `escalate` skill, passing it the gate table and the top findings.
   - You may re-run once to rule out model noise. Report both runs; never cherry-pick the better one.
   - Do not edit prompts or code just to make the number pass, retry until lucky, or reword the dataset. The grader must never get easier.
   - A failure the ticket predicted (it says a metric is expected to move) still escalates: moving a baseline is a human decision.
5. Never run `pnpm eval:accept` or edit `evals/baseline.json`. Only the human accepts a new baseline.
