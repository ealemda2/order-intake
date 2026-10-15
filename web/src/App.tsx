import { useEffect, useState } from "react";
import { toReviewRows, type ReviewData, type ReviewRow } from "./review";

/**
 * Review queue: one row per order, flagged orders first.
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
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 960, margin: "2rem auto", padding: "0 1rem" }}>
      <h1>Order Intake · Review queue</h1>
      {!data ? (
        <p>No review data yet. Run <code>pnpm eval</code> then copy <code>.eval/outputs.json</code> to <code>web/public/review.json</code>.</p>
      ) : (
        toReviewRows(data).map((row) => <OrderRow key={row.docId} row={row} />)
      )}
    </main>
  );
}

const FLAGGED_BG = "#fff4e5";

function OrderRow({ row }: { row: ReviewRow }) {
  const needsAttention = row.error !== null || row.flagCount > 0;
  return (
    <section
      style={{
        border: `1px solid ${needsAttention ? "#e8a33d" : "#ddd"}`,
        borderRadius: 6,
        padding: "0.75rem 1rem",
        marginBottom: "1rem",
      }}
    >
      <h2 style={{ fontSize: "1.1rem", margin: "0 0 0.5rem" }}>
        {row.docId} <small style={{ fontWeight: "normal", color: "#666" }}>{row.orderType ?? "unclassified"}</small>
        {row.flagCount > 0 && (
          <span style={{ marginLeft: 8, fontSize: "0.85rem", color: "#a35a00" }}>
            {row.flagCount} flag{row.flagCount === 1 ? "" : "s"}
          </span>
        )}
      </h2>
      {row.error !== null ? (
        <p style={{ color: "#b00020", margin: 0 }}>Pipeline error: {row.error}</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#666" }}>
              <th>Field</th>
              <th>Value</th>
              <th>Source quote</th>
              <th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {row.fields.map((f) => (
              <tr key={f.key} style={{ background: f.flags.length > 0 ? FLAGGED_BG : undefined, borderTop: "1px solid #eee" }}>
                <td style={{ padding: "4px 6px" }}>{f.key}</td>
                <td style={{ padding: "4px 6px" }}>{f.value}</td>
                <td style={{ padding: "4px 6px" }}>{f.sourceQuote ? <q>{f.sourceQuote}</q> : f.value && <em style={{ color: "#b00020" }}>no source quote</em>}</td>
                <td style={{ padding: "4px 6px" }}>
                  {f.flags.map((flag, i) => (
                    <div key={i}>
                      <strong>{flag.code}</strong>: {flag.message}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
