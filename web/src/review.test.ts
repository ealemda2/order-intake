import { describe, expect, it } from "vitest";
import { emptyFields, type ExtractedFields, type PipelineResult } from "../../src/contract";
import { toReviewRows } from "./review";

const result = (docId: string, patch: Partial<ExtractedFields> = {}): PipelineResult => ({
  docId,
  orderType: "lab",
  fields: { ...emptyFields(), ...patch },
  meta: { model: "claude-sonnet-5-5", promptVersion: "extract-v3", latencyMs: 10 },
});

describe("toReviewRows", () => {
  it("renders an abstained field as empty, not as null", () => {
    const [row] = toReviewRows({ "01": result("01") });

    const dob = row!.fields.find((f) => f.key === "patientDob")!;
    expect(dob.value).toBe("");
    expect(dob.sourceQuote).toBe("");
  });

  it("sorts orders with at least one flag before clean orders", () => {
    const ungrounded = { code: "ungrounded", message: "Source quote not found in the document" };
    const rows = toReviewRows({
      "01": result("01"),
      "02": result("02", { providerNpi: { value: "1928374656", sourceQuote: "NPI: 1928374656", flags: [ungrounded] } }),
      "03": result("03"),
      "04": result("04", { memberId: { value: "CIG-1", sourceQuote: null, flags: [ungrounded] } }),
    });

    expect(rows.map((r) => r.docId)).toEqual(["02", "04", "01", "03"]);
    expect(rows.map((r) => r.flagCount)).toEqual([1, 1, 0, 0]);
  });

  it("puts an order the pipeline failed on first, with its error", () => {
    const ungrounded = { code: "ungrounded", message: "Source quote not found in the document" };
    const rows = toReviewRows({
      "01": result("01", { icd10: { value: "E11.9", sourceQuote: "Dx E11.9", flags: [ungrounded] } }),
      "02": { error: "pipeline threw: timeout" },
    });

    expect(rows.map((r) => [r.docId, r.error, r.orderType])).toEqual([
      ["02", "pipeline threw: timeout", null],
      ["01", null, "lab"],
    ]);
  });
});
