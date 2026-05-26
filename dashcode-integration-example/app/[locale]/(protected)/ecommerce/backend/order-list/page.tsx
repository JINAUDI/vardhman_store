"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useAtom, useAtomValue } from "jotai";
import { ordersAtom, pendingOrdersCountAtom, productsAtom } from "@/lib/store/ecommerce-store";
import { updateOrderStatus, canTransitionTo, exportToCSV } from "@/lib/store/actions";
import type { Order, OrderStatus } from "@/lib/store/types";
import { Link } from "@/i18n/routing";
import { formatINR } from "@/lib/utils/currency";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Search,
  CheckCircle,
  XCircle,
  Printer,
  Download,
  LoaderCircle,
} from "lucide-react";

const filterTabs: { label: string; value: string }[] = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Confirmed", value: "confirmed" },
  { label: "Processing", value: "processing" },
  { label: "Packed", value: "packed" },
  { label: "Shipped", value: "shipped" },
  { label: "Out for Delivery", value: "out_for_delivery" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Refunded", value: "refunded" },
];

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  confirmed: "bg-info/10 text-info",
  processing: "bg-violet-500/10 text-violet-600",
  packed: "bg-primary/10 text-primary",
  shipped: "bg-cyan-500/10 text-cyan-600",
  out_for_delivery: "bg-blue-500/10 text-blue-600",
  delivered: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-purple-500/10 text-purple-600",
  returned: "bg-orange-500/10 text-orange-600",
};

const paymentColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  cod_pending: "bg-amber-500/10 text-amber-600",
  paid: "bg-success/10 text-success",
  unpaid: "bg-warning/10 text-warning",
  failed: "bg-destructive/10 text-destructive",
  refunded: "bg-purple-500/10 text-purple-600",
};

const PAGE_SIZE = 10;

function getApiMessage(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload && "message" in payload
    ? String((payload as { message?: unknown }).message || fallback)
    : fallback;
}

