# Order Intake

Central intake receives medical orders (lab, imaging, DME, referrals) as faxes and email attachments, and staff re-key the patient, provider and order details by hand before patient matching. Order Intake drafts that work: it reads the text of an inbound order, extracts the eight fields intake needs, each with the **source quote** it came from, flags anything a reviewer should check, and maps the result to a draft **FHIR R4 Bundle**.

A person reviews every order before it goes anywhere. The model drafts, deterministic checks flag, and a human signs off ([ADR 0001](docs/adr/0001-model-drafts-code-flags-human-signs.md)). All data in this repository is synthetic.

```text
inbound order (text layer)
  └─ runPipeline                       src/pipeline/index.ts
       ├─ classify + extract           one Claude call; 8 fields, each with value + source quote, or abstain
       ├─ checks                       deterministic; add flags, never change values
       └─ PipelineResult               src/contract.ts
            ├─ toDraftBundle           draft FHIR R4: Patient, Practitioner, ServiceRequest, Provenance
            └─ review UI               web/: flagged fields with their source quotes
```

**Fields:** patient name, date of birth, member ID, provider name, provider NPI, ICD-10-CM code, order code (CPT/HCPCS), order date. Vocabulary is defined in [GLOSSARY.md](GLOSSARY.md).

## Status

| Capability | State |
|---|---|
| Classify and extract (Claude, structured output) | done |
| Draft FHIR R4 Bundle | done |
| Grounding check (quote must be in the document, value must be in its quote) | in progress |
| LangSmith tracing of model calls | planned |
| NPI check-digit and ICD-10-CM format validation | planned |
| Review UI | placeholder |

Roadmap and scope: [PLAN.md](PLAN.md). Work is tracked in [GitHub Issues](https://github.com/ealemda2/order-intake/issues).

## Getting started

Requires Node 22+ and pnpm 10.

```zsh
pnpm install
cp .env.example .env
```

Set `ANTHROPIC_API_KEY` in `.env`. `LANGSMITH_*` is optional and only used for tracing.

```zsh
pnpm intake evals/datasets/orders/01-lab-cmp.txt
pnpm intake evals/datasets/orders/01-lab-cmp.txt --fhir
pnpm web
```

The first prints the extracted, flagged result as JSON; the second prints the draft FHIR Bundle; the third starts the review UI (it reads `web/public/review.json`, a copy of `.eval/outputs.json`).

## Commands

| Command | What it does |
|---|---|
| `pnpm intake <file> [--fhir]` | Run one order through the pipeline |
| `pnpm test` | Unit tests (no network; the model client is injected) |
| `pnpm typecheck` | Types for the pipeline and the web app |
| `pnpm eval [--filter <doc-id>]` | Score the pipeline on the golden set and compare with the accepted baseline; writes `.eval/` |
| `pnpm eval:accept --reason "..."` | Promote the latest eval run to the baseline (maintainers; refuses if there are silent errors) |
| `pnpm eval:generate` | Regenerate the golden set from `evals/cases.ts` |
| `pnpm web` / `pnpm build:web` | Review UI dev server / production build |

## Source layout

```text
src/
├── contract.ts          PipelineResult, FIELD_KEYS, Flag: the shape everything else depends on
├── cli.ts               pnpm intake
└── pipeline/
    ├── index.ts         runPipeline: the single entry point (CLI and evals call only this)
    ├── extract.ts       classify + extract; schema generated from the contract, reply parsed with zod
    ├── model.ts         ModelClient interface + the Anthropic client
    ├── fhir.ts          toDraftBundle: PipelineResult → draft FHIR R4 Bundle (pure)
    └── prompts/         versioned prompts; PROMPT_VERSION is recorded on every result
web/                     review UI (React + Vite)
evals/                   golden set (15 synthetic orders), scorer, gates, accepted baseline
docs/adr/                architecture decisions
.github/workflows/       CI and release
```

Each pipeline stage is its own module with its own tests. Unit tests never call a real model.

## Quality gates

`pnpm eval` runs `runPipeline` over 15 synthetic orders with known answers and gates on schema validity, classification accuracy, field accuracy, abstention, grounding, invalid-value catch rate and **silent errors**: a wrong value with no flag on it. Silent errors must be zero, because an unflagged wrong field reaches patient matching unnoticed.

The golden set, scorer and baseline are owned by maintainers and changed only through a labelled PR ([ADR 0002](docs/adr/0002-the-grader-is-human-owned.md)).

## CI and deployment

| Trigger | Workflow | Result |
|---|---|---|
| Pull request | `ci.yml` | typecheck, tests and web build; the eval, with results posted as a PR comment; guardrails (`needs-human` label, grader changes without `baseline-approved`) |
| Push to `main` | `ci.yml` | the same checks, then **dev**: the review UI with the latest eval outputs, deployed to [GitHub Pages](https://ealemda2.github.io/order-intake/) |
| Tag `v*` | `release.yml` | **prod**: re-verify, then a GitHub Release with the review UI and the eval report it was graded with, after approval in the `prod` environment |

`main` is protected: changes land by PR with `check`, `eval` and `guardrails` green. CI needs the `ANTHROPIC_API_KEY` secret (and optionally `LANGSMITH_API_KEY`).

To release:
```zsh
git tag v0.1.0 && git push origin v0.1.0
```
Then approve the `prod` deployment in the Actions tab.

## Contributing

- Branch `feat/<issue>-<slug>`, conventional commits, PR into `main`. PR bodies follow `.github/pull_request_template.md`.
- Build test-first; inject the model client in tests.
- Run `pnpm typecheck && pnpm test`, and `pnpm eval` for any change under `src/pipeline/`.
- Copy codes and identifiers verbatim, even when they look wrong: flag them, never correct them.
- `.env` holds API keys and is git-ignored. No real patient data anywhere, including traces.

AI coding agents working in this repo read [CLAUDE.md](CLAUDE.md); project hooks in `.claude/` keep them out of `evals/`, CI and their own settings. `bash scripts/wt.sh <issue>` creates a git worktree per issue for parallel work.

Engineering skills from [mattpocock/skills](https://github.com/mattpocock/skills) (MIT).
