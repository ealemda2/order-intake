/** Golden-set file layout and loader. HUMAN-OWNED. */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { FIELD_KEYS, type FieldKey, type OrderType } from "../src/contract";

export const DATASET_DIR = join(import.meta.dirname, "datasets", "orders");

export interface Truth {
  docId: string;
  orderType: OrderType;
  fields: Record<FieldKey, string | null>;
  expectedFlags: FieldKey[];
  notes?: string;
}

export interface GoldenDoc {
  id: string;
  text: string;
  truth: Truth;
}

export async function loadDataset(dir = DATASET_DIR): Promise<GoldenDoc[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".txt")).sort();
  return Promise.all(
    files.map(async (f) => {
      const id = f.replace(/\.txt$/, "");
      const text = await readFile(join(dir, f), "utf8");
      const truth = JSON.parse(await readFile(join(dir, `${id}.truth.json`), "utf8")) as Truth;
      for (const k of FIELD_KEYS) if (!(k in truth.fields)) throw new Error(`${id}: truth missing ${k}`);
      return { id, text, truth };
    }),
  );
}
