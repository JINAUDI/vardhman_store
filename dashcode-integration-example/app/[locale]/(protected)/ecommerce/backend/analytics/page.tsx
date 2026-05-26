"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAtomValue } from "jotai";
import { ordersAtom, productsAtom, customersAtom, totalRevenueAtom } from "@/lib/store/ecommerce-store";
import { exportToCSV } from "@/lib/store/actions";
import { DollarSign, ShoppingCart, TrendingUp, Users, Download, BarChart3, PieChart as PieChartIcon, Repeat } from "lucide-react";
import dynamic from "next/dynamic";
import { useTheme } from "next-themes";
import type { TimeFilter } from "@/lib/store/types";
import { formatCompactINR, formatINR } from "@/lib/utils/currency";
const Chart = dynamic(() => import("react-apexcharts"), { ssr: false });

type CategoryTopProduct = {
  id: string;
  name: string;
  revenue: number;
  quantity: number;
  orderCount: number;
};

type CategorySalesItem = {
  category: string;
  revenue: number;
  quantity: number;
  orderCount: number;
  percentage: number;
  topProducts: CategoryTopProduct[];
};

type CategorySalesData = {
  range: TimeFilter | "all";
  categories: CategorySalesItem[];
  topProducts: CategoryTopProduct[];
  totalRevenue: number;
  totalQuantity: number;
  orderCount: number;
  generatedAt: string;
};

const revenueExcludedStatuses = new Set(["cancelled", "canceled", "failed", "refunded", "returned"]);

function getAnalyticsRangeStart(range: TimeFilter | "all") {
  const now = new Date();

  if (range === "daily") {
    return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }

  if (range === "weekly") {
    return new Date(now.getTime() - 12 * 7 * 24 * 60 * 60 * 1000);
  }

  if (range === "monthly") {
    const start = new Date(now);
    start.setMonth(start.getMonth() - 12);
    return start;
  }

  return null;
}

