import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";

const shell: React.CSSProperties = { maxWidth: 800, margin: "0 auto", padding: "2.5rem 1.5rem" };

export default async function ImportPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("imports.run")) {
    return (
      <main style={shell}>
        <h1 style={{ fontSize: "1.4rem" }}>403 — Forbidden</h1>
        <p style={{ color: "var(--muted)" }}>You need the “Run imports” permission.</p>
      </main>
    );
  }

  return (
    <main style={shell}>
      <ImportForm />
    </main>
  );
}
