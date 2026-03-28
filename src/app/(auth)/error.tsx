"use client";

import { useEffect } from "react";

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AuthError]", error);
  }, [error]);

  return (
    <div style={{ padding: 32, fontFamily: "monospace" }}>
      <h2>Something went wrong (auth)</h2>
      <pre style={{ color: "red", whiteSpace: "pre-wrap" }}>
        {error.message}
        {"\n"}
        {error.stack}
      </pre>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
