"use client";

import { useEffect, useMemo, useState } from "react";
import AdminGuard from "../../components/AdminGuard";
import {
  getBusinessAnalytics,
  type AnalyticsDateRange,
  type AnalyticsEvent,
  type AnalyticsOrder,
  type AnalyticsOrderItem,
  type AnalyticsProduct,
  type BusinessAnalyticsData
} from "../../lib/analytics";

type RangeMode = "today" | "7d" | "30d" | "custom";

type CountRow = {
  label: string;
  value: number;
  amount?: number;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(Number(value) || 0);
}

function formatPercent(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(1) : "0.0"}%`;
}

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function endOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(23, 59, 59, 999);
  return nextDate;
}

function rangeForMode(mode: RangeMode, customStart?: string, customEnd?: string): AnalyticsDateRange {
  const now = new Date();
  if (mode === "today") {
    return { start: startOfDay(now).toISOString(), end: endOfDay(now).toISOString() };
  }
  if (mode === "custom" && customStart && customEnd) {
    return { start: startOfDay(new Date(customStart)).toISOString(), end: endOfDay(new Date(customEnd)).toISOString() };
  }

  const days = mode === "7d" ? 7 : 30;
  const start = startOfDay(new Date(now));
  start.setDate(start.getDate() - days + 1);
  return { start: start.toISOString(), end: endOfDay(now).toISOString() };
}

function dayKey(value?: string | null) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 10);
}

function numberValue(value: unknown) {
  const nextValue = Number(value);
  return Number.isFinite(nextValue) ? nextValue : 0;
}

function eventName(event: AnalyticsEvent) {
  return event.event_name || event.event_type || "";
}

function isValidOrder(order: AnalyticsOrder) {
  const statusText = [order.status, order.order_status, order.fulfillment_status, order.refund_status].join(" ").toLowerCase();
  return !/(cancelled|canceled|refunded|returned|failed)/.test(statusText);
}

function orderTotal(order: AnalyticsOrder) {
  return numberValue(order.total || order.subtotal);
}

function orderCustomerKey(order: AnalyticsOrder) {
  return order.auth_user_id || order.customer_id || String(order.customer_email || "").toLowerCase();
}

function productName(product?: AnalyticsProduct, fallback?: string | null) {
  return product?.title || product?.name || product?.sku || fallback || "Product";
}

function countBy<T>(items: T[], getKey: (item: T) => string, getAmount?: (item: T) => number): CountRow[] {
  const rows = new Map<string, CountRow>();
  items.forEach((item) => {
    const label = getKey(item).trim();
    if (!label) return;
    const current = rows.get(label) || { label, value: 0, amount: 0 };
    current.value += 1;
    current.amount = numberValue(current.amount) + (getAmount ? getAmount(item) : 0);
    rows.set(label, current);
  });
  return Array.from(rows.values()).sort((left, right) => numberValue(right.amount || right.value) - numberValue(left.amount || left.value));
}

function uniqueCount(values: string[]) {
  return new Set(values.filter(Boolean)).size;
}

function itemRevenue(item: AnalyticsOrderItem) {
  return numberValue(item.total) || numberValue(item.price) * numberValue(item.quantity || 1);
}

function getProductFromItem(item: AnalyticsOrderItem, productsById: Map<string, AnalyticsProduct>) {
  return item.product_id ? productsById.get(item.product_id) : undefined;
}

function buildDailyRows(range: AnalyticsDateRange, orders: AnalyticsOrder[]) {
  const rows = new Map<string, { label: string; revenue: number; orders: number; aov: number }>();
  const start = startOfDay(new Date(range.start));
  const end = startOfDay(new Date(range.end));

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const label = toDateInput(cursor);
    rows.set(label, { label, revenue: 0, orders: 0, aov: 0 });
  }

  orders.filter(isValidOrder).forEach((order) => {
    const label = dayKey(order.created_at);
    const row = rows.get(label) || { label, revenue: 0, orders: 0, aov: 0 };
    row.revenue += orderTotal(order);
    row.orders += 1;
    rows.set(label, row);
  });

  return Array.from(rows.values()).map((row) => ({
    ...row,
    aov: row.orders ? row.revenue / row.orders : 0
  }));
}

function LineChart({ data, valueKey, valueLabel }: { data: Array<Record<string, number | string>>; valueKey: string; valueLabel: string }) {
  const width = 720;
  const height = 220;
  const padding = 28;
  const maxValue = Math.max(1, ...data.map((item) => numberValue(item[valueKey])));
  const points = data.map((item, index) => {
    const x = padding + (data.length <= 1 ? 0 : (index / (data.length - 1)) * (width - padding * 2));
    const y = height - padding - (numberValue(item[valueKey]) / maxValue) * (height - padding * 2);
    return `${x},${y}`;
  }).join(" ");

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={valueLabel} style={{ minWidth: 520, width: "100%", height: 240 }}>
        <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#d0d5dd" />
        <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#d0d5dd" />
        <polyline fill="none" stroke="#ff7a00" strokeWidth="3" points={points} />
        {data.map((item, index) => {
          const x = padding + (data.length <= 1 ? 0 : (index / (data.length - 1)) * (width - padding * 2));
          const y = height - padding - (numberValue(item[valueKey]) / maxValue) * (height - padding * 2);
          return <circle key={`${item.label}-${index}`} cx={x} cy={y} r="4" fill="#ff7a00" />;
        })}
      </svg>
    </div>
  );
}

function BarChart({ rows, valueLabel, money = false }: { rows: CountRow[]; valueLabel: string; money?: boolean }) {
  const maxValue = Math.max(1, ...rows.map((row) => numberValue(row.amount || row.value)));
  return (
    <div aria-label={valueLabel} style={{ display: "grid", gap: 10 }}>
      {rows.slice(0, 8).map((row) => {
        const value = numberValue(row.amount || row.value);
        return (
          <div key={row.label}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span>{row.label}</span>
              <strong>{money ? formatMoney(value) : value}</strong>
            </div>
            <div style={{ background: "#f2f4f7", borderRadius: 999, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${Math.max(4, (value / maxValue) * 100)}%`, height: "100%", background: "#ff7a00" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetricCard({ label, value, detail }: { label: string; value: string | number; detail?: string }) {
  return (
    <div style={{ border: "1px solid #eaecf0", borderRadius: 8, padding: 16, background: "#fff" }}>
      <div style={{ color: "#667085", fontSize: 13 }}>{label}</div>
      <strong style={{ display: "block", fontSize: 26, marginTop: 6 }}>{value}</strong>
      {detail ? <span style={{ color: "#667085", fontSize: 12 }}>{detail}</span> : null}
    </div>
  );
}

