import { emptyFields, type IntakeDocument, type PipelineResult } from "../contract";

/**
 * The pipeline seam: one document in, one PipelineResult out.
 * The eval suite (`pnpm eval`) calls exactly this function, so keep it the only public entry point.
 *
 * STUB: returns "abstain on everything". The build tickets replace this with
 * classify -> extract -> ground/validate. See PLAN.md.
 */
export async function runPipeline(doc: IntakeDocument): Promise<PipelineResult> {
  return {
    docId: doc.id,
    orderType: null,
    fields: emptyFields(),
    meta: { model: null, promptVersion: null, latencyMs: 0, traceUrl: null },
  };
}
