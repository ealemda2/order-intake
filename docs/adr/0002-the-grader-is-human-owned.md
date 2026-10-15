# The grader is human-owned

`evals/` (golden set, scorer, gates, baseline) is write-blocked for agents by a PreToolUse hook, `pnpm eval:accept` is blocked for agents, and CI fails any PR that changes `evals/baseline.json` without the `baseline-approved` label. Agents can make the product better or worse, but never make the test easier. The cost is that the human adds every new golden case by hand, which is deliberate: each escalation that ends in a new case is a human judgement about what "correct" means.
