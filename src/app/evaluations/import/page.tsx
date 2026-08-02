import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import { ImportForm } from "./import-form";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("imports.run")) {
    return (
      <main className="page page-narrow">
        <h1 className="page-title">403 — Forbidden</h1>
        <p className="page-sub">You need the “Run imports” permission.</p>
      </main>
    );
  }

  return (
    <main className="page page-narrow">
      <ImportForm />
    </main>
  );
}
