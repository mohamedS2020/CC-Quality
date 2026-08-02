import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth";
import type { ConfigInput } from "@/lib/config/input";
import { loadActiveConfig } from "@/lib/config/loader";
import { buildInputFromLoaded } from "@/lib/config/versioning";
import { ConfigEditor } from "./config-editor";

// Reads the session + active config, so this route is always dynamic.
export const dynamic = "force-dynamic";

const EMPTY_DRAFT: ConfigInput = {
  name: "New configuration",
  roundingDecimals: 2,
  paretoCutoff: 0.8,
  newAgentTenureDays: 90,
  trialWindowDays: 90,
  sections: [],
  lenses: [],
  severities: [],
  trainingBuckets: [],
};

const shell: React.CSSProperties = { maxWidth: 900, margin: "0 auto", padding: "2.5rem 1.5rem" };

export default async function ConfigPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  if (!ctx.permissions.has("config.edit")) {
    return (
      <main style={shell}>
        <h1 style={{ fontSize: "1.4rem" }}>403 — Forbidden</h1>
        <p style={{ color: "var(--muted)" }}>
          You need the “Edit configuration” permission to view this page.
        </p>
      </main>
    );
  }

  const active = await loadActiveConfig();
  const initialDraft = active ? buildInputFromLoaded(active) : EMPTY_DRAFT;

  return (
    <main style={shell}>
      <ConfigEditor initialDraft={initialDraft} />
    </main>
  );
}
