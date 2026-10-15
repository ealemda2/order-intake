/** Writes evals/datasets/orders/<id>.txt + <id>.truth.json from cases.ts. HUMAN-OWNED. */
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CASES } from "./cases";
import { DATASET_DIR, type Truth } from "./dataset";
import { renderCase } from "./render";

await rm(DATASET_DIR, { recursive: true, force: true });
await mkdir(DATASET_DIR, { recursive: true });

for (const c of CASES) {
  const truth: Truth = {
    docId: c.id,
    orderType: c.orderType,
    fields: {
      patientName: c.patientName,
      patientDob: c.patientDob,
      memberId: c.memberId,
      providerName: c.providerName,
      providerNpi: c.providerNpi,
      icd10: c.icd10,
      orderCode: c.orderCode,
      orderDate: c.orderDate,
    },
    expectedFlags: c.expectedFlags ?? [],
    ...(c.notes ? { notes: c.notes } : {}),
  };
  await writeFile(join(DATASET_DIR, `${c.id}.txt`), renderCase(c));
  await writeFile(join(DATASET_DIR, `${c.id}.truth.json`), JSON.stringify(truth, null, 2) + "\n");
}
console.log(`wrote ${CASES.length} golden documents to ${DATASET_DIR}`);
