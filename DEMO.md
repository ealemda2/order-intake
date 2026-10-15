# Demo: 20-minute run-of-show

**Thesis:** "I treat the agent like a fast junior engineer. I give it context, a spec and tests, and I watch what it does. An eval gate decides whether its work ships, and anything it's unsure about escalates to me."

**On screen:** tmux (`scripts/tmux-demo.sh <npi#> <icd#>`), a browser with GitHub (Issues, PR, Actions) and the LangSmith project, and this file on a second screen.

| Time | Segment | You do | Skills / harness on screen | You say |
|---|---|---|---|---|
| 0:00 | Picture | README diagram | | The thesis. "Work flows down; the only way back up is escalation, and it lands on me." |
| 1:30 | Context | Open CLAUDE.md, GLOSSARY.md, `docs/agents/`, `.claude/settings.json` | `setup-matt-pocock-skills` output, plugin enabled in project settings | "CLAUDE.md is navigation, not a rulebook. Under 60 lines and one IMPORTANT. The glossary is the shared language from `/grill-with-docs`. Anything that must always happen is a hook." |
| 3:00 | Guardrail | Pane A: `Set evals/baseline.json fieldAccuracy to 1.` | guard hook BLOCKED | "Hooks are deterministic, CLAUDE.md is advisory. The agent can make the product better or worse, but it can never make the test easier." |
| 3:30 | Backlog | GitHub Issues: the spec, the tickets with blocking edges, `demo-live` | `/to-spec`, `/to-tickets` evidence | "Before any code, it interviewed me (grill transcript), wrote the spec and cut tracer-bullet tickets. I didn't `/triage` these because I created them; triage is for issues that arrive raw." |
| 4:30 | **Live feature** | A: `/implement #<npi>`. When `/tdd` asks about seams: "validateNpi as a pure function, plus runPipeline through the eval." B: `/implement #<icd>` | `/implement` → `/tdd` (red → green) → typecheck hook → `/code-review` (two parallel reviewers) | Narrate red before green. Point at the failing test before the code exists. Edit or reject one line yourself. "Two agents, two worktrees, split along a module seam so they can't conflict." |
| 9:00 | Eval moves | A: `pnpm eval` (or let `eval-check` run it) | `eval-check` | "invalidCatchRate goes from 0 to 0.5 on exactly the two bad-NPI orders, and nothing else moves. When B lands, it reaches 1.0." **Behind schedule? `git switch demo/npi-done`.** |
| 10:00 | PR | `create a PR`, then open it on GitHub | `pr` skill (Summary, Evidence, Merge Danger door), CI eval comment | "Humans and agents pass the same gates. The evidence is in the PR, not in the agent's say-so." |
| 11:00 | **Regression** | Open the `demo/regression` PR: CI is red, eval comment shows `silentErrors 3`. Then in a session on that branch: `CI is red on this PR. Diagnose it.` | `/diagnosing-bugs` (loop: `pnpm eval --filter no-dob`), then `escalate` → `needs-human` label + comment | "The commit says 'improve DOB recall'. It looks like a win." Then: "It's fine for the model to be wrong. It's not fine for it to be wrong quietly. Silent errors is the gate." |
| 13:30 | Trace | LangSmith: doc 03, the model quoting `FAX 03/14/2026` as the DOB | app tracing | "Grounding passed, because the quote exists. Grounding proves the quote exists, not that it's the right field. So I'll make the quote prove the field." |
| 14:30 | Fix | You decide: revert the prompt line, and `/tdd` a check that a DOB source quote must contain a DOB label. Remove `needs-human` yourself | the human decision | "The agent proposed a new golden case in its escalation. I add golden cases myself, because the grader is mine (ADR 0002)." |
| 16:00 | Ship | Merge, then show the `release` workflow waiting on `prod` approval | GitHub Environments | "Merge to main deploys dev. Prod is a tagged release that I approve. Prompts and the golden set are versioned with the code, so any release can be reproduced with the dataset it was graded on." |
| 17:00 | Close | Diagram again | | The healthcare bridge (below), routing/Jev in one line, then "what I'd do differently" |

