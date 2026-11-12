import Link from "next/link";

export default function NotFound() {
  return (
    <main className="page page-narrow">
      <h1 className="page-title">Page not found</h1>
      <p className="page-sub">The page you’re looking for doesn’t exist or has moved.</p>
      <Link prefetch={false} href="/" className="btn btn-primary" style={{ marginTop: "1rem" }}>
        Go to home
      </Link>
    </main>
  );
}
