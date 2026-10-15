---
name: escalate
description: Stop and hand a decision to the human. Use when an eval gate fails, a guard hook blocks a write you think is needed, /code-review returns the same correctness finding twice, you have been corrected twice on the same thing, or you are about to guess on anything clinical (dates of birth, codes, identifiers).
---

# Escalate

Escalation lands on the human, never on another agent. Its job is to make the human's decision fast.

1. Stop editing files.
2. Write `.eval/escalation.md` with exactly these sections, each short:
   - **Trigger**: which rule fired (gate name, hook message, repeated finding).
   - **Evidence**: the gate table from `.eval/report.md` (or the hook/test output), plus the 3 worst findings with doc id, field, expected, got.
   - **Hypothesis**: one paragraph. Cite `file:line` and the commit that most likely caused it (`git log --oneline -5`). Include the LangSmith trace URL if `meta.traceUrl` is set in `.eval/outputs.json`.
   - **Proposed fix**: what you would change, and a proposed new golden case written as a `CASES` entry for `evals/cases.ts`. Do not apply it; that file is human-owned.
   - **Decision needed**: one yes/no question for the human.
3. Get it onto the PR:
   - `gh pr view --json number` to find the PR for this branch. If none, push the branch (`git push -u origin HEAD`) and open a draft: `gh pr create --draft --fill`.
   - `gh pr edit --add-label needs-human`
   - `gh pr comment --body-file .eval/escalation.md`
4. Tell the user in three lines: the trigger, the decision needed, and the PR link. Then stop and wait.

Never remove the `needs-human` label, merge, or accept a baseline. CI keeps a `needs-human` PR red until the human removes the label.
