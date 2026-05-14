import Link from "next/link";

export default function NotFound() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">404</p>
        <h1>Admin page not found</h1>
        <p>The dashboard route you opened does not exist.</p>
        <Link className="button-link" href="/products">
          Back to products
        </Link>
      </section>
    </main>
  );
}
