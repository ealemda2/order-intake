import { describe, expect, it } from "vitest";
import { FIELD_KEYS, PipelineResult } from "../contract";
import { runPipeline } from ".";
import type { ModelClient } from "./model";
import { PROMPT_VERSION } from "./prompts";

const abstainAll = {
  orderType: "not_order",
  fields: Object.fromEntries(FIELD_KEYS.map((k) => [k, { value: null, sourceQuote: null }])),
};

const fakeClient = (output: unknown): ModelClient => ({ model: "fake-model", generateJson: async () => output });

describe("runPipeline", () => {
  it("returns a contract-valid result stamped with the model and prompt version", async () => {
    const result = await runPipeline({ id: "15-flu", text: "Flu shots are here!" }, { client: fakeClient(abstainAll) });

    expect(PipelineResult.safeParse(result).success).toBe(true);
    expect(result.docId).toBe("15-flu");
    expect(result.orderType).toBe("not_order");
    expect(result.meta.model).toBe("fake-model");
    expect(result.meta.promptVersion).toBe(PROMPT_VERSION);
    expect(result.meta.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("flags an extracted field whose source quote is not in the document", async () => {
    const order = { id: "lab", text: "LABORATORY ORDER\nPatient: Mara Ellison\nNPI: 1928374655" };
    const extraction = {
      orderType: "lab",
      fields: {
        ...abstainAll.fields,
        patientName: { value: "Mara Ellison", sourceQuote: "Mara Ellison" },
        providerNpi: { value: "1928374656", sourceQuote: "NPI: 1928374656" },
      },
    };

    const result = await runPipeline(order, { client: fakeClient(extraction) });

    expect(result.fields.patientName.flags).toEqual([]);
    expect(result.fields.providerNpi.flags.map((f) => f.code)).toEqual(["ungrounded"]);
  });
});
