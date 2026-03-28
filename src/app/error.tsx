"use client";

import { useEffect } from "react";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RootError]", error);
  }, [error]);

  return (
    <div style={{ padding: 32, fontFamily: "monospace" }}>
      <h2>Something went wrong (root)</h2>
      <pre style={{ color: "red", whiteSpace: "pre-wrap" }}>
        {error.message}
        {"\n"}
        {error.stack}
      </pre>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