export default function AnalyticsPage() {
  const [mode, setMode] = useState<RangeMode>("30d");
  const [customStart, setCustomStart] = useState(toDateInput(new Date(Date.now() - 29 * 24 * 60 * 60 * 1000)));
  const [customEnd, setCustomEnd] = useState(toDateInput(new Date()));
  const [data, setData] = useState<BusinessAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const range = useMemo(() => rangeForMode(mode, customStart, customEnd), [customEnd, customStart, mode]);

  async function loadAnalytics() {
    setLoading(true);
    setError("");
    try {
      setData(await getBusinessAnalytics(range));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load analytics.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, [range.start, range.end]);

  const metrics = useMemo(() => {
    const orders = data?.orders || [];
    const validOrders = orders.filter(isValidOrder);
    const events = data?.events || [];
    const wishlist = data?.wishlist || [];
    const revenue = validOrders.reduce((sum, order) => sum + orderTotal(order), 0);
    const sessions = uniqueCount(events.map((event) => event.session_id || ""));
    const pageViewSessions = uniqueCount(events.filter((event) => eventName(event) === "page_view").map((event) => event.session_id || ""));
    const orderCreatedEvents = events.filter((event) => eventName(event) === "order_created").length || validOrders.length;
    const cartSessions = new Set(events.filter((event) => ["add_to_cart", "checkout_start"].includes(eventName(event))).map((event) => event.session_id || "").filter(Boolean));
    const purchasedSessions = new Set(events.filter((event) => eventName(event) === "order_created").map((event) => event.session_id || "").filter(Boolean));
    const abandonedSessions = Array.from(cartSessions).filter((sessionId) => !purchasedSessions.has(sessionId));

    return {
      revenue,
      orders: validOrders.length,
      aov: validOrders.length ? revenue / validOrders.length : 0,
      conversionRate: pageViewSessions ? (orderCreatedEvents / pageViewSessions) * 100 : 0,
      abandonedCarts: abandonedSessions.length,
      abandonedRate: cartSessions.size ? (abandonedSessions.length / cartSessions.size) * 100 : 0,
      wishlistAdds: events.filter((event) => eventName(event) === "wishlist_add").length || wishlist.length,
      sessions
    };
  }, [data]);

  const insights = useMemo(() => {
    const orders = (data?.orders || []).filter(isValidOrder);
    const orderIds = new Set(orders.map((order) => order.id));
    const orderItems = (data?.orderItems || []).filter((item) => item.order_id && orderIds.has(item.order_id));
    const productsById = new Map((data?.products || []).map((product) => [product.id, product]));
    const events = data?.events || [];
    const wishlist = data?.wishlist || [];
    const daily = buildDailyRows(data?.range || range, orders);
    const historicalValidOrders = (data?.historicalOrders || []).filter(isValidOrder);
    const ordersByCustomer = countBy(historicalValidOrders, orderCustomerKey);
    const periodCustomerKeys = new Set(orders.map(orderCustomerKey).filter(Boolean));
    const returningCustomers = Array.from(periodCustomerKeys).filter((key) => {
      const customerOrders = historicalValidOrders.filter((order) => orderCustomerKey(order) === key);
      const firstOrder = customerOrders.sort((left, right) => new Date(left.created_at || 0).getTime() - new Date(right.created_at || 0).getTime())[0];
      return firstOrder && new Date(firstOrder.created_at || 0).getTime() < new Date(range.start).getTime();
    });
    const repeatCustomers = ordersByCustomer.filter((row) => row.value > 1).length;
    const totalOrderingCustomers = ordersByCustomer.length;
    const topProductRevenue = countBy(orderItems, (item) => productName(getProductFromItem(item, productsById), item.product_name), itemRevenue);
    const topProductQuantity = countBy(orderItems, (item) => productName(getProductFromItem(item, productsById), item.product_name), (item) => numberValue(item.quantity || 1));
    const topViewedProducts = countBy(
      events.filter((event) => eventName(event) === "product_view"),
      (event) => productName(event.product_id ? productsById.get(event.product_id) : undefined, String(event.metadata?.product_name || event.product_id || "Product"))
    );
    const topWishlistedProducts = countBy(wishlist, (row) => productName(row.product_id ? productsById.get(row.product_id) : undefined, row.product_id));
    const abandonedSessionIds = new Set(
      events.filter((event) => ["add_to_cart", "checkout_start"].includes(eventName(event))).map((event) => event.session_id || "").filter(Boolean)
    );
    events.filter((event) => eventName(event) === "order_created").forEach((event) => abandonedSessionIds.delete(event.session_id || ""));
    const abandonedProducts = countBy(
      events.filter((event) => eventName(event) === "add_to_cart" && abandonedSessionIds.has(event.session_id || "")),
      (event) => productName(event.product_id ? productsById.get(event.product_id) : undefined, String(event.metadata?.product_name || event.product_id || "Product"))
    );
    const paymentSplit = countBy(orders, (order) => order.payment_method || order.payment_status || "Unknown", orderTotal);
    const statusSplit = countBy(orders, (order) => order.order_status || order.status || "Unknown");
    const categorySales = countBy(orderItems, (item) => getProductFromItem(item, productsById)?.category || "Uncategorized", itemRevenue);
    const wishlistProductIds = new Set(wishlist.map((row) => row.product_id).filter(Boolean));
    const purchasedWishlistedProductIds = new Set(orderItems.map((item) => item.product_id).filter((productId) => productId && wishlistProductIds.has(productId)));
    const eventsByName = countBy(events, eventName);
    const productViews = eventsByName.find((row) => row.label === "product_view")?.value || 0;
    const addToCarts = eventsByName.find((row) => row.label === "add_to_cart")?.value || 0;
    const checkoutStarts = eventsByName.find((row) => row.label === "checkout_start")?.value || 0;
    const orderCreated = eventsByName.find((row) => row.label === "order_created")?.value || orders.length;

    return {
      daily,
      topProductRevenue,
      topProductQuantity,
      topViewedProducts,
      topWishlistedProducts,
      abandonedProducts,
      paymentSplit,
      statusSplit,
      categorySales,
      newCustomers: Math.max(0, periodCustomerKeys.size - returningCustomers.length),
      returningCustomers: returningCustomers.length,
      repeatPurchaseRate: totalOrderingCustomers ? (repeatCustomers / totalOrderingCustomers) * 100 : 0,
      clv: totalOrderingCustomers ? historicalValidOrders.reduce((sum, order) => sum + orderTotal(order), 0) / totalOrderingCustomers : 0,
      wishlistToPurchaseRate: wishlistProductIds.size ? (purchasedWishlistedProductIds.size / wishlistProductIds.size) * 100 : 0,
      funnel: {
        productViews,
        addToCarts,
        checkoutStarts,
        orderCreated,
        viewToCart: productViews ? (addToCarts / productViews) * 100 : 0,
        cartToCheckout: addToCarts ? (checkoutStarts / addToCarts) * 100 : 0,
        checkoutToPurchase: checkoutStarts ? (orderCreated / checkoutStarts) * 100 : 0
      }
    };
  }, [data, range]);

  return (
    <AdminGuard permission="view_orders">
      <h1>Analytics</h1>
      <p>Revenue, conversion, retention, wishlist, and product performance from Supabase storefront data.</p>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", margin: "16px 0" }}>
        {(["today", "7d", "30d", "custom"] as RangeMode[]).map((nextMode) => (
          <button key={nextMode} type="button" onClick={() => setMode(nextMode)} aria-pressed={mode === nextMode}>
            {nextMode === "today" ? "Today" : nextMode === "7d" ? "7 Days" : nextMode === "30d" ? "30 Days" : "Custom"}
          </button>
        ))}
        {mode === "custom" ? (
          <>
            <label>Start<input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
            <label>End<input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
          </>
        ) : null}
        <button type="button" onClick={() => loadAnalytics()} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</button>
      </div>

      {error ? <p role="alert" style={{ color: "#b42318" }}>{error}</p> : null}
      {loading ? <p>Loading analytics...</p> : null}
      {!loading && !error && data && data.orders.length === 0 && data.events.length === 0 ? <p>No analytics data is available for this date range yet.</p> : null}

      <section style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", margin: "16px 0" }}>
        <MetricCard label="Total Revenue" value={formatMoney(metrics.revenue)} />
        <MetricCard label="Total Orders" value={metrics.orders} />
        <MetricCard label="Average Order Value" value={formatMoney(metrics.aov)} />
        <MetricCard label="Conversion Rate" value={formatPercent(metrics.conversionRate)} detail={`${metrics.sessions} tracked sessions`} />
        <MetricCard label="Abandoned Carts" value={metrics.abandonedCarts} detail={`${formatPercent(metrics.abandonedRate)} abandonment`} />
        <MetricCard label="Wishlist Adds" value={metrics.wishlistAdds} />
      </section>

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", marginBottom: 24 }}>
        <div style={{ border: "1px solid #eaecf0", borderRadius: 8, padding: 16 }}>
          <h2>Revenue by Day</h2>
          <LineChart data={insights.daily as unknown as Array<Record<string, number | string>>} valueKey="revenue" valueLabel="Revenue by day" />
        </div>
        <div style={{ border: "1px solid #eaecf0", borderRadius: 8, padding: 16 }}>
          <h2>Orders by Day</h2>
          <BarChart rows={insights.daily.map((row) => ({ label: row.label, value: row.orders }))} valueLabel="Orders by day" />
        </div>
      </section>

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginBottom: 24 }}>
        <div style={{ border: "1px solid #eaecf0", borderRadius: 8, padding: 16 }}>
          <h2>Top Products by Revenue</h2>
          <BarChart rows={insights.topProductRevenue} valueLabel="Top products by revenue" money />
        </div>
        <div style={{ border: "1px solid #eaecf0", borderRadius: 8, padding: 16 }}>
          <h2>Top Products by Quantity</h2>
          <BarChart rows={insights.topProductQuantity} valueLabel="Top products by quantity" />
        </div>
        <div style={{ border: "1px solid #eaecf0", borderRadius: 8, padding: 16 }}>
          <h2>Top Viewed Products</h2>
          <BarChart rows={insights.topViewedProducts} valueLabel="Top viewed products" />
        </div>
        <div style={{ border: "1px solid #eaecf0", borderRadius: 8, padding: 16 }}>
          <h2>Top Wishlisted Products</h2>
          <BarChart rows={insights.topWishlistedProducts} valueLabel="Top wishlisted products" />
        </div>
      </section>

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", marginBottom: 24 }}>
        <div style={{ border: "1px solid #eaecf0", borderRadius: 8, padding: 16 }}>
          <h2>Conversion Funnel</h2>
          <table>
            <tbody>
              <tr><td>Product views</td><td>{insights.funnel.productViews}</td><td></td></tr>
              <tr><td>Add to cart</td><td>{insights.funnel.addToCarts}</td><td>{formatPercent(insights.funnel.viewToCart)} view to cart</td></tr>
              <tr><td>Checkout starts</td><td>{insights.funnel.checkoutStarts}</td><td>{formatPercent(insights.funnel.cartToCheckout)} cart to checkout</td></tr>
              <tr><td>Orders created</td><td>{insights.funnel.orderCreated}</td><td>{formatPercent(insights.funnel.checkoutToPurchase)} checkout to purchase</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ border: "1px solid #eaecf0", borderRadius: 8, padding: 16 }}>
          <h2>Customer Retention</h2>
          <table>
            <tbody>
              <tr><td>New customers</td><td>{insights.newCustomers}</td></tr>
              <tr><td>Returning customers</td><td>{insights.returningCustomers}</td></tr>
              <tr><td>Repeat purchase rate</td><td>{formatPercent(insights.repeatPurchaseRate)}</td></tr>
              <tr><td>Estimated customer lifetime value</td><td>{formatMoney(insights.clv)}</td></tr>
            </tbody>
          </table>
        </div>
        <div style={{ border: "1px solid #eaecf0", borderRadius: 8, padding: 16 }}>
          <h2>Abandoned Cart Products</h2>
          <BarChart rows={insights.abandonedProducts} valueLabel="Products most often abandoned" />
        </div>
      </section>

      <section style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div style={{ border: "1px solid #eaecf0", borderRadius: 8, padding: 16 }}>
          <h2>Sales by Category</h2>
          <BarChart rows={insights.categorySales} valueLabel="Sales by category" money />
        </div>
        <div style={{ border: "1px solid #eaecf0", borderRadius: 8, padding: 16 }}>
          <h2>Sales by Payment Method</h2>
          <BarChart rows={insights.paymentSplit} valueLabel="Sales by payment method" money />
        </div>
        <div style={{ border: "1px solid #eaecf0", borderRadius: 8, padding: 16 }}>
          <h2>Sales by Order Status</h2>
          <BarChart rows={insights.statusSplit} valueLabel="Sales by order status" />
        </div>
        <div style={{ border: "1px solid #eaecf0", borderRadius: 8, padding: 16 }}>
          <h2>Wishlist Conversion</h2>
          <MetricCard label="Wishlist to Purchase" value={formatPercent(insights.wishlistToPurchaseRate)} detail={`${data?.wishlist.length || 0} wishlist rows in range`} />
        </div>
      </section>
    </AdminGuard>
  );
}
