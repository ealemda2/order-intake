import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { Bundle, FhirResource } from "fhir/r4";
import type { Truth } from "../../evals/dataset";
import { emptyField, emptyFields, FIELD_KEYS, type FieldKey, type PipelineResult } from "../contract";
import { toDraftBundle } from "./fhir";

const ORDERS_DIR = join(import.meta.dirname, "..", "..", "evals", "datasets", "orders");
const RECORDED = new Date("2026-03-14T09:00:00Z");

/** A PipelineResult that read every field of a golden order exactly as its truth file says. */
function goldenResult(docId: string): PipelineResult {
  const truth = JSON.parse(readFileSync(join(ORDERS_DIR, `${docId}.truth.json`), "utf8")) as Truth;
  const fields = emptyFields();
  for (const k of FIELD_KEYS) fields[k] = { value: truth.fields[k], sourceQuote: truth.fields[k], flags: [] };
  return {
    docId,
    orderType: truth.orderType,
    fields,
    meta: { model: "claude-sonnet-5-5", promptVersion: "extract-v1", latencyMs: 1200 },
  };
}

function resource<T extends FhirResource["resourceType"]>(bundle: Bundle, type: T) {
  return bundle.entry?.map((e) => e.resource).find((r) => r?.resourceType === type) as
    | Extract<FhirResource, { resourceType: T }>
    | undefined;
}

describe("toDraftBundle: golden order 01 (lab, every field stated)", () => {
  const bundle = toDraftBundle(goldenResult("01-lab-cmp"), RECORDED);

  it("is a collection bundle", () => {
    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("collection");
  });

  it("maps the patient name, birth date and member ID", () => {
    const patient = resource(bundle, "Patient");
    expect(patient?.name).toEqual([{ text: "Mara Ellison" }]);
    expect(patient?.birthDate).toBe("1961-04-12");
    expect(patient?.identifier?.map((i) => i.value)).toEqual(["BCX448812093"]);
  });

  it("maps the ordering provider with a US NPI identifier", () => {
    const practitioner = resource(bundle, "Practitioner");
    expect(practitioner?.name).toEqual([{ text: "Selin Aydin" }]);
    expect(practitioner?.identifier).toEqual([
      { system: "http://hl7.org/fhir/sid/us-npi", value: "1928374655" },
    ]);
  });

  it("maps the order to a draft ServiceRequest with an ICD-10-CM reason and a CPT code", () => {
    const request = resource(bundle, "ServiceRequest");
    expect(request?.status).toBe("draft");
    expect(request?.intent).toBe("order");
    expect(request?.reasonCode).toEqual([
      { coding: [{ system: "http://hl7.org/fhir/sid/icd-10-cm", code: "E11.9" }] },
    ]);
    expect(request?.code).toEqual({ coding: [{ system: "http://www.ama-assn.org/go/cpt", code: "80053" }] });
    expect(request?.authoredOn).toBe("2026-03-13");
  });

  it("points the ServiceRequest at the bundled Patient and Practitioner", () => {
    const fullUrlOf = (type: string) => bundle.entry?.find((e) => e.resource?.resourceType === type)?.fullUrl;
    const request = resource(bundle, "ServiceRequest");
    expect(fullUrlOf("Patient")).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);
    expect(request?.subject.reference).toBe(fullUrlOf("Patient"));
    expect(request?.requester?.reference).toBe(fullUrlOf("Practitioner"));
  });

  it("records a Provenance naming the model and prompt version that drafted every resource", () => {
    const provenance = resource(bundle, "Provenance");
    expect(provenance?.recorded).toBe("2026-03-14T09:00:00.000Z");
    expect(provenance?.agent[0]?.who.display).toBe("claude-sonnet-5-5");
    expect(provenance?.policy).toEqual(["urn:order-intake:prompt-version:extract-v1"]);
    const others = bundle.entry?.filter((e) => e.resource?.resourceType !== "Provenance");
    expect(provenance?.target.map((t) => t.reference)).toEqual(others?.map((e) => e.fullUrl));
  });
});

describe("toDraftBundle: golden order 10 (referral, self-pay, no procedure code)", () => {
  const bundle = toDraftBundle(goldenResult("10-referral-sleep-fax"), RECORDED);

  it("omits the ServiceRequest code because the order code abstained", () => {
    const request = resource(bundle, "ServiceRequest");
    expect(request).not.toHaveProperty("code");
    expect(request?.reasonCode).toEqual([
      { coding: [{ system: "http://hl7.org/fhir/sid/icd-10-cm", code: "R06.02" }] },
    ]);
    expect(request?.authoredOn).toBe("2026-03-04");
  });

  it("omits the Patient identifier because the member ID abstained", () => {
    const patient = resource(bundle, "Patient");
    expect(patient).not.toHaveProperty("identifier");
    expect(patient?.name).toEqual([{ text: "Marcus Hale" }]);
    expect(patient?.birthDate).toBe("1982-08-14");
  });
});

