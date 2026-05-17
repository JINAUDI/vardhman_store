"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AdminUser, getCurrentAdmin, getSupabaseBrowserClient, roleCan } from "../lib/admin-auth";

type AdminGuardProps = {
  children: ReactNode;
  permission?: "manage_admins" | "manage_catalog" | "manage_orders" | "view_orders";
};

const ecommerceLinks = [
  { slug: "analytics", href: "/analytics", label: "Analytics", icon: "A" },
  { slug: "products", href: "/products", label: "Products", icon: "P" },
  { slug: "categories", href: "/categories", label: "Categories", icon: "C" },
  { slug: "orders", href: "/orders", label: "Orders", icon: "O" },
  { slug: "inventory", href: "/inventory", label: "Inventory", icon: "I" },
  { slug: "promotions", href: "/promotions", label: "Promotions", icon: "%" },
  { slug: "reviews", href: "/reviews", label: "Reviews", icon: "R" },
  { slug: "wishlist", href: "/wishlist", label: "Wishlist", icon: "W" },
  { slug: "search-analytics", href: "/search-analytics", label: "Search", icon: "S" }
];

function dashboardPrefix(pathname: string) {
  const match = pathname.match(/^\/([^/]+)\/ecommerce\/backend(?:\/|$)/);
  return match ? `/${match[1]}/ecommerce/backend` : "";
}

export default function AdminGuard({ children, permission = "view_orders" }: AdminGuardProps) {
  const [admin, setAdmin] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const prefix = useMemo(() => dashboardPrefix(pathname), [pathname]);
  const activeLink = ecommerceLinks.find((link) => {
    const href = prefix ? `${prefix}/${link.slug}` : link.href;
    return pathname === href || pathname === link.href;
  });

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
    return (
      <main className="dashcode-loading">
        <div className="dashcode-loader-card">
          <span className="dashcode-brand-mark">D</span>
          <strong>Checking dashboard access...</strong>
        </div>
      </main>
    );
  }

  return (
    <main className="dashcode-layout">
      <aside className="dashcode-sidebar" aria-label="Dashcode admin navigation">
        <Link className="dashcode-brand" href={prefix ? `${prefix}/analytics` : "/analytics"}>
          <span className="dashcode-brand-mark">D</span>
          <span>
            <strong>Dashcode</strong>
            <small>Vardhman admin</small>
          </span>
        </Link>
        <nav className="dashcode-nav" aria-label="Ecommerce dashboard">
          {ecommerceLinks.map((link) => {
            const href = prefix ? `${prefix}/${link.slug}` : link.href;
            const isActive = activeLink?.slug === link.slug;
            return (
              <Link
                key={link.slug}
                className={isActive ? "dashcode-nav-link is-active" : "dashcode-nav-link"}
                href={href}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="dashcode-nav-icon" aria-hidden="true">
                  {link.icon}
                </span>
                <span>{link.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <section className="dashcode-main">
        <header className="dashcode-topbar">
          <div>
            <p className="eyebrow">Admin Panel</p>
            <strong className="dashcode-page-title">{activeLink?.label || "Dashboard"}</strong>
          </div>
          <div className="dashcode-userbar">
            <div className="dashcode-user">
              <strong>{admin.email}</strong>
              <span>{admin.role}</span>
            </div>
            <button className="dashcode-logout" type="button" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>
        {error ? <div className="dashcode-alert">{error}</div> : null}
        <div className="dashcode-content">{children}</div>
      </section>
    </main>
  );
}
