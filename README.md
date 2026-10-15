# Order Intake

Inbound medical order (text layer) → classified, extracted, **flagged** fields with source quotes → draft FHIR R4 Bundle → human review. All data is synthetic.

Built as an agentic-SDLC demo. AI proposes, deterministic checks verify, a human approves.

```
  YOU ─────────── spec, seams, diff review, baseline + merge + prod approval ───────────┐
   │                                                                                     ▲
   ▼                                                                                     │ escalate
  CONTEXT     CLAUDE.md (navigation) · GLOSSARY.md (shared language) · ADRs · PLAN.md    │ (needs-human
   │          skills: mattpocock/skills (grill → spec → tickets → implement → tdd →      │  label + a
   │          code-review → pr → retro) + eval-check + escalate                          │  yes/no question)
   ▼                                                                                     │
  AGENTS      Claude Code ×2 in git worktrees (scripts/wt.sh, scripts/tmux-demo.sh)      │
   │                                                                                     │
   ▼                                                                                     │
  GATES       hooks: guard (grader + guardrails write-blocked) · typecheck · stop-gate  ─┤
   │          pnpm eval: schema · accuracy · abstention · grounding · SILENT ERRORS = 0 ─┤
   ▼                                                                                     │
  CI/CD       GitHub Actions: check → eval (PR comment) → guardrails │ main → dev (Pages)│
              tag → release, waiting on the `prod` environment reviewer ─────────────────┘
  TRACES      LangSmith: every model call tagged with route / model / prompt version
```

## Start here

1. **KICKOFF.md**: setup and the 4-hour build, with exact prompts.
2. **DEMO.md**: the 20-minute run-of-show and how each skill shows up.
3. **PLAN.md**: what is being built and what is deliberately out of scope.

## Commands

| | |
|---|---|
| `pnpm test` / `pnpm typecheck` | unit tests / types (root + web) |
| `pnpm eval [--filter id]` | golden-set eval with gates vs baseline; writes `.eval/` |
| `pnpm eval:accept --reason "..."` | **human only**: promote the latest run to the baseline (refuses if there are silent errors) |
| `pnpm eval:generate` | regenerate the golden set from `evals/cases.ts` |
| `pnpm intake <file>` | run one document through the pipeline |
| `bash scripts/wt.sh <issue>` | worktree + branch per ticket |
| `bash scripts/tmux-demo.sh <a> <b>` | two-agent screen-share layout |

## Maintenance sessions

The guard hook blocks agents from editing `evals/`, CI, hooks and settings. To let Claude edit the harness itself, start it with `HARNESS_UNLOCK=1 claude`, and say so in the PR.

Credits: engineering skills from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT), installed as a Claude Code plugin.
