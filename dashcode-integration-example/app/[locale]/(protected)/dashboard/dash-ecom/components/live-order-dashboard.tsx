"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Bell,
  CheckCircle2,
  Clock3,
  IndianRupee,
  PackageCheck,
  RefreshCw,
  ShoppingBag,
  XCircle,
} from "lucide-react";
import { Link } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/utils/currency";
import { useLiveOrderDashboard } from "@/hooks/use-live-order-dashboard";

type MetricTone = "info" | "warning" | "success" | "destructive" | "primary" | "default";

const toneClasses: Record<MetricTone, { icon: string; surface: string; text: string; badge: string }> = {
  info: {
    icon: "text-info",
    surface: "bg-info/10",
    text: "text-info",
    badge: "bg-info/10 text-info",
  },
  warning: {
    icon: "text-warning",
    surface: "bg-warning/10",
    text: "text-warning",
    badge: "bg-warning/10 text-warning",
  },
  success: {
    icon: "text-success",
    surface: "bg-success/10",
    text: "text-success",
    badge: "bg-success/10 text-success",
  },
  destructive: {
    icon: "text-destructive",
    surface: "bg-destructive/10",
    text: "text-destructive",
    badge: "bg-destructive/10 text-destructive",
  },
  primary: {
    icon: "text-primary",
    surface: "bg-primary/10",
    text: "text-primary",
    badge: "bg-primary/10 text-primary",
  },
  default: {
    icon: "text-default-600",
    surface: "bg-default-100",
    text: "text-default-700",
    badge: "bg-default-100 text-default-700",
  },
};

function formatTime(value?: string | null) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(date);
}

function statusTone(status: string): MetricTone {
  if (status === "delivered") return "success";
  if (status === "cancelled" || status === "canceled") return "destructive";
  if (status === "pending") return "warning";
  if (status === "shipped" || status === "out_for_delivery") return "info";
  return "primary";
}