describe("toDraftBundle: abstained fields are never invented", () => {
  it("drops the Practitioner and the requester when the provider name and NPI both abstained", () => {
    const result = goldenResult("01-lab-cmp");
    result.fields.providerName = emptyField();
    result.fields.providerNpi = emptyField();
    const bundle = toDraftBundle(result, RECORDED);
    expect(resource(bundle, "Practitioner")).toBeUndefined();
    expect(resource(bundle, "ServiceRequest")).not.toHaveProperty("requester");
  });
});

describe("toDraftBundle: order code system", () => {
  it("codes a HCPCS Level II order (golden order 07, walker) with the HCPCS system", () => {
    const bundle = toDraftBundle(goldenResult("07-dme-walker"), RECORDED);
    expect(resource(bundle, "ServiceRequest")?.code).toEqual({
      coding: [{ system: "urn:oid:2.16.840.1.113883.6.285", code: "E0143" }],
    });
  });

  it("keeps a code that is neither CPT- nor HCPCS-shaped as text, without guessing a system", () => {
    const result = goldenResult("01-lab-cmp");
    result.fields.orderCode = { value: "8OO53", sourceQuote: "8OO53", flags: [] };
    const bundle = toDraftBundle(result, RECORDED);
    expect(resource(bundle, "ServiceRequest")?.code).toEqual({ text: "8OO53" });
  });
});

describe("toDraftBundle: flags travel as extensions", () => {
  const FLAG_URL = "https://order-intake.example/fhir/StructureDefinition/review-flag";
  const ungrounded = { code: "ungrounded", message: "source quote not found in the document" };
  const flagExtension = (field: string) => ({
    url: FLAG_URL,
    extension: [
      { url: "field", valueCode: field },
      { url: "code", valueCode: "ungrounded" },
      { url: "message", valueString: "source quote not found in the document" },
    ],
  });

  it("puts a flag on a primitive element's extension (birth date)", () => {
    const result = goldenResult("01-lab-cmp");
    result.fields.patientDob.flags = [ungrounded];
    const patient = resource(toDraftBundle(result, RECORDED), "Patient");
    expect(patient?.birthDate).toBe("1961-04-12");
    expect(patient?._birthDate).toEqual({ extension: [flagExtension("patientDob")] });
  });

  const elementOf: Record<Exclude<FieldKey, "patientDob">, (b: Bundle) => { extension?: unknown } | undefined> = {
    patientName: (b) => resource(b, "Patient")?.name?.[0],
    memberId: (b) => resource(b, "Patient")?.identifier?.[0],
    providerName: (b) => resource(b, "Practitioner")?.name?.[0],
    providerNpi: (b) => resource(b, "Practitioner")?.identifier?.[0],
    icd10: (b) => resource(b, "ServiceRequest")?.reasonCode?.[0],
    orderCode: (b) => resource(b, "ServiceRequest")?.code,
    orderDate: (b) => resource(b, "ServiceRequest")?._authoredOn,
  };

  it.each(Object.keys(elementOf) as (keyof typeof elementOf)[])("puts a %s flag on its element", (key) => {
    const result = goldenResult("01-lab-cmp");
    result.fields[key].flags = [ungrounded];
    const element = elementOf[key](toDraftBundle(result, RECORDED));
    expect(element?.extension).toEqual([flagExtension(key)]);
  });

  it("keeps a flag on an abstained field by putting it on the ServiceRequest", () => {
    const result = goldenResult("10-referral-sleep-fax");
    result.fields.orderCode.flags = [ungrounded];
    const request = resource(toDraftBundle(result, RECORDED), "ServiceRequest");
    expect(request).not.toHaveProperty("code");
    expect(request?.extension).toEqual([flagExtension("orderCode")]);
  });

  it("adds no extensions to an order with no flags", () => {
    const bundle = toDraftBundle(goldenResult("01-lab-cmp"), RECORDED);
    expect(JSON.stringify(bundle)).not.toContain("extension");
  });
});

describe("toDraftBundle: not-an-order (golden order 14, fax cover sheet)", () => {
  it("drafts no resources, because a not-an-order is archived with no extraction", () => {
    const bundle = toDraftBundle(goldenResult("14-not-order-fax-cover"), RECORDED);
    expect(bundle.type).toBe("collection");
    expect(bundle.entry).toEqual([]);
  });
});
