import { Client } from "langsmith";
import type { RunTree } from "langsmith/run_trees";
import { getCurrentRunTree, traceable } from "langsmith/traceable";
import type { IntakeDocument, OrderType } from "../contract";

type KVMap = Record<string, unknown>;

const MASKED = /^\[masked: \d+ chars\]$/;

/** Trace inputs with the document text replaced by its length. Synthetic data only, but traces never carry document text when masking is on. */
export function maskDocumentText(inputs: KVMap): KVMap {
  // Idempotent: the SDK applies the mask again when it patches a run whose inputs it already masked.
  if (typeof inputs.text !== "string" || MASKED.test(inputs.text)) return inputs;
  return { ...inputs, text: `[masked: ${inputs.text.length} chars]` };
}

/** Trace outputs with every extracted value and source quote masked (they are copied from the document); order type and flags kept. */
function maskExtractedValues(outputs: KVMap): KVMap {
  const fields = outputs.fields;
  if (typeof fields !== "object" || fields === null) return outputs;
  const masked = Object.fromEntries(
    Object.entries(fields as Record<string, KVMap>).map(([k, f]) => [
      k,
      { ...f, value: f.value == null ? null : "[masked]", sourceQuote: f.sourceQuote == null ? null : "[masked]" },
    ]),
  );
  return { ...outputs, fields: masked };
}

// Which clients mask. A client not built by `tracingClient` is treated as masking (the safe side).
const masking = new WeakMap<Client, boolean>();

/** A LangSmith client. With `mask`, document text and everything copied from it stay out of traces. */
export function tracingClient({ mask, fetch }: { mask: boolean; fetch?: typeof globalThis.fetch }): Client {
  const client = new Client({
    hideInputs: mask ? maskDocumentText : false,
    hideOutputs: mask ? maskExtractedValues : false,
    ...(fetch ? { apiKey: "test", apiUrl: "http://langsmith.test", fetchImplementation: fetch } : {}),
  });
  masking.set(client, mask);
  return client;
}

const tracingOn = () => process.env.LANGSMITH_TRACING === "true";
const maskOn = () => process.env.LANGSMITH_HIDE_INPUTS === "true";
const projectName = () => process.env.LANGSMITH_PROJECT ?? "order-intake";

// One client per masking setting, so a change to LANGSMITH_HIDE_INPUTS is never served by a client built for the other.
const clients = new Map<boolean, Client>();
const defaultClient = () => {
  const mask = maskOn();
  if (!clients.has(mask)) clients.set(mask, tracingClient({ mask }));
  return clients.get(mask)!;
};

const projectIds = new Map<string, string>();

/** The run's LangSmith URL, or null if it cannot be resolved. */
async function runUrl(ls: Client, run: RunTree): Promise<string | null> {
  const name = run.project_name ?? projectName();
  let projectId = projectIds.get(name);
  if (!projectId) {
    projectId = (await ls.readProject({ projectName: name })).id;
    projectIds.set(name, projectId);
  }
  const { url } = await ls.runs.getURL(run.id, { project_id: projectId, trace_id: run.trace_id });
  return url ?? null;
}

/** Resolves to `fallback` if `p` rejects or takes longer than `ms`. */
function settleWithin<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  return Promise.race([p.catch(() => fallback), timeout]).finally(() => clearTimeout(timer));
}

export interface TraceTags {
  model: string;
  promptVersion: string;
}

export interface TraceOptions {
  /** Defaults to a client built from the LANGSMITH_* environment. Tests inject one with a fake transport. */
  client?: Client;
  /** Upper bound on flushing the trace and resolving its URL; a slow LangSmith never holds up an order for longer. */
  finalizeTimeoutMs?: number;
}

/**
 * Runs `step` as one LangSmith trace for `doc`, tagged `model:`, `promptVersion:` and, once the document is
 * classified, `route:<orderType>`. A plain call when `LANGSMITH_TRACING` is not `true`.
 * Tracing never changes the outcome: `step`'s result or error is returned as is, and trace failures only cost the URL.
 */
export async function traceDocument<T extends { orderType: OrderType }>(
  doc: IntakeDocument,
  tags: TraceTags,
  step: (doc: IntakeDocument) => Promise<T>,
  { client, finalizeTimeoutMs = 5000 }: TraceOptions = {},
): Promise<{ value: T; traceUrl: string | null }> {
  if (!tracingOn()) return { value: await step(doc), traceUrl: null };

  const ls = client ?? defaultClient();
  const mask = masking.get(ls) ?? true;
  let run: RunTree | undefined;
  let stepError: { error: unknown } | undefined;
  const traced = traceable(
    async (d: IntakeDocument) => {
      run = getCurrentRunTree();
      let value: T;
      try {
        value = await step(d);
      } catch (error) {
        // Error messages can quote model output, which is copied from the document: keep them out of masked traces.
        stepError = { error };
        throw mask ? new Error("step failed (details masked)") : error;
      }
      run.tags = [...(run.tags ?? []), `route:${value.orderType}`];
      run.metadata = { ...run.metadata, route: value.orderType };
      return value;
    },
    {
      name: "classify_extract",
      run_type: "chain",
      client: ls,
      tracingEnabled: true,
      project_name: projectName(),
      tags: [`model:${tags.model}`, `promptVersion:${tags.promptVersion}`],
      metadata: { docId: doc.id, model: tags.model, promptVersion: tags.promptVersion },
    },
  );

  let value: T | undefined;
  try {
    value = await traced(doc);
  } catch (error) {
    if (!stepError) throw error;
  }
  // Flush per document (the eval runner exits without flushing; the URL lookup needs the run to exist), but bounded.
  const finalize = async () => {
    await ls.awaitPendingTraceBatches();
    return run ? runUrl(ls, run) : null;
  };
  const traceUrl = await settleWithin(finalize(), finalizeTimeoutMs, null);
  if (stepError) throw stepError.error;
  return { value: value!, traceUrl };
}
