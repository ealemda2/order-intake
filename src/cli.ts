import "./env";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { runPipeline } from "./pipeline";
import { toDraftBundle } from "./pipeline/fhir";

// Usage: pnpm intake evals/datasets/orders/01-lab-cmp.txt [--fhir]
const args = process.argv.slice(2);
const fhir = args.includes("--fhir");
const path = args.find((a) => !a.startsWith("--"));
if (!path) {
  console.error("usage: pnpm intake <path-to-order.txt> [--fhir]");
  process.exit(1);
}
const text = await readFile(path, "utf8");
const result = await runPipeline({ id: basename(path, ".txt"), text });
console.log(JSON.stringify(fhir ? toDraftBundle(result) : result, null, 2));
