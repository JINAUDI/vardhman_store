"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurrentAdmin, getSupabaseBrowserClient } from "../../../lib/admin-auth";

function safeRedirectPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/products";
  }

  return value;
}

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [redirect, setRedirect] = useState("/products");
  const router = useRouter();

  useEffect(() => {
    const redirectParam = new URLSearchParams(window.location.search).get("redirect");
    const nextRedirect = safeRedirectPath(redirectParam);
    setRedirect(nextRedirect);

    getCurrentAdmin()
      .then(() => {
        router.replace(nextRedirect);
      })
      .catch(() => {
        // Stay on login.
      });
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password
      });

      if (error || !data.user) {
        throw new Error("Invalid email or password.");
      }

      const { admin } = await getCurrentAdmin();
      if (!admin) {
        throw new Error("You are not authorized to access this dashboard.");
      }

      router.replace(redirect);
    } catch (loginError) {
      await getSupabaseBrowserClient().auth.signOut().catch(() => {});
      const text = loginError instanceof Error ? loginError.message : "Invalid email or password.";
      setMessage(text === "NOT_ADMIN" ? "You are not authorized to access this dashboard." : text);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="eyebrow">Vardhman Store</p>
        <h1>Admin Login</h1>
        <p>Sign in with an authorized admin account.</p>
        <form onSubmit={handleSubmit} style={{ display: "grid", gap: 14 }}>
          {message ? <div style={{ color: "#b42318" }}>{message}</div> : null}
          <label>
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              style={{ display: "block", width: "100%", marginTop: 6 }}
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              style={{ display: "block", width: "100%", marginTop: 6 }}
            />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>
      </section>
    </main>
  );
}
