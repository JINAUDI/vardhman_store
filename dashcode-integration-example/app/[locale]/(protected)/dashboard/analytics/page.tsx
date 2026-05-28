import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

type JsonRecord = Record<string, unknown>;

type MetricCardProps = {
  title: string;
  value: string;
  helper?: string;
  tone?: "info" | "success" | "warning" | "primary";
};

type MonthlyRevenue = {
  key: string;
  label: string;
  total: number;
  orders: number;
};

type DashboardData = {
  totalRevenue: number;
  orderCount: number;
  productsSold: number;
  productCount: number;
  customerCount: number;
  currentMonthRevenue: number;
  previousMonthRevenue: number;
  recentOrders: JsonRecord[];
  monthlyRevenue: MonthlyRevenue[];
  statusCounts: Record<string, number>;
  shiprocketCounts: Record<string, number>;
};

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback;
}

function readNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function formatInr(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: unknown) {
  const date = value ? new Date(String(value)) : null;
  if (!date || Number.isNaN(date.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function getOrderStatus(order: JsonRecord) {
  return readString(order.order_status || order.status || "pending").toLowerCase();
}

function isRevenueOrder(order: JsonRecord) {
  return !["cancelled", "refunded", "returned"].includes(getOrderStatus(order));
}

function getGrowthLabel(current: number, previous: number) {
  if (previous <= 0 && current <= 0) return "0% vs previous month";
  if (previous <= 0) return "New revenue this month";

  const growth = ((current - previous) / previous) * 100;
  return `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}% vs previous month`;
}

function getMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildMonthlyRevenue(orders: JsonRecord[]) {
  const monthFormatter = new Intl.DateTimeFormat("en-IN", { month: "short" });
  const months: MonthlyRevenue[] = [];
  const start = new Date();
  start.setDate(1);

  for (let offset = 5; offset >= 0; offset -= 1) {
    const date = new Date(start);
    date.setMonth(start.getMonth() - offset);
    months.push({
      key: getMonthKey(date),
      label: monthFormatter.format(date),
      total: 0,
      orders: 0,
    });
  }

  const monthMap = new Map(months.map((month) => [month.key, month]));

  orders.forEach((order) => {
    if (!isRevenueOrder(order)) return;
    const date = new Date(String(order.created_at || order.createdAt || ""));
    if (Number.isNaN(date.getTime())) return;

    const month = monthMap.get(getMonthKey(date));
    if (!month) return;

    month.total += readNumber(order.total);
    month.orders += 1;
  });

  return months;
}

function getCurrentAndPreviousMonthRevenue(orders: JsonRecord[]) {
  const now = new Date();
  const currentKey = getMonthKey(now);
  const previous = new Date(now);
  previous.setMonth(now.getMonth() - 1);
  const previousKey = getMonthKey(previous);

  return orders.reduce<{ current: number; previous: number }>(
    (summary, order) => {
      if (!isRevenueOrder(order)) return summary;
      const date = new Date(String(order.created_at || order.createdAt || ""));
      if (Number.isNaN(date.getTime())) return summary;

      const key = getMonthKey(date);
      if (key === currentKey) summary.current += readNumber(order.total);
      if (key === previousKey) summary.previous += readNumber(order.total);
      return summary;
    },
    { current: 0, previous: 0 }
  );
}

function countStatuses(orders: JsonRecord[]) {
  return orders.reduce<Record<string, number>>((counts, order) => {
    const status = getOrderStatus(order);
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

function countShiprocketStatuses(orders: JsonRecord[]) {
  return orders.reduce<Record<string, number>>((counts, order) => {
    const status = readString(order.shiprocket_sync_status, "not synced").toLowerCase();
    counts[status] = (counts[status] || 0) + 1;
    return counts;
  }, {});
}

async function getCount(tableName: string) {
  try {
    const supabase = createSupabaseAdminClient();
    const { count, error } = await supabase
      .from(tableName)
      .select("*", { count: "exact", head: true });

    if (error) throw error;
    return count || 0;
  } catch {
    return 0;
  }
}

async function getDashboardData(): Promise<DashboardData> {
  if (!isSupabaseConfigured()) {
    return {
      totalRevenue: 0,
      orderCount: 0,
      productsSold: 0,
      productCount: 0,
      customerCount: 0,
      currentMonthRevenue: 0,
      previousMonthRevenue: 0,
      recentOrders: [],
      monthlyRevenue: buildMonthlyRevenue([]),
      statusCounts: {},
      shiprocketCounts: {},
    };
  }

  const supabase = createSupabaseAdminClient();
  const [ordersResult, itemsResult, productCountRaw, customerCountRaw] = await Promise.all([
    supabase.from("orders").select("*").order("created_at", { ascending: false }).limit(500),
    supabase.from("order_items").select("*").limit(2000),
    getCount("products"),
    getCount("customers"),
  ]);

  const orders = (ordersResult.data || []) as JsonRecord[];
  const items = (itemsResult.data || []) as JsonRecord[];
  const productCount = Number(productCountRaw) || 0;
  const customerCount = Number(customerCountRaw) || 0;
  const totalRevenue = orders
    .filter(isRevenueOrder)
    .reduce<number>((sum, order) => sum + readNumber(order.total), 0);
  const productsSold = items.reduce<number>((sum, item) => sum + Math.max(0, readNumber(item.quantity)), 0);
  const { current, previous } = getCurrentAndPreviousMonthRevenue(orders);
  const distinctCustomerEmails = new Set(
    orders
      .map((order) => readString(order.customer_email || (order.customer as JsonRecord | undefined)?.email).toLowerCase())
      .filter(Boolean)
  );

  return {
    totalRevenue,
    orderCount: orders.length,
    productsSold,
    productCount,
    customerCount: customerCount || distinctCustomerEmails.size,
    currentMonthRevenue: current,
    previousMonthRevenue: previous,
    recentOrders: orders.slice(0, 8),
    monthlyRevenue: buildMonthlyRevenue(orders),
    statusCounts: countStatuses(orders),
    shiprocketCounts: countShiprocketStatuses(orders),
  };
}

function MetricCard({ title, value, helper, tone = "info" }: MetricCardProps) {
  const toneClass = {
    info: "bg-info/10",
    success: "bg-success/10",
    warning: "bg-warning/10",
    primary: "bg-primary/10",
  }[tone];

  return (
    <Card className={cn("border-none shadow-none", toneClass)}>
      <CardContent className="p-4">
        <div className="text-default-800 text-sm mb-2 font-medium">{title}</div>
        <div className="text-default-900 text-2xl font-semibold">{value}</div>
        {helper && <div className="text-default-500 text-xs mt-2">{helper}</div>}
      </CardContent>
    </Card>
  );
}

function MonthlyRevenueBars({ months }: { months: MonthlyRevenue[] }) {
  const maxRevenue = Math.max(...months.map((month) => month.total), 0);

  return (
    <div className="space-y-4">
      {months.map((month) => {
        const percentage = maxRevenue > 0 ? Math.round((month.total / maxRevenue) * 100) : 0;

        return (
          <div key={month.key} className="grid grid-cols-[52px_1fr_120px] items-center gap-3">
            <div className="text-xs text-default-500">{month.label}</div>
            <div className="h-3 rounded bg-default-100 overflow-hidden">
              <div
                className="h-full rounded bg-info"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <div className="text-xs text-default-600 text-end">
              {formatInr(month.total)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatusSummary({ title, counts }: { title: string; counts: Record<string, number> }) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length ? (
          <div className="space-y-3">
            {entries.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between gap-3">
                <span className="text-sm text-default-600 capitalize">{status.replace(/_/g, " ")}</span>
                <span className="text-sm font-medium text-default-900">{formatNumber(count)}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-default-500">No records yet.</div>
        )}
      </CardContent>
    </Card>
  );
}

async function DashboardPage() {
  const data = await getDashboardData();
  const growthLabel = getGrowthLabel(data.currentMonthRevenue, data.previousMonthRevenue);

  return (
    <div>
      <div className="mb-5">
        <Card>
          <CardContent className="p-4">
            <div className="grid md:grid-cols-4 gap-4">
              <MetricCard
                title="Total Revenue"
                value={formatInr(data.totalRevenue)}
                helper={growthLabel}
                tone="info"
              />
              <MetricCard
                title="Products Sold"
                value={formatNumber(data.productsSold)}
                helper={`${formatNumber(data.orderCount)} orders`}
                tone="warning"
              />
              <MetricCard
                title="Customers"
                value={formatNumber(data.customerCount)}
                helper="From live customer/order data"
                tone="success"
              />
              <MetricCard
                title="Products"
                value={formatNumber(data.productCount)}
                helper="Visible and draft catalog rows"
                tone="primary"
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <div className="lg:col-span-8 col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Revenue Report</CardTitle>
            </CardHeader>
            <CardContent>
              <MonthlyRevenueBars months={data.monthlyRevenue} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 col-span-12">
          <StatusSummary title="Order Status" counts={data.statusCounts} />
        </div>

        <div className="lg:col-span-8 col-span-12">
          <Card>
            <CardHeader>
              <CardTitle>Recent Orders</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-default-200">
                    <TableHead>Order</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentOrders.length ? (
                    data.recentOrders.map((order) => (
                      <TableRow key={readString(order.id || order.order_number || order.tracking_id)}>
                        <TableCell className="normal-case">
                          {readString(order.tracking_id || order.order_number || order.id, "-")}
                        </TableCell>
                        <TableCell className="normal-case">
                          <div className="font-medium text-default-700">
                            {readString(order.customer_name, "Customer")}
                          </div>
                          <div className="text-xs text-default-500">
                            {readString(order.customer_email, "-")}
                          </div>
                        </TableCell>
                        <TableCell>{getOrderStatus(order).replace(/_/g, " ")}</TableCell>
                        <TableCell>{formatInr(readNumber(order.total))}</TableCell>
                        <TableCell>{formatDate(order.created_at)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center">
                        No orders yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 col-span-12">
          <StatusSummary title="Shiprocket Sync" counts={data.shiprocketCounts} />
        </div>
      </div>
    </div>
  );
}

export default DashboardPage;
