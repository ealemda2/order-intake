import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyFields, FIELD_KEYS } from "../contract";
import { runPipeline } from ".";
import type { Extraction } from "./extract";
import type { ModelClient } from "./model";
import { maskDocumentText, traceDocument, tracingClient } from "./tracing";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("maskDocumentText", () => {
  it("replaces the document text with its length and keeps the doc id", () => {
    expect(maskDocumentText({ id: "01-lab-cmp", text: "Patient: Mara Ellison" })).toEqual({
      id: "01-lab-cmp",
      text: "[masked: 21 chars]",
    });
  });

  it("is idempotent: masking already-masked inputs keeps the original length", () => {
    const once = maskDocumentText({ id: "01-lab-cmp", text: "x".repeat(551) });

    expect(maskDocumentText(once)).toEqual({ id: "01-lab-cmp", text: "[masked: 551 chars]" });
  });

  it("leaves inputs without document text unchanged", () => {
    expect(maskDocumentText({ id: "01-lab-cmp" })).toEqual({ id: "01-lab-cmp" });
  });
});

describe("runPipeline with tracing off", () => {
  it("runs without a network and leaves meta.traceUrl null", async () => {
    vi.stubEnv("LANGSMITH_TRACING", "false");
    const client: ModelClient = {
      model: "fake-model",
      generateJson: async () => ({
        orderType: "not_order",
        fields: Object.fromEntries(FIELD_KEYS.map((k) => [k, { value: null, sourceQuote: null }])),
      }),
    };
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const result = await runPipeline({ id: "15-flu", text: "Flu shots are here!" }, { client });

    expect(result.meta.traceUrl).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("traceDocument with tracing on", () => {
  const DOC = { id: "01-lab-cmp", text: "LABORATORY ORDER\nPatient: Zephyrine Quillfeather" };
  const TAGS = { model: "fake-model", promptVersion: "extract-test" };
  const extraction = (): Extraction => {
    const fields = emptyFields();
    fields.patientName = { value: "Zephyrine Quillfeather", sourceQuote: "Zephyrine Quillfeather", flags: [] };
    return { orderType: "lab", fields };
  };

  /** A LangSmith transport that records every request body as text. */
  function recordingFetch() {
    const sent: string[] = [];
    const fetch = (async (_url: string | URL | Request, init?: RequestInit) => {
      if (init?.body) sent.push(await new Response(init.body as ConstructorParameters<typeof Response>[0]).text());
      return new Response("{}", { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof globalThis.fetch;
    return { sent, fetch };
  }

  it("tags the trace with model, prompt version and route, and never sends document text when masking is on", async () => {
    vi.stubEnv("LANGSMITH_TRACING", "true");
    const { sent, fetch } = recordingFetch();
    const client = tracingClient({ mask: true, fetch });

    const { value } = await traceDocument(DOC, TAGS, async () => extraction(), { client });

    const payload = sent.join("\n");
    expect(value.orderType).toBe("lab");
    expect(payload).toContain("model:fake-model");
    expect(payload).toContain("promptVersion:extract-test");
    expect(payload).toContain("route:lab");
    expect(payload).not.toContain("Quillfeather");
  });

  it("keeps document text out of the trace when the step fails, and rethrows the original error", async () => {
    vi.stubEnv("LANGSMITH_TRACING", "true");
    const { sent, fetch } = recordingFetch();
    const client = tracingClient({ mask: true, fetch });
    const failing = async (): Promise<Extraction> => {
      throw new Error("model returned non-JSON output: Patient: Zephyrine Quillfeather");
    };

    await expect(traceDocument(DOC, TAGS, failing, { client })).rejects.toThrow(/Quillfeather/);
    expect(sent.join("\n")).not.toContain("Quillfeather");
  });

  it("still returns the result, with no trace URL, when LangSmith never answers", async () => {
    vi.stubEnv("LANGSMITH_TRACING", "true");
    const hang = (() => new Promise<Response>(() => {})) as typeof globalThis.fetch;
    const client = tracingClient({ mask: true, fetch: hang });

    const { value, traceUrl } = await traceDocument(DOC, TAGS, async () => extraction(), { client, finalizeTimeoutMs: 50 });

    expect(value.orderType).toBe("lab");
    expect(traceUrl).toBeNull();
  });
});
