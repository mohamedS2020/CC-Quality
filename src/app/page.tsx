export default function HomePage() {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "4rem 1.5rem" }}>
      <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>CC-Quality</h1>
      <p style={{ color: "var(--muted)", marginBottom: "1.5rem" }}>
        Call Center Quality Scoring System — QA Scorecard.
      </p>
      <p>
        System health: <a href="/health">/health</a>
      </p>
    </main>
  );
}
