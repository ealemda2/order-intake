# Kickoff: the next 4 hours

Every step below uses the same workflow you'll demo, so the git history, issues, PRs and traces it leaves behind become your evidence. Times are Istanbul time. Prompts are in code blocks; paste them as is.

## 0. Setup (15 min, by 16:00)

```bash
cp .env.example .env            # fill ANTHROPIC_API_KEY, LANGSMITH_API_KEY
bash scripts/bootstrap.sh order-intake    # git, GitHub repo, labels, secrets, branch protection, prod env, plugin
claude                          # trust the folder; accept the mattpocock marketplace/plugin prompt
```

Inside Claude, check these before you build anything:
- `/plugin` lists `mattpocock-skills` (once). Typing `/grill` autocompletes `/grill-with-docs`.
- `/context` shows CLAUDE.md and GLOSSARY.md loaded and small.
- Guard hook works:
  ```
  Set evals/baseline.json fieldAccuracy to 1.
  ```
  Expect `BLOCKED by guard hook`. That's also your 15-second demo moment.

`/setup-matt-pocock-skills` has already been done for you: `docs/agents/*.md` and the `## Agent skills` block in CLAUDE.md are what it writes. Re-run it only if you want to change the defaults.

## 1. Plan into GitHub Issues (20 min, main checkout, one session)

Keep these three steps in one context window. That's Matt's rule: don't `/clear` until the tickets exist.

```
/grill-with-docs Read PLAN.md, CLAUDE.md and src/contract.ts. Grill me on the open decisions for the "Build now" items only, one round, at most 5 questions. Record any resolved terms in GLOSSARY.md and any real trade-off as an ADR.
```
Answer quickly. Accept the recommendations unless one is wrong. **Save this transcript**: it's your "the agent interviewed me before writing code" evidence.

```
/to-spec Synthesize PLAN.md plus what we just settled. One spec covering "Build now" items 1-5.
```
It will ask you to confirm the seams. The answer is in PLAN.md: `runPipeline` on top, each stage at its own function.

```
/to-tickets Split the spec into tracer-bullet tickets with native GitHub blocking edges. Then also create the two "Reserved for the live demo" items from PLAN.md as tickets labelled demo-live (not ready-for-agent).
```

**If this overruns 16:20:** `bash scripts/seed-issues.sh` creates the same backlog from `docs/backlog/`. Then `/clear`.

## 2. Build in parallel worktrees (16:20 to 18:00)

Extraction and FHIR mapping have no blockers between them, so start both:

```bash
bash scripts/tmux-demo.sh <extract-issue#> <fhir-issue#>
```

Left pane (A), then right pane (B):
```
/implement #<extract-issue#>
```
```
/implement #<fhir-issue#>
```

Your job while they run, which is also the job you're demoing:
- When `/tdd` asks which seams to test, answer it. Don't let it guess.
- Read every diff before it commits. Correct the agent at most twice; after that, `/clear` and rewrite the prompt.
- When a session finishes: `create a PR for this branch` (the `pr` skill shapes the body), check CI, and **merge it yourself**. Agents are blocked from merging.

**After extraction merges: accept the first real baseline (human-only).** This is a real decision, so make it on purpose:
```bash
git switch -c chore/baseline-v1 && pnpm eval      # read the table AND the findings
pnpm eval:accept --reason "first real extraction run: <one line on what you checked>"
git commit -am "chore(evals): accept baseline v1" && git push -u origin HEAD
gh pr create --fill --label baseline-approved
```
If `silentErrors > 0`, `eval:accept` refuses. Fix the prompt first. That refusal is a talking point.

Then reuse both panes for **grounding** and **tracing** (`bash scripts/wt.sh <n>`). Do the review view only if you're ahead at 17:40.

Before you close the build sessions, run this in one of them:
```
/retro
```
Save its output to `docs/retro.md`. It's the raw material for "what would you do differently", and it's real.

## 3. Stage the demo (18:00 to 18:30)

```bash
git switch main && git pull
git branch demo/npi-start && git push -u origin demo/npi-start        # the start point for the live feature
```
- **Rehearsal checkpoint:** `bash scripts/wt.sh <npi-issue#>` → `/implement #<npi-issue#>` → `git push origin HEAD:demo/npi-done`, then `bash scripts/wt.sh rm <npi-issue#> && git branch -D <its feat/ branch>` so the live run starts clean. Don't merge it, so the live run stays live. Time it. Do the same dry run for ICD-10 if you have time. If it takes more than 6 minutes, plan to cut over to the checkpoint on stage.
- **Regression:** `bash scripts/stage-regression.sh`, then `pnpm eval`. You need `silentErrors > 0` on 03, 08 and 12. If that doesn't happen, use `--strong`. Push the branch and open a PR (`gh pr create --fill`) so CI posts the red eval comment ahead of time.
- **LangSmith:** open the project and find doc 03's trace on the regression run (the model quoting the fax timestamp as the DOB).
- Close the PRs you don't want on screen. Turn notifications off. Set the terminal font to 18pt or larger.

## 4. Rehearse twice and record once (18:30 to 19:15)

Follow DEMO.md with a timer. Record one full run as your fallback video.
