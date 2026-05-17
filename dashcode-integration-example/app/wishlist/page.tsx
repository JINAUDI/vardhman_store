"use client";

import { useEffect, useMemo, useState } from "react";
import { api, WishlistAnalyticsResponse } from "../../lib/api";
import AdminGuard from "../../components/AdminGuard";

export default function WishlistPage() {
  const [analytics, setAnalytics] = useState<WishlistAnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api.getWishlistAnalytics()
      .then((response) => {
        setAnalytics(response);
        setError("");
      })
      .catch((loadError) => {
        setError(loadError.message || "Unable to load wishlist analytics");
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const sessionCount = useMemo(() => {
    const sessions = new Set<string>();
    analytics?.items.forEach((item) => {
      sessions.add(item.auth_user_id || item.session_id || item.customer_id || "unknown");
    });
    return sessions.size;
  }, [analytics]);

  return (
    <AdminGuard permission="view_orders">
      <h1>Wishlist Insights</h1>
      {loading ? <p>Loading wishlist analytics...</p> : null}
      {error ? <p role="alert" style={{ color: "#b42318" }}>{error}</p> : null}

      {!loading && !error ? (
        <>
      <section style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
        <div>
          <strong>Total wishlist saves</strong>
          <div>{analytics?.total || 0}</div>
        </div>
        <div>
          <strong>Customers / sessions</strong>
          <div>{sessionCount}</div>
        </div>
      </section>

      <h2>Most Wishlisted Products</h2>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Saves</th>
          </tr>
        </thead>
        <tbody>
          {(analytics?.mostWishlisted || []).map((product) => (
            <tr key={product.productId}>
              <td>{product.productName}</td>
              <td>{product.total}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Recent Wishlist Activity</h2>
      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>Customer / Session</th>
            <th>Category</th>
            <th>Price</th>
            <th>Stock</th>
            <th>Date Added</th>
          </tr>
        </thead>
        <tbody>
          {(analytics?.items || []).map((item) => (
            <tr key={item.id}>
              <td>{item.productName}</td>
              <td>{item.auth_user_id || item.session_id || item.customer_id || "Unknown"}</td>
              <td>{item.productCategory}</td>
              <td>{item.productPrice}</td>
              <td>{item.productStock}</td>
              <td>{item.created_at ? new Date(item.created_at).toLocaleString() : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
        </>
      ) : null}
    </AdminGuard>
  );
}
