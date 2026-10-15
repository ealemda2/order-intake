import { z } from "zod";
import { emptyFields, ExtractedField, FIELD_KEYS, OrderType, type ExtractedFields, type FieldKey, type IntakeDocument } from "../contract";
import type { ModelClient } from "./model";
import { EXTRACT_PROMPT } from "./prompts";

/** What the model returns: the contract's fields without flags (flags are added by deterministic checks, never by the model). */
const ModelField = ExtractedField.omit({ flags: true });
const ModelOutput = z.object({
  orderType: OrderType,
  fields: z.object(Object.fromEntries(FIELD_KEYS.map((k) => [k, ModelField])) as Record<FieldKey, typeof ModelField>),
});

const OUTPUT_SCHEMA = z.toJSONSchema(ModelOutput) as Record<string, unknown>;

export interface Extraction {
  orderType: OrderType;
  fields: ExtractedFields;
}

/** Classify one inbound document and extract its fields in a single structured-output model call. */
export async function extract(doc: IntakeDocument, client: ModelClient): Promise<Extraction> {
  const raw = await client.generateJson({ system: EXTRACT_PROMPT, user: doc.text, schema: OUTPUT_SCHEMA });
  const parsed = ModelOutput.safeParse(raw);
  if (!parsed.success) {
    throw new Error(
      `extract: output for ${doc.id} from ${client.model} does not match the contract:\n${z.prettifyError(parsed.error)}`,
    );
  }
  const out = parsed.data;
  // Not-an-order documents are archived with no extraction, whatever the model wrote.
  if (out.orderType === "not_order") return { orderType: out.orderType, fields: emptyFields() };
  const fields = emptyFields();
  for (const k of FIELD_KEYS) fields[k] = { ...out.fields[k], flags: [] };
  return { orderType: out.orderType, fields };
}
