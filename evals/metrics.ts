/**
 * Deterministic scorer. HUMAN-OWNED: this is the grader, agents must never edit it.
 * No LLM-as-judge anywhere: every metric is computed with code.
 */
import { FIELD_KEYS, PipelineResult, type FieldKey } from "../src/contract";
import type { GoldenDoc } from "./dataset";

export interface Metrics {
  docs: number;
  /** share of pipeline outputs that parse against the contract */
  schemaValidity: number;
  classificationAccuracy: number;
  /** over (order, field) slots where truth has a value: predicted value matches */
  fieldAccuracy: number;
  /** over slots where truth is null (incl. every field of a not_order doc): predicted null */
  abstention: number;
  /** over predicted non-null values: source quote found verbatim in the document */
  groundingRate: number;
  /** predicted values that are wrong or ungrounded AND carry no flag */
  silentErrors: number;
  silentErrorRate: number;
  /** over fields the truth marks invalid: share that came back flagged */
  invalidCatchRate: number;
  /** share of order docs with at least one flagged field (reported, trades off against silent errors) */
  reviewLoad: number;
  meanLatencyMs: number | null;
}

export type FindingKind =
  | "schema_invalid"
  | "misclassified"
  | "wrong"
  | "missed"
  | "hallucinated"
  | "ungrounded"
  | "silent_error"
  | "missed_invalid";

export interface Finding {
  docId: string;
  field?: FieldKey;
  kind: FindingKind;
  expected?: string | null;
  got?: string | null;
  flags?: string[];
}

const DATE_FIELDS: FieldKey[] = ["patientDob", "orderDate"];
const CODE_FIELDS: FieldKey[] = ["memberId", "providerNpi", "orderCode"];
const NAME_FIELDS: FieldKey[] = ["patientName", "providerName"];
const CREDENTIALS = new Set(["dr", "md", "do", "np", "pa", "pa-c", "rn", "facp", "phd"]);

const collapse = (s: string) => s.replace(/\s+/g, " ").trim();

export function normalize(field: FieldKey, value: string): string {
  const v = collapse(value);
  if (DATE_FIELDS.includes(field)) {
    const us = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (us) return `${us[3]}-${us[1]!.padStart(2, "0")}-${us[2]!.padStart(2, "0")}`;
    return v;
  }
  if (CODE_FIELDS.includes(field)) return v.replace(/[\s-]/g, "").toUpperCase();
  if (field === "icd10") return v.replace(/\s/g, "").toUpperCase();
  if (NAME_FIELDS.includes(field)) {
    let n = v;
    // "Last, First" -> "First Last" (only when the part after the comma isn't a credential)
    const parts = n.split(",").map((p) => p.trim());
    if (parts.length === 2 && !CREDENTIALS.has(parts[1]!.toLowerCase().replace(/\./g, ""))) {
      n = `${parts[1]} ${parts[0]}`;
    }
    return n
      .toLowerCase()
      .replace(/[.,]/g, " ")
      .split(/\s+/)
      .filter((t) => t && !CREDENTIALS.has(t))
      .join(" ");
  }
  return v.toLowerCase();
}

export function isGrounded(docText: string, quote: string | null): boolean {
  if (!quote) return false;
  const hay = collapse(docText).toLowerCase();
  return hay.includes(collapse(quote).toLowerCase());
}

const ratio = (num: number, den: number, empty: number) => (den === 0 ? empty : num / den);