const OrderListPage = () => {
  const [orders, setOrders] = useAtom(ordersAtom);
  const [, setProducts] = useAtom(productsAtom);
  const pendingCount = useAtomValue(pendingOrdersCountAtom);

  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [fulfillmentFilter, setFulfillmentFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const syncOrdersFromApi = useCallback(async () => {
    const response = await fetch("/api/orders", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok || !Array.isArray(payload.data)) {
      throw new Error(getApiMessage(payload, "Unable to fetch orders."));
    }

    setOrders(payload.data as Order[]);
    return payload.data as Order[];
  }, [setOrders]);

  const syncProductsFromApi = useCallback(async () => {
    const response = await fetch("/api/products", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok || !Array.isArray(payload.data)) {
      throw new Error(getApiMessage(payload, "Unable to fetch products."));
    }

    setProducts(payload.data);
  }, [setProducts]);

  useEffect(() => {
    let cancelled = false;

    async function loadSyncedData() {
      setIsLoading(true);
      setLoadError(null);
      try {
        await Promise.all([syncOrdersFromApi(), syncProductsFromApi()]);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load Supabase orders.";
          setLoadError(message);
          toast.error("Unable to load synced orders");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadSyncedData();

    return () => {
      cancelled = true;
    };
  }, [syncOrdersFromApi, syncProductsFromApi]);

  useEffect(() => {
    let isMounted = true;
    let supabase: ReturnType<typeof getSupabaseBrowserClient>;

    try {
      supabase = getSupabaseBrowserClient();
    } catch (error) {
      console.warn("[orders] Unable to initialize Supabase realtime client.", error);
      return () => {
        isMounted = false;
      };
    }

    const channel = supabase
      .channel("dashboard-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, (payload) => {
        console.log("Realtime order payload:", payload);
        if (!isMounted) return;
        void syncOrdersFromApi().catch((error) => {
          console.warn("[orders] Unable to refresh orders after realtime payload.", error);
        });
      })
      .subscribe((status, error) => {
        console.log("Orders realtime status:", status);
        if (error) console.warn("[orders] Supabase realtime subscription error:", error);
      });

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [syncOrdersFromApi]);

  const filtered = useMemo(() => {
    let result = orders;
    if (activeTab !== "all") {
      result = result.filter((o) => o.status === activeTab);
    }
    if (paymentFilter !== "all") {
      result = result.filter((o) => o.paymentStatus === paymentFilter);
    }
    if (fulfillmentFilter !== "all") {
      result = result.filter((o) => (o.fulfillmentStatus || o.shippingStatus) === fulfillmentFilter);
    }
    if (dateFrom) {
      const fromTime = new Date(dateFrom).setHours(0, 0, 0, 0);
      result = result.filter((o) => new Date(o.createdAt).getTime() >= fromTime);
    }
    if (dateTo) {
      const toTime = new Date(dateTo).setHours(23, 59, 59, 999);
      result = result.filter((o) => new Date(o.createdAt).getTime() <= toTime);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (o) =>
          o.orderNumber.toLowerCase().includes(q) ||
          (o.invoiceNumber || "").toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.customerEmail.toLowerCase().includes(q) ||
          (o.customerPhone || "").toLowerCase().includes(q) ||
          (o.trackingId || "").toLowerCase().includes(q)
      );
    }
    return [...result].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [orders, activeTab, paymentFilter, fulfillmentFilter, dateFrom, dateTo, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleStatusChange = async (orderId: string, newStatus: OrderStatus) => {
    const order = orders.find((o) => o.id === orderId);
    if (!order || updatingOrderId) return;

    const requestBody: Record<string, string> = { status: newStatus };
    if (newStatus === "cancelled") {
      const reason = window.prompt("Reason for cancellation", "Cancelled by admin");
      if (reason === null) return;
      requestBody.cancellation_reason = reason || "Cancelled by admin";
      requestBody.cancelled_by = "admin";
    }
    if (newStatus === "refunded") {
      const reason = window.prompt("Reason for refund", "Refund processed");
      if (reason === null) return;
      requestBody.refund_reason = reason || "Refund processed";
    }

    const previousOrders = orders;
    setUpdatingOrderId(orderId);
    setOrders((prev) => updateOrderStatus(prev, orderId, newStatus));

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      const payload = await response.json();

      if (!response.ok || !payload.data) {
        throw new Error(getApiMessage(payload, "Unable to update order."));
      }

      setOrders((prev) =>
        prev.map((item) => (item.id === orderId ? (payload.data as Order) : item))
      );
      toast.success(`Order ${order.orderNumber} updated`);
    } catch (error) {
      setOrders(previousOrders);
      toast.error(error instanceof Error ? error.message : "Unable to update order status");
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(paginated.map((o) => o.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) next.add(id);
    else next.delete(id);
    setSelectedIds(next);
  };

  const handleBulkAction = async (action: string) => {
    const nextStatus = action === "confirm" ? "confirmed" : action === "cancel" ? "cancelled" : null;
    if (!nextStatus) return;

    for (const id of Array.from(selectedIds)) {
      await handleStatusChange(id, nextStatus);
    }
    setSelectedIds(new Set());
  };

  const handleExport = () => {
    exportToCSV(
      filtered.map((order) => ({
        tracking_id: order.trackingId || "",
        order_number: order.orderNumber,
        invoice_number: order.invoiceNumber || "",
        customer_name: order.customerName,
        phone: order.customerPhone || "",
        email: order.customerEmail,
        total: order.total,
        order_status: order.status,
        payment_status: order.paymentStatus,
        fulfillment_status: order.fulfillmentStatus || order.shippingStatus,
        created_at: order.createdAt,
      })),
      "radios_orders"
    );
  };

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const tabCounts = useMemo(() => {
    const counts: Record<string, number> = { all: orders.length };
    filterTabs.forEach((t) => {
      if (t.value !== "all") {
        counts[t.value] = orders.filter((o) => o.status === t.value).length;
      }
    });
    return counts;
  }, [orders]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-default-900">Orders</h2>
          <p className="text-sm text-default-500 mt-1">
            Manage and track all customer orders{pendingCount > 0 ? ` (${pendingCount} pending)` : ""}
          </p>
          {loadError && <p className="text-xs text-destructive mt-1">{loadError}</p>}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-1">
        {filterTabs.map((tab) => (
          <Button
            key={tab.value}
            variant={activeTab === tab.value ? "default" : "outline"}
            size="sm"
            className={cn(
              "gap-1.5 whitespace-nowrap",
              activeTab === tab.value && "shadow-sm"
            )}
            onClick={() => {
              setActiveTab(tab.value);
              setPage(0);
            }}
          >
            {tab.label}
            <Badge
              className={cn(
                "h-5 min-w-[20px] justify-center text-[10px] rounded-full",
                activeTab === tab.value
                  ? "bg-primary-foreground/20 text-primary-foreground"
                  : "bg-default-100 text-default-500"
              )}
            >
              {tabCounts[tab.value] || 0}
            </Badge>
          </Button>
        ))}
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col xl:flex-row justify-between gap-3">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-default-400" />
              <Input
                placeholder="Search tracking, invoice, customer..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(0);
                }}
                className="pl-9 h-9"
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <select
                value={paymentFilter}
                onChange={(event) => {
                  setPaymentFilter(event.target.value);
                  setPage(0);
                }}
                className="h-9 rounded-md border border-default-200 bg-background px-3 text-sm"
              >
                <option value="all">All payments</option>
                <option value="pending">Pending</option>
                <option value="cod_pending">COD Pending</option>
                <option value="paid">Paid</option>
                <option value="failed">Failed</option>
                <option value="refunded">Refunded</option>
              </select>
              <select
                value={fulfillmentFilter}
                onChange={(event) => {
                  setFulfillmentFilter(event.target.value);
                  setPage(0);
                }}
                className="h-9 rounded-md border border-default-200 bg-background px-3 text-sm"
              >
                <option value="all">All fulfillment</option>
                <option value="unfulfilled">Unfulfilled</option>
                <option value="partially_fulfilled">Partially fulfilled</option>
                <option value="fulfilled">Fulfilled</option>
                <option value="returned">Returned</option>
              </select>
              <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-9" />
              <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-9" />
            </div>
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-default-500">
                  {selectedIds.size} selected
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-success border-success/30 hover:bg-success/10"
                  onClick={() => void handleBulkAction("confirm")}
                  disabled={Boolean(updatingOrderId)}
                >
                  <CheckCircle className="h-3.5 w-3.5" /> Confirm
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                  onClick={() => void handleBulkAction("cancel")}
                  disabled={Boolean(updatingOrderId)}
                >
                  <XCircle className="h-3.5 w-3.5" /> Cancel
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-default-200">
                  <TableHead className="w-10">
                    <Checkbox
                      checked={
                        paginated.length > 0 &&
                        paginated.every((o) => selectedIds.has(o.id))
                      }
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Items</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Payment</TableHead>
                  <TableHead>Fulfillment</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center">
                      <div className="flex flex-col items-center text-default-400">
                        <LoaderCircle className="h-6 w-6 mb-2 animate-spin" />
                        <p>Loading orders...</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={10} className="h-32 text-center">
                      <div className="flex flex-col items-center text-default-400">
                        <Icon
                          icon="heroicons:clipboard-document-list"
                          className="h-10 w-10 mb-2"
                        />
                        <p>No orders found</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((order) => (
                    <TableRow key={order.id} className="h-[68px]">
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(order.id)}
                          onCheckedChange={(checked) =>
                            handleSelectOne(order.id, checked as boolean)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/ecommerce/backend/order-details?id=${order.id}`}
                          className="font-medium text-primary hover:underline text-sm"
                        >
                          {order.orderNumber}
                        </Link>
                        {order.trackingId && (
                          <p className="text-[11px] text-default-400 mt-0.5">{order.trackingId}</p>
                        )}
                        {order.invoiceNumber && (
                          <p className="text-[11px] text-default-400 mt-0.5">{order.invoiceNumber}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-7 w-7">
                            <AvatarImage src={order.customerAvatar} />
                            <AvatarFallback>
                              {order.customerName.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium text-default-700 truncate max-w-[120px]">
                              {order.customerName}
                            </p>
                            {order.customerPhone && (
                              <p className="text-[11px] text-default-400">{order.customerPhone}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-default-600">
                          {order.items.length} item{order.items.length > 1 ? "s" : ""}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium text-default-800">
                          {formatINR(order.total, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="cursor-pointer" disabled={updatingOrderId === order.id}>
                              <Badge
                                className={cn(
                                  "px-2.5 py-0.5 text-[11px] rounded-full capitalize cursor-pointer",
                                  statusColors[order.status]
                                )}
                              >
                                {updatingOrderId === order.id ? "updating" : order.status}
                              </Badge>
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-[160px]">
                            {(
                              [
                                "pending",
                                "confirmed",
                                "processing",
                                "packed",
                                "shipped",
                                "out_for_delivery",
                                "delivered",
                                "cancelled",
                                "refunded",
                              ] as OrderStatus[]
                            ).map((s) => (
                              <DropdownMenuItem
                                key={s}
                                disabled={updatingOrderId === order.id || !canTransitionTo(order.status, s)}
                                onClick={() => void handleStatusChange(order.id, s)}
                                className="capitalize text-sm"
                              >
                                <Badge
                                  className={cn(
                                    "mr-2 h-2 w-2 p-0 rounded-full",
                                    statusColors[s]
                                  )}
                                />
                                {s}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            "px-2 py-0.5 text-[11px] rounded-full capitalize",
                            paymentColors[order.paymentStatus]
                          )}
                        >
                          {order.paymentStatus}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="px-2 py-0.5 text-[11px] rounded-full capitalize bg-default-100 text-default-600">
                          {(order.fulfillmentStatus || order.shippingStatus).replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-default-500">
                          {formatDate(order.createdAt)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {order.status === "pending" && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-success hover:bg-success/10"
                                onClick={() => void handleStatusChange(order.id, "confirmed")}
                                disabled={Boolean(updatingOrderId)}
                                title="Accept"
                              >
                                <CheckCircle className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                                onClick={() => void handleStatusChange(order.id, "cancelled")}
                                disabled={Boolean(updatingOrderId)}
                                title="Reject"
                              >
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            title="Print"
                            onClick={() => window.print()}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          <Link href={`/ecommerce/backend/order-details?id=${order.id}`}>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              title="View Details"
                            >
                              <Icon icon="heroicons:eye" className="h-4 w-4" />
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-sm text-default-500">
                Showing {page * PAGE_SIZE + 1}-
                {Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {" "}
                {filtered.length}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  const pageNum =
                    totalPages <= 5
                      ? i
                      : Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                  return (
                    <Button
                      key={pageNum}
                      size="icon"
                      className={cn(
                        "h-8 w-8",
                        page === pageNum
                          ? "bg-primary text-primary-foreground"
                          : "bg-default-100 text-default-600"
                      )}
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum + 1}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default OrderListPage;
