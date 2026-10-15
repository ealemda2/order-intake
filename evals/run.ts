/**
 * `pnpm eval [--filter <substring>] [--json]`
 * Runs the pipeline over the golden set, scores it, compares to evals/baseline.json, applies evals/gates.json.
 * Writes .eval/latest.json, .eval/outputs.json and .eval/report.md. Exit code 1 = a gate failed. HUMAN-OWNED.
 */
import "../src/env";
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { runPipeline } from "../src/pipeline";
import { loadDataset } from "./dataset";
import { checkGates, score, type Finding, type GateResult, type Gates, type Metrics } from "./metrics";

const args = process.argv.slice(2);
const filter = args.includes("--filter") ? args[args.indexOf("--filter") + 1] : undefined;
const jsonOnly = args.includes("--json");
const concurrency = Number(process.env.EVAL_CONCURRENCY ?? 4);
const root = join(import.meta.dirname, "..");
const outDir = join(root, ".eval");

const sh = (cmd: string) => {
  try {
    return execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
};

let docs = await loadDataset();
if (filter) docs = docs.filter((d) => d.id.includes(filter));
if (docs.length === 0) throw new Error(`no golden docs match --filter ${filter}`);

const outputs = new Map<string, unknown>();
const errors: Finding[] = [];
let next = 0;
async function worker() {
  while (next < docs.length) {
    const doc = docs[next++]!;
    try {
      outputs.set(doc.id, await runPipeline({ id: doc.id, text: doc.text }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      outputs.set(doc.id, { error: msg });
      errors.push({ docId: doc.id, kind: "schema_invalid", got: `pipeline threw: ${msg.slice(0, 200)}` });
    }
  }
}
await Promise.all(Array.from({ length: Math.min(concurrency, docs.length) }, worker));

const { metrics, findings } = score(docs, outputs);
const gates = JSON.parse(await readFile(join(import.meta.dirname, "gates.json"), "utf8")) as Gates;
const baselinePath = join(import.meta.dirname, "baseline.json");
const baseline = existsSync(baselinePath)
  ? (JSON.parse(await readFile(baselinePath, "utf8")) as { metrics: Metrics; acceptedAt: string; acceptedBy: string; gitSha: string | null; reason: string })
  : null;
const results = filter ? checkGates(metrics, null, {}) : checkGates(metrics, baseline?.metrics ?? null, gates);
const passed = results.every((r) => r.pass);

const first = [...outputs.values()].find((o): o is { meta: { model: string | null; promptVersion: string | null } } =>
  typeof o === "object" && o !== null && "meta" in o,
);
const run = {
  at: new Date().toISOString(),
  gitSha: sh("git rev-parse --short HEAD"),
  branch: sh("git rev-parse --abbrev-ref HEAD"),
  dirty: (sh("git status --porcelain") ?? "") !== "",
  model: first?.meta.model ?? null,
  promptVersion: first?.meta.promptVersion ?? null,
  subset: filter ?? null,
};

const fmt = (n: number | null, metric: keyof Metrics) =>
  n == null ? "n/a" : metric === "silentErrors" || metric === "meanLatencyMs" ? String(n) : n.toFixed(3);
const fmtDelta = (r: GateResult) =>
  r.delta == null ? "" : `${r.delta > 0 ? "+" : ""}${r.metric === "silentErrors" || r.metric === "meanLatencyMs" ? r.delta : r.delta.toFixed(3)}`;

const table = [
  "| metric | baseline | now | delta | gate | |",
  "|---|---:|---:|---:|---|---|",
  ...results.map(
    (r) =>
      `| ${r.metric} | ${fmt(r.baseline, r.metric)} | ${fmt(r.now, r.metric)} | ${fmtDelta(r)} | ${r.rule} | ${r.rule === "reported" ? "" : r.pass ? "PASS" : "**FAIL**"} |`,
  ),
].join("\n");

const allFindings = [...errors, ...findings];
const priority: Record<string, number> = { silent_error: 0, schema_invalid: 1, missed_invalid: 2, hallucinated: 3, wrong: 4, ungrounded: 5, misclassified: 6, missed: 7 };
allFindings.sort((a, b) => (priority[a.kind] ?? 9) - (priority[b.kind] ?? 9));
const findingRows = allFindings
  .slice(0, 25)
  .map((f) => `| ${f.docId} | ${f.field ?? ""} | ${f.kind} | ${f.expected ?? ""} | ${f.got ?? ""} | ${(f.flags ?? []).join(", ")} |`);

const report = `## Eval evidence ${passed ? "(all gates pass)" : "(GATE FAILED)"}

${filter ? `> Subset run (\`--filter ${filter}\`): gates not applied.\n\n` : ""}${table}

<details><summary>Findings (${allFindings.length}, worst first)</summary>

| doc | field | kind | expected | got | flags |
|---|---|---|---|---|---|
${findingRows.join("\n")}

</details>

Run: \`${run.gitSha}\`${run.dirty ? " (dirty)" : ""} on \`${run.branch}\` · model \`${run.model}\` · prompt \`${run.promptVersion}\` · ${metrics.docs} docs
Baseline: ${baseline ? `\`${baseline.gitSha}\` accepted by ${baseline.acceptedBy} at ${baseline.acceptedAt}: "${baseline.reason}"` : "none"}
`;

await mkdir(outDir, { recursive: true });
await writeFile(join(outDir, "latest.json"), JSON.stringify({ run, passed, metrics, gates: results, findings: allFindings }, null, 2));
await writeFile(join(outDir, "outputs.json"), JSON.stringify(Object.fromEntries(outputs), null, 2));
await writeFile(join(outDir, "report.md"), report);

if (jsonOnly) console.log(JSON.stringify({ passed, metrics, gates: results }, null, 2));
else console.log(report);
process.exit(passed ? 0 : 1);