function MetricTile({
  title,
  value,
  icon,
  tone,
  href,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  tone: MetricTone;
  href?: string;
}) {
  const content = (
    <div className="h-full rounded-md border border-default-200 bg-background/60 p-4 transition-colors hover:border-default-300 hover:bg-default-50/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-2">
          <div className="text-[11px] font-semibold uppercase leading-4 text-default-500">{title}</div>
          <div className="truncate text-2xl font-semibold leading-none text-default-900">{value}</div>
        </div>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-md", toneClasses[tone].surface)}>
          {icon}
        </div>
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}

function FeedPanel({
  title,
  badge,
  children,
}: {
  title: string;
  badge: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-default-200 bg-background/40">
      <div className="flex min-h-12 items-center justify-between gap-3 border-b border-default-200 px-4 py-3">
        <div className="text-sm font-semibold text-default-900">{title}</div>
        {badge}
      </div>
      <div className="space-y-2 p-3">{children}</div>
    </div>
  );
}

const LiveOrderDashboard = () => {
  const { data, error, isLoading, refresh } = useLiveOrderDashboard();

  const metrics = [
    {
      title: "New Orders Today",
      value: data.newOrdersToday.toString(),
      icon: <ShoppingBag className={cn("h-5 w-5", toneClasses.info.icon)} />,
      tone: "info" as const,
      href: "/ecommerce/backend/order-list",
    },
    {
      title: "Pending Orders",
      value: data.pendingOrders.toString(),
      icon: <Clock3 className={cn("h-5 w-5", toneClasses.warning.icon)} />,
      tone: "warning" as const,
      href: "/ecommerce/backend/order-list",
    },
    {
      title: "Delivered",
      value: data.deliveredOrders.toString(),
      icon: <CheckCircle2 className={cn("h-5 w-5", toneClasses.success.icon)} />,
      tone: "success" as const,
      href: "/ecommerce/backend/order-list",
    },
    {
      title: "Cancelled",
      value: data.cancelledOrders.toString(),
      icon: <XCircle className={cn("h-5 w-5", toneClasses.destructive.icon)} />,
      tone: "destructive" as const,
      href: "/ecommerce/backend/order-list",
    },
    {
      title: "Today's Revenue",
      value: formatINR(data.todayRevenue),
      icon: <IndianRupee className={cn("h-5 w-5", toneClasses.primary.icon)} />,
      tone: "primary" as const,
      href: "/ecommerce/backend/analytics",
    },
    {
      title: "Unread Notifications",
      value: data.unreadNotifications.toString(),
      icon: <Bell className={cn("h-5 w-5", toneClasses.default.icon)} />,
      tone: "default" as const,
    },
  ];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-3 border-b border-default-200 bg-default-50/30">
        <div className="flex-1">
          <CardTitle>Live Order Dashboard</CardTitle>
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          color="secondary"
          aria-label="Refresh live order dashboard"
          onClick={() => void refresh()}
        >
          <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6 p-5">
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {metrics.map((metric) => (
            <MetricTile key={metric.title} {...metric} />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <FeedPanel
            title="Latest Orders"
            badge={
              <Badge color="secondary" className="rounded-full">
                {data.latestOrders.length}
              </Badge>
            }
          >
              {isLoading && !data.latestOrders.length ? (
                <div className="px-2 py-6 text-sm text-default-500">Loading orders...</div>
              ) : data.latestOrders.length ? (
                data.latestOrders.map((order) => {
                  const tone = statusTone(order.status);

                  return (
                    <Link
                      key={order.id}
                      href={`/ecommerce/backend/order-details?id=${order.id}`}
                      className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-default-200 bg-transparent px-4 py-3 transition-colors hover:border-default-300 hover:bg-default-50/60"
                    >
                      <div className={cn("flex h-10 w-10 items-center justify-center rounded-md", toneClasses[tone].surface)}>
                        <PackageCheck className={cn("h-4 w-4", toneClasses[tone].icon)} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-default-900">{order.orderNumber}</div>
                        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-default-500">
                          <span className="truncate">{order.customerName}</span>
                          <span className="h-1 w-1 rounded-full bg-default-300" />
                          <span className="shrink-0">{formatTime(order.createdAt)}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-default-900">{formatINR(order.total)}</div>
                        <Badge className={cn("mt-1 rounded-full border-none", toneClasses[tone].badge)}>
                          {order.status.replace(/_/g, " ")}
                        </Badge>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <div className="px-2 py-6 text-sm text-default-500">No orders yet</div>
              )}
          </FeedPanel>

          <FeedPanel
            title="Unread And Recent Alerts"
            badge={
              <Badge color={data.unreadNotifications > 0 ? "destructive" : "secondary"} className="rounded-full">
                {data.unreadNotifications} unread
              </Badge>
            }
          >
              {isLoading && !data.latestNotifications.length ? (
                <div className="px-2 py-6 text-sm text-default-500">Loading notifications...</div>
              ) : data.latestNotifications.length ? (
                data.latestNotifications.map((notification) => (
                  <Link
                    key={notification.id}
                    href={
                      notification.orderId
                        ? `/ecommerce/backend/order-details?id=${notification.orderId}`
                        : "/ecommerce/backend/order-list"
                    }
                    className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-default-200 bg-transparent px-4 py-3 transition-colors hover:border-default-300 hover:bg-default-50/60"
                  >
                    <div className={cn("flex h-10 w-10 items-center justify-center rounded-md", notification.isRead ? "bg-default-100" : "bg-primary/10")}>
                      <Bell className={cn("h-4 w-4", notification.isRead ? "text-default-500" : "text-primary")} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium text-default-900">{notification.title}</span>
                        {!notification.isRead && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                      </div>
                      <div className="truncate text-xs text-default-500">
                        {notification.message || `${notification.customerName} ${notification.trackingId}`}
                      </div>
                    </div>
                    <div className="min-w-[82px] text-right text-xs text-default-400">{formatTime(notification.createdAt)}</div>
                  </Link>
                ))
              ) : (
                <div className="px-2 py-6 text-sm text-default-500">No notifications yet</div>
              )}
          </FeedPanel>
        </div>
      </CardContent>
    </Card>
  );
};

export default LiveOrderDashboard;
