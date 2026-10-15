import { FIELD_KEYS, type FieldKey, type Flag, type OrderType, type PipelineResult } from "../../src/contract";

/** review.json: a copy of .eval/outputs.json, keyed by docId. */
export type ReviewData = Record<string, PipelineResult | { error: string }>;

/** One field as the reviewer sees it. Abstained values and quotes are "". */
export interface ReviewField {
  key: FieldKey;
  value: string;
  sourceQuote: string;
  flags: Flag[];
}

export interface ReviewRow {
  docId: string;
  orderType: OrderType | null;
  /** Set when the pipeline threw on this document; fields is then empty. */
  error: string | null;
  fields: ReviewField[];
  flagCount: number;
}

/** One row per order, flagged orders first so the reviewer sees what to check first. */
export function toReviewRows(data: ReviewData): ReviewRow[] {
  const rows = Object.entries(data).map(([docId, r]): ReviewRow => {
    const fields = "error" in r
      ? []
      : FIELD_KEYS.map((key) => ({
          key,
          value: r.fields[key].value ?? "",
          sourceQuote: r.fields[key].sourceQuote ?? "",
          flags: r.fields[key].flags,
        }));
    return {
      docId,
      orderType: "error" in r ? null : r.orderType,
      error: "error" in r ? r.error : null,
      fields,
      flagCount: fields.reduce((n, f) => n + f.flags.length, 0),
    };
  });
  const rank = (r: ReviewRow) => (r.error !== null ? 0 : r.flagCount > 0 ? 1 : 2);
  return rows.sort((a, b) => rank(a) - rank(b) || a.docId.localeCompare(b.docId));
}
