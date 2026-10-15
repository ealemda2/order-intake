import { describe, expect, it } from "vitest";
import { emptyFields, type PipelineResult } from "../src/contract";
import type { GoldenDoc } from "./dataset";
import { checkGates, isGrounded, normalize, score } from "./metrics";

const doc: GoldenDoc = {
  id: "d1",
  text: "FAX 03/14/2026 09:12\nPatient: Grace Okonkwo\nDOB: ____\nNPI: 1389057245\nDate of order: 03/13/2026",
  truth: {
    docId: "d1",
    orderType: "lab",
    fields: {
      patientName: "Grace Okonkwo",
      patientDob: null,
      memberId: null,
      providerName: null,
      providerNpi: "1389057245",
      icd10: null,
      orderCode: null,
      orderDate: "2026-03-13",
    },
    expectedFlags: [],
  },
};

function result(patch: Partial<PipelineResult["fields"]>): PipelineResult {
  return {
    docId: "d1",
    orderType: "lab",
    fields: { ...emptyFields(), ...patch },
    meta: { model: "m", promptVersion: "p1", latencyMs: 10 },
  };
}

describe("normalize", () => {
  it("treats US and ISO dates as equal", () => {
    expect(normalize("orderDate", "03/13/2026")).toBe("2026-03-13");
  });
  it("matches Last, First and strips credentials", () => {
    expect(normalize("patientName", "Okonkwo, Grace")).toBe(normalize("patientName", "Grace Okonkwo"));
    expect(normalize("providerName", "Dr. Selin Aydin, MD")).toBe("selin aydin");
  });
  it("does not 'fix' a malformed ICD-10 code", () => {
    expect(normalize("icd10", "J4590.9")).not.toBe(normalize("icd10", "J45.909"));
  });
});

describe("score", () => {
  it("an all-abstain result has no silent errors", () => {
    const { metrics } = score([doc], new Map([["d1", result({})]]));
    expect(metrics.silentErrors).toBe(0);
    expect(metrics.abstention).toBe(1);
    expect(metrics.fieldAccuracy).toBe(0);
  });

  it("a grounded but wrong DOB with no flag is a silent error", () => {
    const { metrics, findings } = score(
      [doc],
      new Map([["d1", result({ patientDob: { value: "2026-03-14", sourceQuote: "FAX 03/14/2026", flags: [] } })]]),
    );
    expect(metrics.groundingRate).toBe(1);
    expect(metrics.silentErrors).toBe(1);
    expect(findings.some((f) => f.kind === "silent_error" && f.field === "patientDob")).toBe(true);
  });

  it("the same wrong DOB is not silent once it is flagged", () => {
    const { metrics } = score(
      [doc],
      new Map([
        [
          "d1",
          result({
            patientDob: { value: "2026-03-14", sourceQuote: "FAX 03/14/2026", flags: [{ code: "dob_unlabeled", message: "" }] },
          }),
        ],
      ]),
    );
    expect(metrics.silentErrors).toBe(0);
  });

  it("an ungrounded correct value counts against grounding and is silent if unflagged", () => {
    const { metrics } = score(
      [doc],
      new Map([["d1", result({ providerNpi: { value: "1389057245", sourceQuote: "NPI 9999", flags: [] } })]]),
    );
    expect(metrics.groundingRate).toBe(0);
    expect(metrics.silentErrors).toBe(1);
  });

  it("a crashed pipeline output fails schema validity", () => {
    const { metrics } = score([doc], new Map([["d1", { error: "boom" }]]));
    expect(metrics.schemaValidity).toBe(0);
  });
});

describe("checkGates", () => {
  it("fails a drop beyond tolerance and an absolute max", () => {
    const { metrics } = score([doc], new Map([["d1", result({})]]));
    const results = checkGates({ ...metrics, silentErrors: 1 }, { ...metrics, abstention: 1.1 }, {
      abstention: { maxDrop: 0.03 },
      silentErrors: { max: 0 },
    });
    expect(results.find((r) => r.metric === "abstention")?.pass).toBe(false);
    expect(results.find((r) => r.metric === "silentErrors")?.pass).toBe(false);
  });
});

describe("isGrounded", () => {
  it("ignores whitespace and case differences", () => {
    expect(isGrounded("Patient:   Grace\nOkonkwo", "patient: grace okonkwo")).toBe(true);
  });
});
