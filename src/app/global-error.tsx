"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary: catches errors thrown by the root layout itself, which
 * `error.tsx` cannot — it lives inside that layout.
 *
 * This replaces the entire document, so it must render its own <html>/<body>
 * and cannot assume the app's stylesheet loaded. Everything here is inline
 * styles for that reason; if the failure is bad enough to reach this file,
 * relying on the design system to render the message would be optimistic.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[root render error]", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily:
            'system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: "#fff",
          color: "#111",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>🦉</div>
        <h1 style={{ fontSize: 18, margin: "0 0 8px" }}>The app failed to start</h1>
        <p style={{ fontSize: 13, color: "#666", margin: "0 0 20px", maxWidth: 360 }}>
          This is the root error boundary — the failure happened before any page
          could render.
        </p>

        <pre
          style={{
            width: "100%",
            maxWidth: 360,
            overflowX: "auto",
            border: "1px solid #e5e5e5",
            borderRadius: 12,
            padding: 12,
            fontSize: 12,
            textAlign: "left",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            background: "#fafafa",
          }}
        >
          {error.message || "No error message"}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>

        <button
          onClick={reset}
          style={{
            marginTop: 20,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            borderRadius: 12,
            border: "none",
            background: "#243b8f",
            color: "#fff",
          }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
