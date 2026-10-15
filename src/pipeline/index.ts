import type { IntakeDocument, PipelineResult } from "../contract";
import { extract } from "./extract";
import { anthropicClient, type ModelClient } from "./model";
import { PROMPT_VERSION } from "./prompts";

export interface PipelineDeps {
  /** Defaults to the real Anthropic client. Unit tests inject a fake. */
  client?: ModelClient;
}

let defaultClient: ModelClient | undefined;

/**
 * The pipeline seam: one document in, one PipelineResult out.
 * The eval suite (`pnpm eval`) calls exactly this function, so keep it the only public entry point.
 * Stages: classify + extract (one model call). Grounding and validators come next (see PLAN.md).
 */
export async function runPipeline(doc: IntakeDocument, deps: PipelineDeps = {}): Promise<PipelineResult> {
  const client = deps.client ?? (defaultClient ??= anthropicClient());
  const started = performance.now();
  const { orderType, fields } = await extract(doc, client);
  return {
    docId: doc.id,
    orderType,
    fields,
    meta: {
      model: client.model,
      promptVersion: PROMPT_VERSION,
      latencyMs: Math.round(performance.now() - started),
      traceUrl: null,
    },
  };
}