**Cut order if you're late:** the second agent (B) first, then the trace view (the escalation comment covers it), then the release screen. Never cut the regression segment.

## How each skill earns its place

| Skill | Type | When it appears | The line |
|---|---|---|---|
| `/setup-matt-pocock-skills` | Matt, user | Pre-run: `docs/agents/*`, CLAUDE.md block | "One-time config: issues live in GitHub, plus the label vocabulary." |
| `/grill-with-docs` (→ `grilling`, `domain-modeling`) | Matt, user | Pre-run transcript, plus GLOSSARY.md and ADRs | "It interviews me until we share a language. Notice `Source quote` and `Silent error` show up as identifiers in the code." |
| `/to-spec`, `/to-tickets` | Matt, user | The Issues tab | "Vertical slices with real blocking edges, so any unblocked ticket is agent-grabbable." |
| `/implement` → `tdd` → `code-review` | Matt | Live feature | "The reviewer runs in fresh sub-agents (Standards and Spec separately), so it isn't grading its own homework." |
| `pr` | Matt, model | PR body | "Every PR names the door: one-way or two-way, and the blast radius." |
| `/diagnosing-bugs` | Matt, model | Regression | "No theorizing until there's a command that goes red on this bug." |
| `/retro` | Matt, user | "What I'd do differently" | "After each build session it proposes changes to the environment, not the code. Mechanical mistakes become checks." |
| `eval-check` | Custom, model | After every pipeline change | "It wires Matt's generic discipline into my specific gates." |
| `escalate` | Custom, model | Regression | "Escalation is a label and a comment with a yes/no question. CI stays red until I remove it." |
| Hooks: guard, typecheck, stop-gate | Harness | 3:00, and quietly throughout | "Advisory goes in CLAUDE.md. Mandatory goes in hooks." |

Mention, don't run: `/improve-codebase-architecture` ("my refactor source, every few days"), `/wayfinder` ("for foggy multi-session work; this was well-scoped"), `/handoff` and `/prototype`.

## Lines to have ready

- **Healthcare bridge (say it once):** "In production I'd keep exactly this split: the model drafts, deterministic checks flag, and a human signs off. I'd add a BAA-covered model endpoint and keep PHI out of traces. Today everything is synthetic and trace inputs can be masked."
- **Routing / Jev (one line):** "The routing rule is the cheapest rung that passes its eval. Code first, then a bounded-judgment model like Jev for checks such as 'does the document state this DOB?', then Haiku, Sonnet, Opus. A different model family verifying the writer is the next attack on silent errors."
- **Why only 15 golden orders:** "It's enough to make the gates mean something today. Every escalation adds a case, and that's how the set grows."
- **If they redirect you ("add X instead"):** that's the best outcome. Start with `/grill-with-docs` for a single round, then `/implement`. The harness doesn't care which ticket it runs.

## What I'd do differently (pick two, lead with one from `docs/retro.md`)

- **Evals before prompts.** The grader existed before the first prompt, and that's why every change had a number from minute one. I'd go further and write the regression trap cases before building extraction.
- **Hooks over instructions.** Each rule the agent broke twice became a hook or a test (link one real example from today).
- **Two agents, not five.** Split along module seams. More parallelism multiplied cost and merge risk faster than speed.
- **Calibrated verification.** I'd add a second-model or bounded-judgment check per clinical field and measure its calibration on the golden set, instead of trusting self-reported confidence.
- **Treat the harness as product code.** Version it as a plugin with its own tests and changelog, and share it across repos.
- **Honest limit:** CI agents reading issue text are a prompt-injection surface. I'd give them read-only tokens and never let untrusted text trigger writes.
