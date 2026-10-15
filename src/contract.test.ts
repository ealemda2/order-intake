import { describe, expect, it } from "vitest";
import { emptyFields, PipelineResult } from "./contract";
import { runPipeline } from "./pipeline";
import type { ModelClient } from "./pipeline/model";

const abstainingClient: ModelClient = {
  model: "fake-model",
  generateJson: async () => ({ orderType: "not_order", fields: emptyFields() }),
};

describe("pipeline seam", () => {
  it("returns a result that satisfies the contract", async () => {
    const result = await runPipeline({ id: "doc-1", text: "Patient: Test Person" }, { client: abstainingClient });
    expect(PipelineResult.safeParse(result).success).toBe(true);
    expect(result.docId).toBe("doc-1");
  });
});
