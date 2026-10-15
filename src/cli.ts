import "./env";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { runPipeline } from "./pipeline";
import { toDraftBundle } from "./pipeline/fhir";

// Usage: pnpm intake evals/datasets/orders/01-lab-cmp.txt [--fhir]
const args = process.argv.slice(2);
const asBundle = args.includes("--fhir");
const path = args.find((a) => !a.startsWith("--"));
if (!path) {
  console.error("usage: pnpm intake <path-to-order.txt> [--fhir]");
  process.exit(1);
}
const text = await readFile(path, "utf8");
const result = await runPipeline({ id: basename(path, ".txt"), text });
console.log(JSON.stringify(asBundle ? toDraftBundle(result, new Date()) : result, null, 2));
