"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "../../components/AdminGuard";
import {
  getSearchAnalytics,
  type AnalyticsEventRow,
  type ProductSearchKeywordsRow,
  type SearchEventProduct,
  type SearchEventRow
} from "../../lib/search-analytics";

function firstValue<T>(value: T | T[] | null | undefined): T | undefined {
  return Array.isArray(value) ? value[0] : value || undefined;
}

function productName(product?: SearchEventProduct | ProductSearchKeywordsRow) {
  return product?.title || product?.name || product?.sku || "Product";
}

function countBy<T>(items: T[], getKey: (item: T) => string) {
  const counts = new Map<string, number>();
  items.forEach((item) => {
    const key = getKey(item).trim();
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((left, right) => right.count - left.count || left.label.localeCompare(right.label));
}

function conversionCountForProduct(productId: string, analyticsEvents: AnalyticsEventRow[]) {
  return analyticsEvents.filter((event) => event.product_id === productId).length;
}

export default function SearchAnalyticsPage() {
  const [events, setEvents] = useState<SearchEventRow[]>([]);
  const [products, setProducts] = useState<ProductSearchKeywordsRow[]>([]);
  const [analyticsEvents, setAnalyticsEvents] = useState<AnalyticsEventRow[]>([]);
  const [analyticsEventsAvailable, setAnalyticsEventsAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAnalytics() {
    setLoading(true);
    setError("");
    try {
      const result = await getSearchAnalytics();
      setEvents(result.searchEvents);
      setProducts(result.products);
      setAnalyticsEvents(result.analyticsEvents);
      setAnalyticsEventsAvailable(result.analyticsEventsAvailable);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load search analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, []);

  const mostSearched = useMemo(() => countBy(events.filter((event) => !event.clicked_product_id), (event) => event.query), [events]);
  const zeroResultSearches = useMemo(
    () => countBy(events.filter((event) => Number(event.results_count || 0) === 0 && !event.clicked_product_id), (event) => event.query),
    [events]
  );
  const clickedProducts = useMemo(() => {
    const productNames = new Map<string, string>();
    events.forEach((event) => {
      const product = firstValue<SearchEventProduct>(event.products);
      if (event.clicked_product_id) {
        productNames.set(event.clicked_product_id, productName(product));
      }
    });

    return countBy(events.filter((event) => Boolean(event.clicked_product_id)), (event) => event.clicked_product_id || "")
      .map((item) => ({ ...item, productName: productNames.get(item.label) || item.label }));
  }, [events]);

  const frequentlySearchedProducts = useMemo(() => {
    const searchText = mostSearched.map((item) => item.label.toLowerCase()).join(" ");
    return products
      .map((product) => {
        const haystack = [product.title, product.name, product.sku, product.category, product.search_keywords].join(" ").toLowerCase();
        const score = mostSearched.reduce((total, query) => {
          return haystack.includes(query.label.toLowerCase()) || searchText.includes((product.title || product.name || "").toLowerCase())
            ? total + query.count
            : total;
        }, 0);
        return { product, score };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 10);
  }, [mostSearched, products]);

  return (
    <AdminGuard permission="manage_catalog">
      <h1>Search Analytics</h1>
      <p>Track what shoppers search, where results are weak, and which suggestions earn product clicks.</p>
      {error ? <p role="alert" style={{ color: "#b42318" }}>{error}</p> : null}
      <button type="button" onClick={() => loadAnalytics()} disabled={loading}>
        {loading ? "Refreshing..." : "Refresh"}
      </button>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", margin: "16px 0" }}>
        <div><strong>Total searches</strong><div>{events.filter((event) => !event.clicked_product_id).length}</div></div>
        <div><strong>Zero-result searches</strong><div>{zeroResultSearches.reduce((total, item) => total + item.count, 0)}</div></div>
        <div><strong>Suggestion clicks</strong><div>{clickedProducts.reduce((total, item) => total + item.count, 0)}</div></div>
        <div><strong>Conversion events</strong><div>{analyticsEventsAvailable ? analyticsEvents.length : "Not available"}</div></div>
      </div>

      <h2>Most Searched Queries</h2>
      <table>
        <thead><tr><th>Query</th><th>Searches</th></tr></thead>
        <tbody>
          {mostSearched.slice(0, 20).map((item) => (
            <tr key={item.label}><td>{item.label}</td><td>{item.count}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Zero Result Searches</h2>
      <table>
        <thead><tr><th>Query</th><th>Searches</th></tr></thead>
        <tbody>
          {zeroResultSearches.slice(0, 20).map((item) => (
            <tr key={item.label}><td>{item.label}</td><td>{item.count}</td></tr>
          ))}
        </tbody>
      </table>

      <h2>Clicked Products From Search</h2>
      <table>
        <thead><tr><th>Product</th><th>Clicks</th><th>Conversion Insight</th></tr></thead>
        <tbody>
          {clickedProducts.slice(0, 20).map((item) => (
            <tr key={item.label}>
              <td>{item.productName}</td>
              <td>{item.count}</td>
              <td>{analyticsEventsAvailable ? `${conversionCountForProduct(item.label, analyticsEvents)} related analytics events` : "analytics_events not available"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Frequently Searched Products</h2>
      <table>
        <thead><tr><th>Product</th><th>SKU</th><th>Category</th><th>Search Keywords</th><th>Search Score</th></tr></thead>
        <tbody>
          {frequentlySearchedProducts.map(({ product, score }) => (
            <tr key={product.id}>
              <td>{productName(product)}</td>
              <td>{product.sku || "-"}</td>
              <td>{product.category || "-"}</td>
              <td>{product.search_keywords || "-"}</td>
              <td>{score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminGuard>
  );
}
