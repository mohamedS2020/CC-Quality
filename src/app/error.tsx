"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Friendly fallback when a page fails to render (e.g. a dropped database
 * connection). "Try again" re-renders the page; the details stay in the server
 * log, referenced by the digest.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="page page-narrow">
      <h1 className="page-title">Something went wrong</h1>
      <p className="page-sub">
        This page couldn’t be loaded. It’s usually a temporary hiccup — try again, and if it keeps
        happening, let an administrator know.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
        <button type="button" className="btn btn-primary" onClick={reset}>
          Try again
        </button>
        <Link prefetch={false} href="/" className="btn btn-ghost">
          Go to home
        </Link>
      </div>
      {error.digest && (
        <p className="muted" style={{ marginTop: "1rem", fontSize: "0.8rem" }}>
          Reference: {error.digest}
        </p>
      )}
    </main>
  );
}
