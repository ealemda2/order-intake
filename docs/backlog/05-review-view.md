# Review view: flagged fields with their source quotes
labels: ready-for-agent

## What to build
The `web/` app shows one row per order from `review.json` (a copy of `.eval/outputs.json`), with flagged fields highlighted next to their source quote and flag message, so a reviewer sees what to check first. See PLAN.md, "Build now" item 5. Stretch.

## Acceptance criteria
- [ ] Orders with flags sort first; abstained fields render as empty, not as "null"
- [ ] `pnpm web` works locally; CI deploys it to GitHub Pages (dev) from main

## Blocked by
- Classify and extract an order's fields with Claude
- Flag fields whose source quote is not grounded in the document
