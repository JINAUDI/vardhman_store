"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowserClient } from "../../../lib/admin-auth";

export default function UnauthorizedPage() {
  const router = useRouter();

  async function signOut() {
    await getSupabaseBrowserClient().auth.signOut().catch(() => {});
    router.replace("/auth/login");
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Access denied</p>
        <h1>You are not authorized to access this dashboard.</h1>
        <p>Use an admin account that exists in public.admin_users.</p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button type="button" onClick={signOut}>
            Sign Out
          </button>
          <Link className="button-link" href="/auth/login">
            Back to Login
          </Link>
        </div>
      </section>
    </main>
  );
}
