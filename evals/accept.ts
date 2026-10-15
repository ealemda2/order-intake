/**
 * `pnpm eval:accept --reason "why this is the new normal"`
 * HUMAN-ONLY. Promotes .eval/latest.json to evals/baseline.json. The agent is blocked from running this
 * (.claude/hooks/guard.mjs) and CI fails a PR that changes baseline.json without the `baseline-approved` label.
 */
import { execSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Metrics } from "./metrics";

const args = process.argv.slice(2);
const reason = args.includes("--reason") ? args[args.indexOf("--reason") + 1] : undefined;
if (!reason) {
  console.error('usage: pnpm eval:accept --reason "<why this baseline is acceptable>"');
  process.exit(1);
}

const latest = JSON.parse(await readFile(join(import.meta.dirname, "..", ".eval", "latest.json"), "utf8")) as {
  run: { gitSha: string | null; subset: string | null; model: string | null; promptVersion: string | null; dirty: boolean };
  metrics: Metrics;
};

const refuse = (why: string) => {
  console.error(`refusing to accept baseline: ${why}`);
  process.exit(1);
};
if (latest.run.subset) refuse("latest run was a --filter subset");
if (latest.metrics.schemaValidity < 1) refuse("schemaValidity < 1");
if (latest.metrics.silentErrors > 0) refuse(`${latest.metrics.silentErrors} silent errors. A baseline may never contain silent errors.`);

let acceptedBy = "unknown";
try {
  acceptedBy = execSync("git config user.name").toString().trim() || acceptedBy;
} catch {}

const baseline = {
  metrics: latest.metrics,
  acceptedAt: new Date().toISOString(),
  acceptedBy,
  gitSha: latest.run.gitSha,
  model: latest.run.model,
  promptVersion: latest.run.promptVersion,
  reason,
};
await writeFile(join(import.meta.dirname, "baseline.json"), JSON.stringify(baseline, null, 2) + "\n");
console.log(`baseline updated (${latest.run.gitSha}${latest.run.dirty ? ", dirty tree" : ""}). Commit it on a PR labelled baseline-approved.`);
