# Order Intake: roadmap

What we are building, in what order, and what is deliberately out of scope. Vocabulary is in GLOSSARY.md; decisions in docs/adr/.

## Problem

Central intake receives medical orders as faxes and email attachments. Staff re-key patient, provider and order details by hand before patient matching. Re-keying is slow; an AI that fills the fields is fast, but a field that is wrong *quietly* reaches patient matching and becomes a patient-safety problem.

## Solution

`runPipeline(document)` turns the text of one inbound document into a PipelineResult (src/contract.ts):
classify (lab / imaging / DME / referral / not-an-order) → extract eight fields, each with a source quote → deterministic checks add flags → map to a draft FHIR R4 Bundle. The human reviews every order; flags set the priority (ADR 0001).

The scoreboard already exists and is human-owned (ADR 0002): `pnpm eval` runs `runPipeline` over 15 synthetic orders and gates on schema validity, classification accuracy, field accuracy, abstention, grounding and **silent errors (must be 0)**. Today `runPipeline` is a stub that abstains on everything; the baseline reflects that.

## Already done (do not rebuild)

- Contract: `src/contract.ts` (`PipelineResult`, `FIELD_KEYS`, `Flag`).
- Golden set, scorer, gates, baseline, `pnpm eval`, `pnpm eval:accept` (human-only).
- Harness: CLAUDE.md, hooks (guard, typecheck, stop gate), `eval-check` and `escalate` skills, CI, release workflow.
- React shell in `web/`.

## Current milestone

1. **Classify and extract with Claude.** Model `claude-sonnet-5-5`, temperature 0, structured output via a tool whose input schema is generated from the zod contract (`z.toJSONSchema`), parsed back with zod. Prompt lives in `src/pipeline/prompts/extract.md` with an exported `PROMPT_VERSION`. Not-an-order documents skip extraction (all fields abstain). Rules the prompt must state: copy values verbatim (normalise dates to ISO), abstain when the document does not state a field, the source quote is the shortest verbatim span that contains the value. The model client is injected so unit tests use a fake. CLI `pnpm intake <file>` prints the result. Done when `pnpm eval` runs end to end; the human then reviews the numbers and accepts the first real baseline (expect this to escalate: moving the baseline is the human's call).
2. **Grounding check.** A deterministic stage that adds flag `ungrounded` when a field's source quote is not in the document text (whitespace- and case-insensitive), or when the value cannot be found in its own quote (dates compared after normalising both to ISO; names compared token by token so "Kaya, Yusuf" supports "Yusuf Kaya"; codes compared ignoring spaces and hyphens). Validators flag, never mutate. Done when grounding-related findings in `.eval/latest.json` are all flagged.
3. **LangSmith tracing of the app's model calls.** Wrap classify/extract with `traceable` from `langsmith/traceable`; tag runs with `route`, `model`, `promptVersion`; put the run URL in `meta.traceUrl` when available. Respect `LANGSMITH_HIDE_INPUTS=true` (mask document text). No-op when `LANGSMITH_TRACING` is not `true`. Blocked by 1.
4. **Draft FHIR Bundle.** `toDraftBundle(result)` → `fhir4.Bundle` (type `collection`) with Patient (name, birthDate, identifier for member ID), Practitioner (identifier system `http://hl7.org/fhir/sid/us-npi`), ServiceRequest (`status: draft`, `intent: order`, `reasonCode` system `http://hl7.org/fhir/sid/icd-10-cm`, `code` CPT `http://www.ama-assn.org/go/cpt` or HCPCS `urn:oid:2.16.840.1.113883.6.285`), and a Provenance naming the model and prompt version. Abstained fields are omitted, never invented. Flags travel as an extension on the element. Pure function, unit-tested against two golden orders. Not called by the eval. Independent of 1–3 (works on the contract).
5. **Review view (stretch).** `web/` renders `review.json` (a copy of `.eval/outputs.json`): one row per order, flagged fields highlighted with their source quote and flag message. Blocked by 1 and 2.

## Next: code-set validators (#6, #7; not started)

- **NPI check-digit validation.** Flag `npi_invalid` when `providerNpi` fails the NPI check digit (Luhn over the number prefixed with `80840`). Golden orders 06 and 11 carry invalid NPIs; `invalidCatchRate` should rise. Pure function plus one pipeline stage.
- **ICD-10-CM format validation.** Flag `icd10_invalid` when `icd10` does not match the ICD-10-CM shape (letter, digit, alphanumeric, then optional `.` and 1–4 alphanumerics). Golden orders 09 and 12 carry malformed codes. Values are copied verbatim, never corrected.

## Out of scope

OCR and real PDFs (we take the text layer), email ingestion, Postgres, auth, patient matching, the second app, model routing, deploys beyond GitHub Pages (dev) and tagged releases (prod).

## Seams

`runPipeline` is the highest seam and the one the evals use. Below it, test each stage at its own function: `classify`/`extract` with a fake model client, the grounding check and each validator as pure functions, `toDraftBundle` as a pure function.
