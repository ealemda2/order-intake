# Coding standards

Read during review (`/code-review` Standards axis), not implementation. Anything mechanical belongs in a hook or test instead.

- **One module per pipeline stage** behind a small interface (classify, extract, ground, validate, map). `runPipeline` composes them; nothing else calls a model.
- **Deterministic before generative.** If a check can be written in code (checksums, formats, date math, substring grounding), it is code, never a prompt instruction.
- **Validators flag, they never mutate.** A validator returns flags for a field; it does not change the value.
- **Every field carries its source quote.** No value enters a result without one.
- **Inject the model client.** Stages take a client parameter so tests use a fake; no network in unit tests.
- **Prompts are files with a version.** No prompt strings inline in TypeScript.
- **Name things with GLOSSARY.md terms.** `flag`, `sourceQuote`, `abstain`, not `warning`, `evidence`, `skip`.
- **zod at the boundary.** Model output is parsed with the contract's schemas before anything else touches it.
