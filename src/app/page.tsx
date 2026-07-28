import { getCurrentUser } from "@/lib/auth";
import { logoutAction } from "./login/actions";

// Reads the session cookie, so render is dynamic.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>CC-Quality</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Call Center Quality Scoring System — QA Scorecard.
      </p>

      {user ? (
        <div style={{ marginBottom: "1.5rem" }}>
          <p style={{ marginBottom: "0.75rem" }}>
            Signed in as <strong>{user.email}</strong> ({user.role}).
          </p>
          <form action={logoutAction}>
            <button
              type="submit"
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: 6,
                border: "1px solid var(--border, #ccc)",
                background: "transparent",
                color: "inherit",
                cursor: "pointer",
              }}
            >
              Sign out
            </button>
          </form>
        </div>
      ) : (
        <p style={{ marginBottom: "1.5rem" }}>
          <a href="/login">Sign in</a>
        </p>
      )}

      <p>
        System health: <a href="/health">/health</a>
      </p>
    </main>
  );
}