const AnalyticsPage = () => {
  const orders = useAtomValue(ordersAtom);
  const products = useAtomValue(productsAtom);
  const customers = useAtomValue(customersAtom);
  const totalRevenue = useAtomValue(totalRevenueAtom);
  const { theme: mode } = useTheme();
  const [timeFilter, setTimeFilter] = useState<TimeFilter>("monthly");
  const [categorySales, setCategorySales] = useState<CategorySalesData | null>(null);
  const [categorySalesError, setCategorySalesError] = useState<string | null>(null);
  const [isCategorySalesLoading, setIsCategorySalesLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadCategorySales = async () => {
      setIsCategorySalesLoading(true);
      setCategorySalesError(null);

      try {
        const response = await fetch(`/api/analytics/category-sales?range=${timeFilter}`, {
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || !payload?.data) {
          throw new Error(payload?.message || "Unable to load category sales.");
        }

        if (!cancelled) {
          setCategorySales(payload.data as CategorySalesData);
        }
      } catch (error) {
        if (!cancelled) {
          setCategorySales(null);
          setCategorySalesError(error instanceof Error ? error.message : "Unable to load category sales.");
        }
      } finally {
        if (!cancelled) {
          setIsCategorySalesLoading(false);
        }
      }
    };

    void loadCategorySales();

    return () => {
      cancelled = true;
    };
  }, [timeFilter]);

  // Revenue by time period
  const revenueData = useMemo(() => {
    const paidOrders = orders.filter((o) => o.paymentStatus === "paid");
    if (timeFilter === "daily") {
      const days: Record<string, number> = {};
      for (let i = 29; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        days[key] = 0;
      }
      paidOrders.forEach((o) => {
        const d = new Date(o.createdAt);
        const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        if (days[key] !== undefined) days[key] += o.total;
      });
      return { labels: Object.keys(days), values: Object.values(days).map((v) => Math.round(v * 100) / 100) };
    }
    if (timeFilter === "weekly") {
      const weeks: Record<string, number> = {};
      for (let i = 11; i >= 0; i--) {
        const d = new Date(Date.now() - i * 7 * 86400000);
        const key = `Week ${12 - i}`;
        weeks[key] = 0;
      }
      const keys = Object.keys(weeks);
      paidOrders.forEach((o) => {
        const daysAgo = Math.floor((Date.now() - new Date(o.createdAt).getTime()) / 86400000);
        const weekIndex = Math.max(0, 11 - Math.floor(daysAgo / 7));
        if (weekIndex < keys.length) weeks[keys[weekIndex]] += o.total;
      });
      return { labels: keys, values: Object.values(weeks).map((v) => Math.round(v * 100) / 100) };
    }
    // Monthly
    const months: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      months[key] = 0;
    }
    paidOrders.forEach((o) => {
      const d = new Date(o.createdAt);
      const key = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      if (months[key] !== undefined) months[key] += o.total;
    });
    return { labels: Object.keys(months), values: Object.values(months).map((v) => Math.round(v * 100) / 100) };
  }, [orders, timeFilter]);

  const fallbackCategorySales = useMemo<CategorySalesData>(() => {
    const rangeStart = getAnalyticsRangeStart(timeFilter);
    const productById = new Map(products.map((product) => [product.id, product]));
    const categories = new Map<
      string,
      {
        revenue: number;
        quantity: number;
        orderIds: Set<string>;
        products: Map<string, CategoryTopProduct & { orderIds: Set<string> }>;
      }
    >();
    const allProducts = new Map<string, CategoryTopProduct & { orderIds: Set<string> }>();
    const orderIds = new Set<string>();
    let fallbackRevenue = 0;
    let fallbackQuantity = 0;

    orders.forEach((order) => {
      if (revenueExcludedStatuses.has(order.status)) return;

      const createdAt = new Date(order.createdAt);
      if (rangeStart && (!createdAt || Number.isNaN(createdAt.getTime()) || createdAt < rangeStart)) return;

      order.items.forEach((item) => {
        const product = productById.get(item.productId);
        const category = product?.category || "Other";
        const itemTotal = Number(item.total) || item.price * item.quantity || 0;

        if (!categories.has(category)) {
          categories.set(category, {
            revenue: 0,
            quantity: 0,
            orderIds: new Set(),
            products: new Map(),
          });
        }

        const categoryBucket = categories.get(category)!;
        const productKey = item.productId || item.productName;
        const applyProduct = (map: Map<string, CategoryTopProduct & { orderIds: Set<string> }>) => {
          if (!map.has(productKey)) {
            map.set(productKey, {
              id: item.productId || productKey,
              name: item.productName,
              revenue: 0,
              quantity: 0,
              orderCount: 0,
              orderIds: new Set(),
            });
          }

          const productSale = map.get(productKey)!;
          productSale.revenue += itemTotal;
          productSale.quantity += item.quantity;
          productSale.orderIds.add(order.id);
          productSale.orderCount = productSale.orderIds.size;
        };

        categoryBucket.revenue += itemTotal;
        categoryBucket.quantity += item.quantity;
        categoryBucket.orderIds.add(order.id);
        orderIds.add(order.id);
        applyProduct(categoryBucket.products);
        applyProduct(allProducts);
        fallbackRevenue += itemTotal;
        fallbackQuantity += item.quantity;
      });
    });

    const cleanProduct = (product: CategoryTopProduct & { orderIds: Set<string> }): CategoryTopProduct => ({
      id: product.id,
      name: product.name,
      revenue: Number(product.revenue.toFixed(2)),
      quantity: product.quantity,
      orderCount: product.orderIds.size,
    });

    return {
      range: timeFilter,
      categories: Array.from(categories.entries())
        .map(([category, value]) => ({
          category,
          revenue: Number(value.revenue.toFixed(2)),
          quantity: value.quantity,
          orderCount: value.orderIds.size,
          percentage: fallbackRevenue ? Number(((value.revenue / fallbackRevenue) * 100).toFixed(2)) : 0,
          topProducts: Array.from(value.products.values())
            .sort((left, right) => right.revenue - left.revenue)
            .slice(0, 4)
            .map(cleanProduct),
        }))
        .sort((left, right) => right.revenue - left.revenue),
      topProducts: Array.from(allProducts.values())
        .sort((left, right) => right.revenue - left.revenue)
        .slice(0, 8)
        .map(cleanProduct),
      totalRevenue: Number(fallbackRevenue.toFixed(2)),
      totalQuantity: fallbackQuantity,
      orderCount: orderIds.size,
      generatedAt: new Date().toISOString(),
    };
  }, [orders, products, timeFilter]);

  const activeCategorySales = categorySales ?? fallbackCategorySales;
  const topProducts = activeCategorySales.topProducts.slice(0, 5);
  const categoryRevenue = activeCategorySales.categories.slice(0, 6).map((item) => [item.category, item.revenue] as [string, number]);
  const maxCategoryRevenue = activeCategorySales.categories.reduce((max, item) => Math.max(max, item.revenue), 0);

  // Repeat customers
  const repeatCustomerRate = useMemo(() => {
    const orderCounts: Record<string, number> = {};
    orders.forEach((o) => {
      orderCounts[o.customerId] = (orderCounts[o.customerId] || 0) + 1;
    });
    const total = Object.keys(orderCounts).length;
    const repeat = Object.values(orderCounts).filter((c) => c > 1).length;
    return total > 0 ? Math.round((repeat / total) * 100) : 0;
  }, [orders]);

  const paidOrders = orders.filter((o) => o.paymentStatus === "paid");
  const avgOrderValue = paidOrders.length > 0 ? totalRevenue / paidOrders.length : 0;

  const handleExport = () => {
    exportToCSV(orders.map((o) => ({
      OrderNumber: o.orderNumber,
      Customer: o.customerName,
      Email: o.customerEmail,
      Total: o.total,
      Status: o.status,
      PaymentStatus: o.paymentStatus,
      PaymentMethod: o.paymentMethod,
      Date: new Date(o.createdAt).toLocaleDateString(),
    })), "orders_export");
  };

  // Chart Options
  const revenueChartOptions: any = {
    chart: { toolbar: { show: false }, zoom: { enabled: false } },
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 2 },
    colors: ["#4669fa"],
    fill: { type: "gradient", gradient: { shadeIntensity: 1, opacityFrom: 0.3, opacityTo: 0.05, stops: [0, 90, 100] } },
    xaxis: { categories: revenueData.labels, labels: { style: { colors: mode === "dark" ? "#94a3b8" : "#64748b", fontSize: "11px" } } },
    yaxis: { labels: { formatter: (v: number) => formatCompactINR(v), style: { colors: mode === "dark" ? "#94a3b8" : "#64748b" } } },
    tooltip: { theme: mode === "dark" ? "dark" : "light", y: { formatter: (v: number) => formatINR(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } },
    grid: { borderColor: mode === "dark" ? "#334155" : "#e2e8f0", strokeDashArray: 4 },
  };

  const pieChartOptions: any = {
    labels: categoryRevenue.map(([cat]) => cat),
    colors: ["#4669fa", "#f1595c", "#00cfe8", "#ff9f43", "#28c76f", "#7367f0"],
    legend: { position: "bottom", labels: { colors: mode === "dark" ? "#94a3b8" : "#64748b" } },
    tooltip: { y: { formatter: (v: number) => formatINR(v, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } },
    dataLabels: { enabled: false },
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-default-900">Analytics</h2>
          <p className="text-sm text-default-500 mt-1">Track your store performance</p>
        </div>
        <Button size="sm" variant="outline" className="gap-1" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { title: "Total Revenue", value: formatINR(totalRevenue, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), icon: <DollarSign className="h-5 w-5 text-success" />, bg: "bg-success/10" },
          { title: "Total Orders", value: orders.length.toString(), icon: <ShoppingCart className="h-5 w-5 text-info" />, bg: "bg-info/10" },
          { title: "Avg. Order Value", value: formatINR(avgOrderValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 }), icon: <TrendingUp className="h-5 w-5 text-primary" />, bg: "bg-primary/10" },
          { title: "Repeat Customers", value: `${repeatCustomerRate}%`, icon: <Repeat className="h-5 w-5 text-warning" />, bg: "bg-warning/10" },
        ].map((card, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-11 w-11 rounded-full flex items-center justify-center", card.bg)}>{card.icon}</div>
              <div>
                <p className="text-sm text-default-500">{card.title}</p>
                <p className="text-xl font-semibold">{card.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <CardTitle className="flex items-center gap-2"><BarChart3 className="h-5 w-5" /> Revenue Overview</CardTitle>
            <div className="flex gap-1">
              {(["daily", "weekly", "monthly"] as TimeFilter[]).map((f) => (
                <Button key={f} size="sm" variant={timeFilter === f ? "default" : "outline"} onClick={() => setTimeFilter(f)} className="capitalize text-xs">
                  {f}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Chart options={revenueChartOptions} series={[{ name: "Revenue", data: revenueData.values }]} type="area" height={350} />
        </CardContent>
      </Card>

      <div className="grid grid-cols-12 gap-5">
        {/* Top Products */}
        <div className="col-span-12 lg:col-span-7">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Selling Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {topProducts.map((p, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-default-100 flex items-center justify-center text-sm font-semibold text-default-600">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-default-800 truncate">{p.name}</p>
                      <p className="text-xs text-default-400">{p.quantity} sold</p>
                    </div>
                    <span className="text-sm font-semibold text-default-900">{formatINR(p.revenue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue by Category */}
        <div className="col-span-12 lg:col-span-5">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base flex items-center gap-2"><PieChartIcon className="h-4 w-4" /> Revenue by Category</CardTitle>
                <Badge className="bg-primary/10 text-primary">
                  {formatCompactINR(activeCategorySales.totalRevenue)}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              {activeCategorySales.categories.length > 0 ? (
                <>
                  <Chart options={pieChartOptions} series={categoryRevenue.map(([, v]) => Math.round(v * 100) / 100)} type="donut" height={260} />
                  <div className="grid grid-cols-3 gap-2 pt-2 text-center">
                    <div className="rounded-md bg-default-50 p-2">
                      <p className="text-[11px] text-default-500">Categories</p>
                      <p className="text-sm font-semibold text-default-900">{activeCategorySales.categories.length}</p>
                    </div>
                    <div className="rounded-md bg-default-50 p-2">
                      <p className="text-[11px] text-default-500">Items Sold</p>
                      <p className="text-sm font-semibold text-default-900">{activeCategorySales.totalQuantity}</p>
                    </div>
                    <div className="rounded-md bg-default-50 p-2">
                      <p className="text-[11px] text-default-500">Orders</p>
                      <p className="text-sm font-semibold text-default-900">{activeCategorySales.orderCount}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-sm text-default-400">No category sales yet</div>
              )}
              {categorySalesError && (
                <p className="mt-3 text-xs text-warning">Using local dashboard data: {categorySalesError}</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base">Sales by Category</CardTitle>
              <p className="text-xs text-default-500 mt-1">
                Revenue split with top products for Electronics, Baby Products, Health Supplements, and the rest of your catalog.
              </p>
            </div>
            <Badge className={cn("w-fit", isCategorySalesLoading ? "bg-default-100 text-default-500" : "bg-success/10 text-success")}>
              {isCategorySalesLoading ? "Refreshing" : "Live from orders"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {activeCategorySales.categories.length === 0 ? (
            <div className="py-12 text-center text-sm text-default-400">No completed category sales found for this period.</div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {activeCategorySales.categories.map((category, index) => {
                const width = maxCategoryRevenue ? Math.max(4, (category.revenue / maxCategoryRevenue) * 100) : 0;

                return (
                  <div key={category.category} className="rounded-lg border border-default-200 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {index + 1}
                          </span>
                          <h3 className="truncate text-sm font-semibold text-default-900">{category.category}</h3>
                        </div>
                        <p className="mt-1 text-xs text-default-500">
                          {category.quantity} item{category.quantity === 1 ? "" : "s"} sold across {category.orderCount} order{category.orderCount === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-default-900">
                          {formatINR(category.revenue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                        <p className="text-xs text-default-500">{category.percentage}% share</p>
                      </div>
                    </div>

                    <div className="mt-4 h-2 rounded-full bg-default-100">
                      <div className="h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
                    </div>

                    <div className="mt-4 space-y-2">
                      <p className="text-xs font-medium uppercase text-default-400">Top products</p>
                      {category.topProducts.length === 0 ? (
                        <p className="text-xs text-default-400">No product-level sales in this category.</p>
                      ) : (
                        category.topProducts.map((product) => (
                          <div key={`${category.category}-${product.id}`} className="flex items-center justify-between gap-3 rounded-md bg-default-50 px-3 py-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-default-800">{product.name}</p>
                              <p className="text-xs text-default-500">{product.quantity} sold</p>
                            </div>
                            <p className="shrink-0 text-sm font-semibold text-default-900">
                              {formatCompactINR(product.revenue)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsPage;
