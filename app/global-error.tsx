"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
          fontFamily: "system-ui, sans-serif",
          backgroundColor: "#f9fafb",
        }}>
          <div style={{
            maxWidth: "28rem",
            width: "100%",
            padding: "2rem",
            backgroundColor: "white",
            borderRadius: "0.75rem",
            border: "1px solid #e5e7eb",
            boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
          }}>
            <h1 style={{ fontSize: "1.125rem", fontWeight: 600, color: "#111827" }}>
              問題が発生しました
            </h1>
            <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#4b5563" }}>
              {error.message || "予期しないエラーが発生しました。"}
            </p>
            <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={reset}
                style={{
                  padding: "0.625rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "white",
                  backgroundColor: "#111827",
                  border: "none",
                  borderRadius: "0.5rem",
                  cursor: "pointer",
                }}
              >
                再試行
              </button>
              <Link
                href="/"
                style={{
                  display: "block",
                  padding: "0.625rem 1rem",
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "#374151",
                  backgroundColor: "white",
                  border: "1px solid #d1d5db",
                  borderRadius: "0.5rem",
                  textAlign: "center",
                  textDecoration: "none",
                }}
              >
                トップへ戻る
              </Link>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
