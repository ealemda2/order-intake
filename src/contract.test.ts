import { describe, expect, it } from "vitest";
import { PipelineResult } from "./contract";
import { runPipeline } from "./pipeline";

describe("pipeline seam", () => {
  it("returns a result that satisfies the contract", async () => {
    const result = await runPipeline({ id: "doc-1", text: "Patient: Test Person" });
    expect(PipelineResult.safeParse(result).success).toBe(true);
    expect(result.docId).toBe("doc-1");
  });
});
