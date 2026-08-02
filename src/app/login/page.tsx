import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

// Reads cookies to check the session, so this route is always dynamic.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <div style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
          <span className="brand-mark" aria-hidden="true">
            CC
          </span>
          <div>
            <div style={{ fontWeight: 650 }}>CC-Quality</div>
            <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>QA Scorecard</div>
          </div>
        </div>

        <h1 style={{ fontSize: "1.45rem", marginTop: "1.6rem" }}>Welcome back</h1>
        <p className="muted" style={{ marginBottom: "1.5rem" }}>
          Sign in to continue to your workspace.
        </p>

        <LoginForm />
      </div>
    </main>
  );
}
