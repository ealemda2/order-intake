import type { IntakeDocument, PipelineResult } from "../contract";
import { extract } from "./extract";
import { ground } from "./ground";
import { anthropicClient, type ModelClient } from "./model";
import { PROMPT_VERSION } from "./prompts";
import { traceDocument } from "./tracing";

export interface PipelineDeps {
  /** Defaults to the real Anthropic client. Unit tests inject a fake. */
  client?: ModelClient;
}

let defaultClient: ModelClient | undefined;

/**
 * The pipeline seam: one document in, one PipelineResult out.
 * The eval suite (`pnpm eval`) calls exactly this function, so keep it the only public entry point.
 * Stages: classify + extract (one model call, one LangSmith trace per document when tracing is on) -> grounding check.
 * Validators come next (see PLAN.md).
 */
export async function runPipeline(doc: IntakeDocument, deps: PipelineDeps = {}): Promise<PipelineResult> {
  const client = deps.client ?? (defaultClient ??= anthropicClient());
  let latencyMs = 0;
  const { value, traceUrl } = await traceDocument(doc, { model: client.model, promptVersion: PROMPT_VERSION }, async (d) => {
    const started = performance.now();
    const extraction = await extract(d, client);
    latencyMs = Math.round(performance.now() - started);
    return extraction;
  });
  const { orderType, fields } = value;
  return {
    docId: doc.id,
    orderType,
    fields: ground(doc.text, fields),
    meta: {
      model: client.model,
      promptVersion: PROMPT_VERSION,
      latencyMs,
      traceUrl,
    },
  };
}
