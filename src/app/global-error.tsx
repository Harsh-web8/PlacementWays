"use client";

/**
 * Last-resort boundary: renders when the root layout itself throws, where
 * app/error.tsx cannot help. It must supply its own <html>/<body> and cannot
 * rely on the stylesheet or any component that may be what failed.
 */
export default function RootError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#faf8f4", color: "#1b1b1b" }}>
        <main style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 16, textAlign: "center" }}>
          <h1 style={{ fontSize: 32, margin: 0 }}>Something went wrong</h1>
          <p style={{ maxWidth: 420, opacity: 0.7, margin: 0 }}>
            An unexpected error occurred. Please try again. If it keeps happening, contact support.
          </p>
          <button onClick={reset} style={{ padding: "10px 20px", borderRadius: 8, border: 0, background: "#1b1b1b", color: "#fff", cursor: "pointer", fontSize: 16 }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
