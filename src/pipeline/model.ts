import Anthropic from "@anthropic-ai/sdk";

export const DEFAULT_MODEL = "claude-sonnet-5-5";

/** One structured-output request: the model must answer with JSON matching `schema`. */
export interface JsonRequest {
  system: string;
  user: string;
  /** JSON Schema, generated from the zod contract with `z.toJSONSchema`. */
  schema: Record<string, unknown>;
}

/**
 * The model port the pipeline stages depend on. Injected so unit tests use a fake and never hit the network.
 * `generateJson` returns the raw, unvalidated JSON; callers parse it with zod.
 */
export interface ModelClient {
  model: string;
  generateJson(req: JsonRequest): Promise<unknown>;
}

/**
 * The real adapter: Anthropic Messages API with native structured outputs.
 * This model rejects both forced `tool_choice` and `temperature`, so the schema goes in `output_config.format`
 * and sampling is left at the model default.
 * Reads ANTHROPIC_API_KEY from the environment.
 */
export function anthropicClient(model: string = DEFAULT_MODEL, sdk: Anthropic = new Anthropic()): ModelClient {
  return {
    model,
    async generateJson({ system, user, schema }) {
      const { $schema: _, ...jsonSchema } = schema;
      const res = await sdk.messages.create({
        model,
        max_tokens: 2048,
        system,
        messages: [{ role: "user", content: user }],
        output_config: { format: { type: "json_schema", schema: jsonSchema } },
      });
      if (res.stop_reason === "max_tokens" || res.stop_reason === "refusal") {
        throw new Error(`model ${model} stopped early (stop_reason: ${res.stop_reason}); no usable structured output`);
      }
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`model ${model} returned non-JSON output (stop_reason: ${res.stop_reason}): ${text.slice(0, 200)}`);
      }
    },
  };
}
