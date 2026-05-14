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
    <main style={{ maxWidth: 520, margin: "80px auto", padding: 24 }}>
      <h1>You are not authorized to access this dashboard.</h1>
      <p>Use an admin account that exists in public.admin_users.</p>
      <div style={{ display: "flex", gap: 12 }}>
        <button type="button" onClick={signOut}>
          Sign Out
        </button>
        <Link href="/auth/login">Back to Login</Link>
      </div>
    </main>
  );
}
