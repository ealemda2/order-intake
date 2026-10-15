import { FIELD_KEYS, type ExtractedField, type ExtractedFields, type FieldKey, type Flag } from "../contract";

// Same comparison as the scorer's `isGrounded`: whitespace runs collapsed, case ignored. Never looser.
const fold = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

const escape = (c: string) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Codes: the whole value appears in the quote as one identifier, ignoring spaces (and hyphens, except in
 * ICD-10 codes, where a hyphen changes the code). A fragment of a longer identifier does not count.
 */
function supportsCode(key: FieldKey, value: string, quote: string): boolean {
  const sep = key === "icd10" ? "\\s*" : "[\\s-]*";
  const chars = [...value.replace(key === "icd10" ? /\s/g : /[\s-]/g, "")];
  if (chars.length === 0) return false;
  const body = chars.map(escape).join(sep);
  return new RegExp(`(?<![\\p{L}\\p{N}]|[\\p{L}\\p{N}]-)${body}(?![\\p{L}\\p{N}]|-[\\p{L}\\p{N}])`, "iu").test(quote);
}

const pad = (n: string) => n.padStart(2, "0");

/**
 * Every date in `s` as ISO `YYYY-MM-DD`. Reads `YYYY-MM-DD` and US `M/D/YYYY` (also with `-` or `.`).
 * Two-digit years are deliberately not read: the century would be a guess, so such a date flags.
 */
function isoDates(s: string): string[] {
  const iso = [...s.matchAll(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g)].map(([, y, m, d]) => `${y}-${pad(m!)}-${pad(d!)}`);
  const us = [...s.matchAll(/\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/g)].map(([, m, d, y]) => `${y}-${pad(m!)}-${pad(d!)}`);
  return [...iso, ...us];
}

/** Dates: the value is ISO and the quote holds exactly one date, which is the same day. */
function supportsDate(value: string, quote: string): boolean {
  const dates = isoDates(quote);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && dates.length === 1 && dates[0] === value;
}

const CREDENTIALS = new Set(["dr", "md", "do", "np", "pa", "pa-c", "rn", "facp", "phd"]);
const nameTokens = (s: string) => (s.toLowerCase().match(/[\p{L}\p{N}'-]+/gu) ?? []).filter((t) => !CREDENTIALS.has(t));

/** Names: same tokens in the same order, or in the swapped order when the quote is "Last, First". Credentials ignored. */
function supportsName(value: string, quote: string): boolean {
  const want = nameTokens(value).join(" ");
  if (!want) return false;
  const readings = [nameTokens(quote).join(" ")];
  const [last, first, ...more] = quote.split(",");
  if (first !== undefined && more.length === 0) readings.push([...nameTokens(first), ...nameTokens(last!)].join(" "));
  return readings.includes(want);
}

/** Can `value` be read from `quote`? */
function supports(key: FieldKey, value: string, quote: string): boolean {
  switch (key) {
    case "patientDob":
    case "orderDate":
      return supportsDate(value, quote);
    case "patientName":
    case "providerName":
      return supportsName(value, quote);
    default:
      return supportsCode(key, value, quote);
  }
}

function check(foldedDoc: string, key: FieldKey, field: ExtractedField): Flag | null {
  if (field.value === null) return null;
  if (!field.sourceQuote?.trim()) return { code: "ungrounded", message: "value has no source quote" };
  if (!foldedDoc.includes(fold(field.sourceQuote))) {
    return { code: "ungrounded", message: `source quote "${field.sourceQuote}" is not in the document` };
  }
  if (!supports(key, field.value, field.sourceQuote)) {
    return { code: "ungrounded", message: `value "${field.value}" is not supported by its source quote "${field.sourceQuote}"` };
  }
  return null;
}

/**
 * The grounding check: adds flag `ungrounded` to fields that are not grounded in the document, or whose
 * value cannot be read from their own source quote. Pure. Flags, never mutates: values and quotes are returned as given.
 */
export function ground(docText: string, fields: ExtractedFields): ExtractedFields {
  const foldedDoc = fold(docText);
  const out = { ...fields };
  for (const k of FIELD_KEYS) {
    const flag = check(foldedDoc, k, fields[k]);
    if (flag) out[k] = { ...fields[k], flags: [...fields[k].flags, flag] };
  }
  return out;
}
