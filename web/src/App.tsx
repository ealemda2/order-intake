import { useEffect, useState } from "react";
import type { PipelineResult } from "../../src/contract";

type ReviewData = Record<string, PipelineResult | { error: string }>;

/**
 * Placeholder review queue. The "review view" ticket replaces this.
 * Data: web/public/review.json, a copy of .eval/outputs.json (CI copies it in on deploy).
 */
export function App() {
  const [data, setData] = useState<ReviewData | null>(null);
  useEffect(() => {
    fetch("./review.json")
      .then((r) => (r.ok ? r.json() : null))
      .then(setData)
      .catch(() => setData(null));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 880, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Order Intake · Review queue</h1>
      {!data ? (
        <p>No review data yet. Run <code>pnpm eval</code> then copy <code>.eval/outputs.json</code> to <code>web/public/review.json</code>.</p>
      ) : (
        <ul>
          {Object.entries(data).map(([id, r]) => (
            <li key={id}>
              <strong>{id}</strong>: {"error" in r ? `error: ${r.error}` : (r.orderType ?? "unclassified")}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
