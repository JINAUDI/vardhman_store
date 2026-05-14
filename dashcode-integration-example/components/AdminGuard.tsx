"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminUser, getCurrentAdmin, getSupabaseBrowserClient, roleCan } from "../lib/admin-auth";

type AdminGuardProps = {
  children: ReactNode;
  permission?: "manage_admins" | "manage_catalog" | "manage_orders" | "view_orders";
};

const ecommerceLinks = [
  { href: "/analytics", label: "Analytics" },
  { href: "/products", label: "Products" },
  { href: "/categories", label: "Categories" },
  { href: "/orders", label: "Orders" },
  { href: "/inventory", label: "Inventory" },
  { href: "/promotions", label: "Promotions" },
  { href: "/reviews", label: "Reviews" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/search-analytics", label: "Search" }
];

export default function AdminGuard({ children, permission = "view_orders" }: AdminGuardProps) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    getCurrentAdmin()
      .then(({ admin: currentAdmin }) => {
        if (cancelled) return;
        if (!roleCan(currentAdmin.role, permission)) {
          router.replace("/auth/unauthorized");
          return;
        }
        setAdmin(currentAdmin);
        setLoading(false);
      })
      .catch((guardError) => {
        if (cancelled) return;
        const currentSearch = typeof window === "undefined" ? "" : window.location.search;
        const redirectPath = `${pathname}${currentSearch}`;
        if (guardError.message === "NOT_ADMIN") {
          router.replace("/auth/unauthorized");
          return;
        }
        router.replace(`/auth/login?redirect=${encodeURIComponent(redirectPath)}`);
      });

    return () => {
      cancelled = true;
    };
  }, [pathname, permission, router]);

  async function handleLogout() {
    try {
      await getSupabaseBrowserClient().auth.signOut();
      router.replace("/auth/login");
    } catch (logoutError) {
      setError("Unable to sign out. Please try again.");
    }
  }

  if (loading || !admin) {
    return <main className="admin-page">Checking dashboard access...</main>;
  }

  return (
    <main className="admin-shell">
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 24 }}>
        <div>
          <strong>{admin.email}</strong>
          <span style={{ marginLeft: 8, textTransform: "capitalize" }}>{admin.role}</span>
        </div>
        <button type="button" onClick={handleLogout}>
          Logout
        </button>
      </div>
      {error ? <div>{error}</div> : null}
      <nav aria-label="Ecommerce dashboard" style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        {ecommerceLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            style={{
              border: pathname === link.href ? "1px solid #ff7a00" : "1px solid #d0d5dd",
              borderRadius: 6,
              color: pathname === link.href ? "#c85f00" : "#344054",
              padding: "8px 10px",
              textDecoration: "none"
            }}
          >
            {link.label}
          </a>
        ))}
      </nav>
      {children}
    </main>
  );
}
