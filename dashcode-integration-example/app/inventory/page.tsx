"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "../../components/AdminGuard";
import {
  adjustProductStock,
  getInventoryLogs,
  getInventoryProducts,
  updateInventorySettings,
  type InventoryLog,
  type InventoryProduct
} from "../../lib/inventory";

type FilterMode = "all" | "low_stock" | "out_of_stock";

function productName(product: InventoryProduct) {
  return product.title || product.name || product.sku || "Product";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function InventoryPage() {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterMode>("all");
  const [adjustments, setAdjustments] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadInventory(nextSelectedProductId = selectedProductId) {
    setLoading(true);
    try {
      const [nextProducts, nextLogs] = await Promise.all([
        getInventoryProducts(),
        getInventoryLogs(nextSelectedProductId || undefined)
      ]);
      setProducts(nextProducts);
      setLogs(nextLogs);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadInventory().catch((error) => {
      setMessage(error instanceof Error ? error.message : "Unable to load inventory.");
      setLoading(false);
    });
  }, []);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesFilter = filter === "all" || product.inventory_status === filter;
      const haystack = [productName(product), product.sku, product.category, product.category_slug].join(" ").toLowerCase();
      return matchesFilter && (!term || haystack.includes(term));
    });
  }, [products, search, filter]);

  async function handleAdjust(product: InventoryProduct) {
    const quantityChange = Number(adjustments[product.id] || 0);
    if (!quantityChange) return;

    setMessage("Updating stock...");
    await adjustProductStock(product.id, quantityChange, "Manual dashboard stock adjustment");
    setAdjustments((current) => ({ ...current, [product.id]: "" }));
    setMessage("Stock updated.");
    await loadInventory(selectedProductId);
  }

  async function handleSetting(product: InventoryProduct, payload: Parameters<typeof updateInventorySettings>[1]) {
    setMessage("Saving inventory setting...");
    await updateInventorySettings(product.id, payload);
    setMessage("Inventory setting saved.");
    await loadInventory(selectedProductId);
  }

  async function selectProduct(productId: string) {
    setSelectedProductId(productId);
    setLogs(await getInventoryLogs(productId || undefined));
  }

  return (
    <AdminGuard permission="manage_catalog">
      <h1>Inventory</h1>
      {message ? <p role="status">{message}</p> : null}

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "16px 0" }}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search product, SKU, or category"
          aria-label="Search inventory"
        />
        <button type="button" onClick={() => setFilter("all")}>All</button>
        <button type="button" onClick={() => setFilter("low_stock")}>Low Stock</button>
        <button type="button" onClick={() => setFilter("out_of_stock")}>Out of Stock</button>
        <button type="button" onClick={() => loadInventory(selectedProductId)} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <table>
        <thead>
          <tr>
            <th>Product</th>
            <th>SKU</th>
            <th>Stock</th>
            <th>Reserved</th>
            <th>Available</th>
            <th>Threshold</th>
            <th>Status</th>
            <th>Controls</th>
          </tr>
        </thead>
        <tbody>
          {visibleProducts.map((product) => (
            <tr key={product.id}>
              <td>
                <button type="button" onClick={() => selectProduct(product.id)}>
                  {productName(product)}
                </button>
              </td>
              <td>{product.sku || "-"}</td>
              <td>{product.stock}</td>
              <td>{product.reserved_stock}</td>
              <td>{product.available_stock}</td>
              <td>
                <input
                  type="number"
                  min={0}
                  defaultValue={product.low_stock_threshold}
                  onBlur={(event) => handleSetting(product, { low_stock_threshold: Math.max(0, Number(event.target.value) || 0) })}
                  aria-label={`Low stock threshold for ${productName(product)}`}
                />
              </td>
              <td>
                <strong>{statusLabel(product.inventory_status)}</strong>
              </td>
              <td>
                <input
                  type="number"
                  value={adjustments[product.id] || ""}
                  onChange={(event) => setAdjustments((current) => ({ ...current, [product.id]: event.target.value }))}
                  placeholder="+/- qty"
                  aria-label={`Adjust stock for ${productName(product)}`}
                />
                <button type="button" onClick={() => handleAdjust(product)}>Apply</button>
                <label>
                  <input
                    type="checkbox"
                    checked={product.track_inventory}
                    onChange={(event) => handleSetting(product, { track_inventory: event.target.checked })}
                  />
                  Track
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={product.allow_backorder}
                    onChange={(event) => handleSetting(product, { allow_backorder: event.target.checked })}
                  />
                  Backorder
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Inventory Logs</h2>
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Change</th>
            <th>Qty</th>
            <th>Before</th>
            <th>After</th>
            <th>Note</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => (
            <tr key={log.id}>
              <td>{new Date(log.created_at).toLocaleString()}</td>
              <td>{statusLabel(log.change_type)}</td>
              <td>{log.quantity_change}</td>
              <td>{log.stock_before ?? "-"}</td>
              <td>{log.stock_after ?? "-"}</td>
              <td>{log.note || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminGuard>
  );
}
