import { createHash } from "node:crypto";
import type {
  Bundle,
  CodeableConcept,
  Element,
  Extension,
  FhirResource,
  Patient,
  Practitioner,
  Provenance,
  ServiceRequest,
} from "fhir/r4";
import { FIELD_KEYS, type FieldKey, type Flag, type PipelineResult } from "../contract";

/** Complex extension carrying one Flag: sub-extensions `field`, `code` and `message`. */
const REVIEW_FLAG_URL = "https://order-intake.example/fhir/StructureDefinition/review-flag";
const NPI_SYSTEM = "http://hl7.org/fhir/sid/us-npi";
const ICD10CM_SYSTEM = "http://hl7.org/fhir/sid/icd-10-cm";
const CPT_SYSTEM = "http://www.ama-assn.org/go/cpt";
const HCPCS_SYSTEM = "urn:oid:2.16.840.1.113883.6.285";
/** CPT: five digits, or four digits and a Category II/III/PLA letter. */
const CPT_SHAPE = /^\d{4}[\dFTU]$/;
/** HCPCS Level II: a letter A-V and four digits. */
const HCPCS_SHAPE = /^[A-V]\d{4}$/;

/**
 * Map a PipelineResult to a draft FHIR R4 Bundle for human review.
 * Pure: the same result and `recorded` time always give the same bundle.
 */
export function toDraftBundle(result: PipelineResult, recorded: Date): Bundle {
  // A Not-an-order is archived with no extraction (GLOSSARY.md): there is nothing to draft.
  if (result.orderType === "not_order") return { resourceType: "Bundle", type: "collection", entry: [] };

  const { fields } = result;
  const urlOf = (type: FhirResource["resourceType"]) => entryUrl(result.docId, type);
  /** `{ extension }` carrying the field's flags, or `{}` when it has none. */
  const flagsOf = (key: FieldKey): { extension?: Extension[] } =>
    fields[key].flags.length === 0 ? {} : { extension: fields[key].flags.map((f) => flagExtension(key, f)) };
  /** The `_element` sibling of a primitive: its flags, or `undefined` so no empty element is written. */
  const primitiveFlagsOf = (key: FieldKey): Element | undefined =>
    fields[key].flags.length === 0 ? undefined : flagsOf(key);

  const { patientName, patientDob, memberId, providerName, providerNpi, icd10, orderCode, orderDate } = fields;

  const patient: Patient = { resourceType: "Patient" };
  if (patientName.value !== null) patient.name = [{ text: patientName.value, ...flagsOf("patientName") }];
  if (patientDob.value !== null) {
    patient.birthDate = patientDob.value;
    const flags = primitiveFlagsOf("patientDob");
    if (flags) patient._birthDate = flags;
  }
  if (memberId.value !== null) patient.identifier = [{ value: memberId.value, ...flagsOf("memberId") }];

  const practitioner: Practitioner = { resourceType: "Practitioner" };
  if (providerName.value !== null) practitioner.name = [{ text: providerName.value, ...flagsOf("providerName") }];
  if (providerNpi.value !== null) {
    practitioner.identifier = [{ system: NPI_SYSTEM, value: providerNpi.value, ...flagsOf("providerNpi") }];
  }

  const request: ServiceRequest = {
    resourceType: "ServiceRequest",
    status: "draft",
    intent: "order",
    subject: { reference: urlOf("Patient") },
  };
  const hasProvider = providerName.value !== null || providerNpi.value !== null;
  if (hasProvider) request.requester = { reference: urlOf("Practitioner") };
  if (icd10.value !== null) {
    request.reasonCode = [{ coding: [{ system: ICD10CM_SYSTEM, code: icd10.value }], ...flagsOf("icd10") }];
  }
  if (orderCode.value !== null) request.code = { ...codeFor(orderCode.value), ...flagsOf("orderCode") };
  if (orderDate.value !== null) {
    request.authoredOn = orderDate.value;
    const flags = primitiveFlagsOf("orderDate");
    if (flags) request._authoredOn = flags;
  }
  // An abstained field has no element to carry its flags, so they ride on the order itself rather than vanish.
  const abstainedFlags = FIELD_KEYS.filter((k) => fields[k].value === null).flatMap((k) => flagsOf(k).extension ?? []);
  if (abstainedFlags.length > 0) request.extension = abstainedFlags;

  const drafted = hasProvider ? [patient, practitioner, request] : [patient, request];
  const provenance: Provenance = {
    resourceType: "Provenance",
    target: drafted.map((r) => ({ reference: urlOf(r.resourceType) })),
    recorded: recorded.toISOString(),
    agent: [{ who: { display: result.meta.model ?? "model not recorded" } }],
  };
  if (result.meta.promptVersion !== null) {
    provenance.policy = [`urn:order-intake:prompt-version:${encodeURIComponent(result.meta.promptVersion)}`];
  }

  const entry = [...drafted, provenance].map((resource) => ({ fullUrl: urlOf(resource.resourceType), resource }));
  return { resourceType: "Bundle", type: "collection", entry };
}

function flagExtension(field: FieldKey, flag: Flag): Extension {
  return {
    url: REVIEW_FLAG_URL,
    extension: [
      { url: "field", valueCode: field },
      { url: "code", valueCode: flag.code },
      { url: "message", valueString: flag.message },
    ],
  };
}

/** Pick the code system from the code's shape; a code that fits neither keeps its text and no system. */
function codeFor(code: string): CodeableConcept {
  if (CPT_SHAPE.test(code)) return { coding: [{ system: CPT_SYSTEM, code }] };
  if (HCPCS_SHAPE.test(code)) return { coding: [{ system: HCPCS_SYSTEM, code }] };
  return { text: code };
}

/**
 * A stable `urn:uuid:` per document and resource type, so the same result always gets the same references.
 * Name-based UUID layout: version nibble `5`, and the variant nibble's top bits set to `10`.
 */
function entryUrl(docId: string, resourceType: FhirResource["resourceType"]): string {
  const digest = createHash("sha256").update(`${docId}/${resourceType}`).digest("hex");
  const variant = ((parseInt(digest[16]!, 16) & 0x3) | 0x8).toString(16);
  const d = (from: number, to: number) => digest.slice(from, to);
  return `urn:uuid:${d(0, 8)}-${d(8, 12)}-5${d(13, 16)}-${variant}${d(17, 20)}-${d(20, 32)}`;
}