export function score(
  docs: GoldenDoc[],
  outputs: Map<string, unknown>,
): { metrics: Metrics; findings: Finding[] } {
  const findings: Finding[] = [];
  let valid = 0,
    classified = 0,
    accNum = 0,
    accDen = 0,
    absNum = 0,
    absDen = 0,
    groundedNum = 0,
    predicted = 0,
    silent = 0,
    catchNum = 0,
    catchDen = 0,
    flaggedOrders = 0,
    orders = 0;
  const latencies: number[] = [];

  for (const doc of docs) {
    const { truth } = doc;
    const isOrder = truth.orderType !== "not_order";
    if (isOrder) orders++;
    catchDen += truth.expectedFlags.length;
    for (const k of FIELD_KEYS) {
      if (truth.fields[k] === null) absDen++;
      else if (isOrder) accDen++;
    }

    const parsed = PipelineResult.safeParse(outputs.get(doc.id));
    if (!parsed.success) {
      findings.push({ docId: doc.id, kind: "schema_invalid", got: parsed.error.message.slice(0, 200) });
      continue;
    }
    valid++;
    const out = parsed.data;
    if (out.meta.latencyMs != null) latencies.push(out.meta.latencyMs);

    if (out.orderType === truth.orderType) classified++;
    else findings.push({ docId: doc.id, kind: "misclassified", expected: truth.orderType, got: out.orderType });

    let anyFlag = false;
    for (const k of FIELD_KEYS) {
      const f = out.fields[k];
      const exp = truth.fields[k];
      const flags = f.flags.map((x) => x.code);
      if (flags.length) anyFlag = true;

      if (truth.expectedFlags.includes(k)) {
        if (flags.length) catchNum++;
        else findings.push({ docId: doc.id, field: k, kind: "missed_invalid", expected: exp, got: f.value, flags });
      }

      if (f.value === null) {
        if (exp === null) absNum++;
        else if (isOrder) findings.push({ docId: doc.id, field: k, kind: "missed", expected: exp, got: null });
        continue;
      }

      predicted++;
      const grounded = isGrounded(doc.text, f.sourceQuote);
      if (grounded) groundedNum++;
      else findings.push({ docId: doc.id, field: k, kind: "ungrounded", got: f.sourceQuote, flags });

      let correct = false;
      if (exp === null) {
        findings.push({ docId: doc.id, field: k, kind: "hallucinated", expected: null, got: f.value, flags });
      } else if (normalize(k, f.value) === normalize(k, exp)) {
        correct = true;
        if (isOrder) accNum++;
      } else {
        findings.push({ docId: doc.id, field: k, kind: "wrong", expected: exp, got: f.value, flags });
      }

      if ((!correct || !grounded) && flags.length === 0) {
        silent++;
        findings.push({ docId: doc.id, field: k, kind: "silent_error", expected: exp, got: f.value, flags });
      }
    }
    if (isOrder && anyFlag) flaggedOrders++;
  }

  const metrics: Metrics = {
    docs: docs.length,
    schemaValidity: ratio(valid, docs.length, 1),
    classificationAccuracy: ratio(classified, docs.length, 1),
    fieldAccuracy: ratio(accNum, accDen, 1),
    abstention: ratio(absNum, absDen, 1),
    groundingRate: ratio(groundedNum, predicted, 1),
    silentErrors: silent,
    silentErrorRate: ratio(silent, predicted, 0),
    invalidCatchRate: ratio(catchNum, catchDen, 1),
    reviewLoad: ratio(flaggedOrders, orders, 0),
    meanLatencyMs: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : null,
  };
  return { metrics, findings };
}

/* ---------------- gates ---------------- */

export type Gate = { min?: number; max?: number; maxDrop?: number; maxRise?: number };
export type Gates = Partial<Record<keyof Metrics, Gate>>;

export interface GateResult {
  metric: keyof Metrics;
  baseline: number | null;
  now: number | null;
  delta: number | null;
  rule: string;
  pass: boolean;
}

export function checkGates(now: Metrics, baseline: Partial<Metrics> | null, gates: Gates): GateResult[] {
  const keys = Object.keys(now) as (keyof Metrics)[];
  return keys
    .filter((k) => k !== "docs")
    .map((metric) => {
      const g = gates[metric];
      const n = now[metric];
      const b = (baseline?.[metric] ?? null) as number | null;
      const delta = n != null && b != null ? n - b : null;
      const rules: string[] = [];
      let pass = true;
      if (g && n != null) {
        if (g.min !== undefined) {
          rules.push(`>= ${g.min}`);
          if (n < g.min) pass = false;
        }
        if (g.max !== undefined) {
          rules.push(`<= ${g.max}`);
          if (n > g.max) pass = false;
        }
        if (g.maxDrop !== undefined && b != null) {
          rules.push(`drop <= ${g.maxDrop}`);
          if (b - n > g.maxDrop + 1e-9) pass = false;
        }
        if (g.maxRise !== undefined && b != null) {
          rules.push(`rise <= ${g.maxRise}`);
          if (n - b > g.maxRise + 1e-9) pass = false;
        }
      }
      return { metric, baseline: b, now: n, delta, rule: rules.join(", ") || "reported", pass };
    });
}
