import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

// Reads cookies to check the session, so this route is always dynamic.
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <main style={{ maxWidth: 380, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1 style={{ fontSize: "1.6rem", marginBottom: "0.25rem" }}>Sign in</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>CC-Quality — QA Scorecard</p>
      <LoginForm />
    </main>
  );
}
