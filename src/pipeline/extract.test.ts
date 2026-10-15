import { describe, expect, it } from "vitest";
import { FIELD_KEYS } from "../contract";
import { extract } from "./extract";
import type { JsonRequest, ModelClient } from "./model";

const LAB_ORDER = `LABORATORY ORDER
Patient: Mara Ellison
DOB: 04/12/1961          Member ID: BCX448812093
Ordering provider: Selin Aydin, MD     NPI: 1928374655
Ordered: 80053  Comprehensive metabolic panel
Diagnosis: E11.9
Date of order: 03/13/2026`;

const field = (value: string | null, sourceQuote: string | null = value) => ({ value, sourceQuote });

const labOutput = {
  orderType: "lab",
  fields: {
    patientName: field("Mara Ellison"),
    patientDob: field("1961-04-12", "04/12/1961"),
    memberId: field("BCX448812093"),
    providerName: field("Selin Aydin", "Selin Aydin, MD"),
    providerNpi: field("1928374655"),
    icd10: field("E11.9"),
    orderCode: field("80053"),
    orderDate: field("2026-03-13", "03/13/2026"),
  },
};

function fakeClient(output: unknown): ModelClient & { requests: JsonRequest[] } {
  const requests: JsonRequest[] = [];
  return {
    model: "fake-model",
    requests,
    async generateJson(req) {
      requests.push(req);
      return output;
    },
  };
}

describe("extract", () => {
  it("classifies the order and returns each field with its source quote and no flags", async () => {
    const result = await extract({ id: "01", text: LAB_ORDER }, fakeClient(labOutput));

    expect(result.orderType).toBe("lab");
    expect(result.fields.patientDob).toEqual({ value: "1961-04-12", sourceQuote: "04/12/1961", flags: [] });
    expect(result.fields.providerName).toEqual({ value: "Selin Aydin", sourceQuote: "Selin Aydin, MD", flags: [] });
  });

  it("abstains on every field of a not-an-order document, even if the model returned values", async () => {
    const coverSheet = { ...labOutput, orderType: "not_order" };
    const result = await extract({ id: "14", text: "FAX COVER SHEET\nPatient: Mara Ellison" }, fakeClient(coverSheet));

    expect(result.orderType).toBe("not_order");
    for (const k of FIELD_KEYS) expect(result.fields[k]).toEqual({ value: null, sourceQuote: null, flags: [] });
  });

  it("throws a clear error naming the document when the model output does not match the contract", async () => {
    const missingField = { orderType: "lab", fields: { ...labOutput.fields, icd10: undefined } };

    await expect(extract({ id: "01-lab-cmp", text: LAB_ORDER }, fakeClient(missingField))).rejects.toThrow(
      /01-lab-cmp.*fake-model.*fields\.icd10/s,
    );
  });
});
