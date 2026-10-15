import "./env";
import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { runPipeline } from "./pipeline";

// Usage: pnpm intake evals/datasets/orders/01-lab-cmp.txt
const path = process.argv[2];
if (!path) {
  console.error("usage: pnpm intake <path-to-order.txt>");
  process.exit(1);
}
const text = await readFile(path, "utf8");
const result = await runPipeline({ id: basename(path, ".txt"), text });
console.log(JSON.stringify(result, null, 2));
