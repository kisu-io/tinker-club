"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily:
            "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          color: "#0f172a",
          background: "#fff",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <p
            style={{
              fontSize: 12,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#64748b",
            }}
          >
            Something went wrong
          </p>
          <h1 style={{ marginTop: 12, fontSize: 28, fontWeight: 600 }}>
            The app crashed
          </h1>
          <p style={{ marginTop: 12, fontSize: 14, color: "#475569" }}>
            A critical error stopped the layout from rendering. Try reloading.
            {error.digest ? ` (ref: ${error.digest})` : ""}
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              padding: "10px 18px",
              borderRadius: 999,
              background: "#0f172a",
              color: "#fff",
              border: 0,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
