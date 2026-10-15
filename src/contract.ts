/**
 * The Order Intake contract. Human-owned: the eval scorer grades against this shape.
 * Vocabulary is defined in GLOSSARY.md (Order, Field, Source quote, Flag, Abstain, Silent error).
 */
import { z } from "zod";

export const ORDER_TYPES = ["lab", "imaging", "dme", "referral", "not_order"] as const;
export const OrderType = z.enum(ORDER_TYPES);
export type OrderType = z.infer<typeof OrderType>;

/** The fields we extract from every order. Dates are ISO `YYYY-MM-DD`. */
export const FIELD_KEYS = [
  "patientName",
  "patientDob",
  "memberId",
  "providerName",
  "providerNpi",
  "icd10",
  "orderCode",
  "orderDate",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

/**
 * A Flag routes a field to human review. Known codes so far:
 * `ungrounded` (source quote not found in the document). Add new codes here when you add a check.
 */
export const Flag = z.object({
  code: z.string().min(1),
  message: z.string(),
});
export type Flag = z.infer<typeof Flag>;

/** One extracted Field. `value: null` means the model Abstained (the document doesn't say). */
export const ExtractedField = z.object({
  value: z.string().nullable(),
  sourceQuote: z.string().nullable(),
  flags: z.array(Flag),
});
export type ExtractedField = z.infer<typeof ExtractedField>;

export const ExtractedFields = z.object({
  patientName: ExtractedField,
  patientDob: ExtractedField,
  memberId: ExtractedField,
  providerName: ExtractedField,
  providerNpi: ExtractedField,
  icd10: ExtractedField,
  orderCode: ExtractedField,
  orderDate: ExtractedField,
});
export type ExtractedFields = z.infer<typeof ExtractedFields>;

export const PipelineResult = z.object({
  docId: z.string(),
  /** null only if classification itself failed */
  orderType: OrderType.nullable(),
  fields: ExtractedFields,
  meta: z.object({
    model: z.string().nullable(),
    promptVersion: z.string().nullable(),
    latencyMs: z.number().nullable(),
    traceUrl: z.string().nullable().optional(),
  }),
});
export type PipelineResult = z.infer<typeof PipelineResult>;

/** Input to the pipeline: the text layer of one inbound document (one string per page joined by form feeds). */
export interface IntakeDocument {
  id: string;
  text: string;
}

export function emptyField(): ExtractedField {
  return { value: null, sourceQuote: null, flags: [] };
}

export function emptyFields(): ExtractedFields {
  return {
    patientName: emptyField(),
    patientDob: emptyField(),
    memberId: emptyField(),
    providerName: emptyField(),
    providerNpi: emptyField(),
    icd10: emptyField(),
    orderCode: emptyField(),
    orderDate: emptyField(),
  };
}
