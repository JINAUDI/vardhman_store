"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useAtom } from "jotai";
import { ordersAtom } from "@/lib/store/ecommerce-store";
import { canTransitionTo } from "@/lib/store/actions";
import type { Order, OrderStatus } from "@/lib/store/types";
import { useSearchParams } from "next/navigation";
import { Link } from "@/i18n/routing";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Printer,
  Package,
  Truck,
  CreditCard,
  MapPin,
  Clock,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatINR } from "@/lib/utils/currency";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning border-warning/30",
  confirmed: "bg-info/10 text-info border-info/30",
  processing: "bg-violet-500/10 text-violet-600 border-violet-500/30",
  packed: "bg-primary/10 text-primary border-primary/30",
  shipped: "bg-cyan-500/10 text-cyan-600 border-cyan-500/30",
  out_for_delivery: "bg-blue-500/10 text-blue-600 border-blue-500/30",
  delivered: "bg-success/10 text-success border-success/30",
  cancelled: "bg-destructive/10 text-destructive border-destructive/30",
  refunded: "bg-purple-500/10 text-purple-600 border-purple-500/30",
  returned: "bg-orange-500/10 text-orange-600 border-orange-500/30",
};

const statusIcons: Record<string, string> = {
  pending: "heroicons:clock",
  confirmed: "heroicons:check-circle",
  processing: "heroicons:cog-6-tooth",
  packed: "heroicons:archive-box",
  shipped: "heroicons:truck",
  out_for_delivery: "heroicons:truck",
  delivered: "heroicons:check-badge",
  cancelled: "heroicons:x-circle",
  refunded: "heroicons:receipt-refund",
  returned: "heroicons:arrow-uturn-left",
};

const paymentColors: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  cod_pending: "bg-amber-500/10 text-amber-600",
  paid: "bg-success/10 text-success",
  unpaid: "bg-warning/10 text-warning",
  failed: "bg-destructive/10 text-destructive",
  refunded: "bg-purple-500/10 text-purple-600",
};

const deliverySteps: Array<{ status: OrderStatus; label: string; description: string }> = [
  { status: "pending", label: "Order Placed", description: "Order received from checkout" },
  { status: "confirmed", label: "Confirmed", description: "Order accepted by admin" },
  { status: "processing", label: "Processing", description: "Items are being prepared" },
  { status: "packed", label: "Packed", description: "Package is ready to ship" },
  { status: "shipped", label: "Shipped", description: "Handed to courier" },
  { status: "out_for_delivery", label: "Out for Delivery", description: "Courier is delivering today" },
  { status: "delivered", label: "Delivered", description: "Customer received the order" },
];

const deliveryActionStatuses: OrderStatus[] = [
  "processing",
  "packed",
  "shipped",
  "out_for_delivery",
  "delivered",
];

function getStatusLabel(status: string) {
  return deliverySteps.find((step) => step.status === status)?.label || status.replace(/_/g, " ");
}

const OrderDetailsPage = () => {
  const searchParams = useSearchParams();
  const orderId = searchParams?.get("id") ?? null;
  const [orders, setOrders] = useAtom(ordersAtom);
  const [trackingId, setTrackingId] = useState("");
  const [courier, setCourier] = useState("");
  const [courierTrackingNumber, setCourierTrackingNumber] = useState("");
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState("");
  const [adminNotes, setAdminNotes] = useState("");
  const [refundOpen, setRefundOpen] = useState(false);
  const [remoteOrder, setRemoteOrder] = useState<Order | null>(null);
  const [isLoadingRemoteOrder, setIsLoadingRemoteOrder] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!orderId || orders.some((item) => item.id === orderId)) {
      setRemoteOrder(null);
      return;
    }

    let cancelled = false;
    setIsLoadingRemoteOrder(true);

    fetch(`/api/orders/${orderId}`)
      .then((response) => response.json())
      .then((payload) => {
        if (cancelled || !payload?.data) return;
        const nextOrder = payload.data as Order;
        setRemoteOrder(nextOrder);
        setOrders((prev) =>
          prev.some((item) => item.id === nextOrder.id) ? prev : [nextOrder, ...prev]
        );
      })
      .catch((error) => {
        console.warn("[orders] Unable to load Supabase order.", error);
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRemoteOrder(false);
      });

    return () => {
      cancelled = true;
    };
  }, [orderId, orders, setOrders]);

  const order = useMemo(
    () => remoteOrder || orders.find((o) => o.id === orderId) || (!orderId ? orders[0] : undefined),
    [orders, orderId, remoteOrder]
  );

  useEffect(() => {
    if (!order) return;
    setTrackingId(order.trackingId || order.orderNumber || "");
    setCourier(order.courierName || order.courier || "");
    setCourierTrackingNumber(order.courierTrackingNumber || "");
    setEstimatedDeliveryDate(order.estimatedDelivery ? order.estimatedDelivery.slice(0, 10) : "");
    setAdminNotes(order.adminNotes || order.notes || "");
  }, [order]);

  if (isLoadingRemoteOrder) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-default-500">Loading order...</p>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-default-500">Order not found</p>
      </div>
    );
  }

  const persistOrderUpdate = async (payload: Record<string, string | number>) => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/orders/${order.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.data) {
        throw new Error(result.message || "Unable to update order.");
      }

      const updatedOrder = result.data as Order;
      setRemoteOrder(updatedOrder);
      setOrders((prev) => prev.map((item) => (item.id === updatedOrder.id ? updatedOrder : item)));
      toast.success("Order updated");
      return updatedOrder;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update order");
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: OrderStatus) => {
    const payload: Record<string, string> = { status: newStatus };
    if (newStatus === "cancelled") {
      const reason = window.prompt("Reason for cancellation", "Cancelled by admin");
      if (reason === null) return;
      payload.cancellation_reason = reason || "Cancelled by admin";
      payload.cancelled_by = "admin";
    }
    if (newStatus === "refunded") {
      const reason = window.prompt("Reason for refund", "Refund processed");
      if (reason === null) return;
      payload.refund_reason = reason || "Refund processed";
    }

    await persistOrderUpdate(payload);
  };

  const handleDeliveryStatusChange = async (newStatus: OrderStatus) => {
    if (!canTransitionTo(order.status, newStatus)) {
      toast.error(`Move the order from ${getStatusLabel(order.status)} to the next delivery step first.`);
      return;
    }

    const nextTrackingId = trackingId.trim() || order.trackingId || order.orderNumber;
    if (["shipped", "out_for_delivery", "delivered"].includes(newStatus) && !nextTrackingId) {
      toast.error("Add a tracking ID before moving the delivery forward.");
      return;
    }

    await persistOrderUpdate({
      status: newStatus,
      tracking_id: nextTrackingId,
      courier_name: courier.trim(),
      courier_tracking_number: courierTrackingNumber.trim(),
      estimated_delivery_date: estimatedDeliveryDate,
      admin_notes: adminNotes,
    });
  };

  const handleUpdateShipping = async () => {
    await persistOrderUpdate({
      tracking_id: trackingId.trim(),
      courier_name: courier,
      courier_tracking_number: courierTrackingNumber,
      estimated_delivery_date: estimatedDeliveryDate,
      admin_notes: adminNotes,
    });
  };

  const handleRefund = async () => {
    const reason = window.prompt("Reason for refund", "Refund processed");
    if (reason === null) return;
    await persistOrderUpdate({
      status: "refunded",
      payment_status: "refunded",
      refund_status: "refunded",
      refund_reason: reason || "Refund processed",
    });
    setRefundOpen(false);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const currentDeliveryStepIndex = Math.max(
    0,
    deliverySteps.findIndex((step) => step.status === order.status)
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/ecommerce/backend/order-list">
            <Button variant="outline" size="icon" className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-semibold text-default-900">
                {order.orderNumber}
              </h2>
              <Badge className={cn("capitalize text-xs", statusColors[order.status])}>
                {order.status}
              </Badge>
            </div>
            <p className="text-sm text-default-500 mt-0.5">
              Placed on {formatDate(order.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {order.status === "pending" && (
            <>
              <Button
                size="sm"
                className="gap-1 bg-success hover:bg-success/90 text-white"
                onClick={() => handleStatusChange("confirmed")}
                disabled={isSaving}
              >
                <CheckCircle className="h-4 w-4" /> Accept
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => handleStatusChange("cancelled")}
                disabled={isSaving}
              >
                <XCircle className="h-4 w-4" /> Reject
              </Button>
            </>
          )}
          {canTransitionTo(order.status, "packed") && (
            <Button size="sm" onClick={() => handleStatusChange("packed")} className="gap-1" disabled={isSaving}>
              <Package className="h-4 w-4" /> Mark Packed
            </Button>
          )}
          {canTransitionTo(order.status, "processing") && (
            <Button size="sm" onClick={() => handleStatusChange("processing")} className="gap-1" disabled={isSaving}>
              <Clock className="h-4 w-4" /> Start Processing
            </Button>
          )}
          {canTransitionTo(order.status, "shipped") && (
            <Button size="sm" onClick={() => handleStatusChange("shipped")} className="gap-1" disabled={isSaving}>
              <Truck className="h-4 w-4" /> Mark Shipped
            </Button>
          )}
          {canTransitionTo(order.status, "out_for_delivery") && (
            <Button size="sm" onClick={() => handleStatusChange("out_for_delivery")} className="gap-1" disabled={isSaving}>
              <Truck className="h-4 w-4" /> Out for Delivery
            </Button>
          )}
          {canTransitionTo(order.status, "delivered") && (
            <Button size="sm" className="gap-1 bg-success hover:bg-success/90 text-white" onClick={() => handleStatusChange("delivered")} disabled={isSaving}>
              <CheckCircle className="h-4 w-4" /> Mark Delivered
            </Button>
          )}
          <Button size="sm" variant="outline" className="gap-1" onClick={() => window.print()}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Left Column — Order Details */}
        <div className="col-span-12 lg:col-span-8 space-y-5">
          {/* Items */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order Items ({order.items.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {order.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-4 py-3 border-b border-default-100 last:border-0">
                    <div className="h-12 w-12 rounded-lg bg-default-100 flex items-center justify-center overflow-hidden">
                      <img src={item.productImage} alt={item.productName} className="h-10 w-10 object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-default-800 truncate">{item.productName}</p>
                      {item.variantLabel && (
                        <p className="text-xs text-default-400">{item.variantLabel}</p>
                      )}
                    </div>
                    <div className="text-sm text-default-500">×{item.quantity}</div>
                    <div className="text-sm font-medium text-default-800">{formatINR(item.price, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="text-sm font-semibold text-default-900">{formatINR(item.total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  </div>
                ))}
              </div>
              <Separator className="my-4" />
              <div className="space-y-2 max-w-xs ml-auto">
                <div className="flex justify-between text-sm">
                  <span className="text-default-500">Subtotal</span>
                  <span className="text-default-700">{formatINR(order.subtotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-default-500">Tax</span>
                  <span className="text-default-700">{formatINR(order.tax, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-default-500">Shipping</span>
                  <span className="text-default-700">{order.shippingCost === 0 ? "Free" : formatINR(order.shippingCost, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                {order.discount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-default-500">Discount {order.couponCode && `(${order.couponCode})`}</span>
                    <span className="text-success">-{formatINR(order.discount, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-base font-semibold">
                  <span>Total</span>
                  <span>{formatINR(order.total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Info */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Payment Information
                </CardTitle>
                <Badge className={cn("capitalize text-xs", paymentColors[order.paymentStatus])}>
                  {order.paymentStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-default-50 p-3">
                  <p className="text-xs text-default-400 mb-1">Payment Method</p>
                  <p className="text-sm font-medium text-default-700 uppercase">{order.paymentMethod}</p>
                </div>
                <div className="rounded-lg bg-default-50 p-3">
                  <p className="text-xs text-default-400 mb-1">Delivery Method</p>
                  <p className="text-sm font-medium text-default-700 capitalize">{order.deliveryMethod || "standard"}</p>
                </div>
                <div className="rounded-lg bg-default-50 p-3">
                  <p className="text-xs text-default-400 mb-1">Payment Status</p>
                  <p className="text-sm font-medium text-default-700 capitalize">{order.paymentStatus}</p>
                </div>
                <div className="rounded-lg bg-default-50 p-3">
                  <p className="text-xs text-default-400 mb-1">Amount</p>
                  <p className="text-sm font-medium text-default-700">{formatINR(order.total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                </div>
                <div>
                  <p className="text-xs text-default-400 mb-1">Invoice</p>
                  <p className="text-sm font-medium text-default-700">{order.invoiceNumber || "Pending"}</p>
                </div>
              </div>
              {order.paymentStatus === "paid" && order.status !== "cancelled" && (
                <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="mt-4 gap-1 text-destructive border-destructive/30">
                      Process Refund
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Process Refund</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <p className="text-sm text-default-600">
                        Are you sure you want to refund <strong>{formatINR(order.total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong> for order <strong>{order.orderNumber}</strong>?
                      </p>
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={() => setRefundOpen(false)}>Cancel</Button>
                        <Button className="bg-destructive hover:bg-destructive/90 text-white" onClick={handleRefund}>
                          Confirm Refund
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardContent>
          </Card>

          {/* Delivery Tracking Panel */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4" /> Delivery & Tracking
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-4 mb-5">
                <div className="rounded-lg bg-default-50 p-3">
                  <p className="text-xs text-default-400 mb-1">Order Status</p>
                  <Badge className={cn("capitalize text-xs", statusColors[order.status])}>
                    {getStatusLabel(order.status)}
                  </Badge>
                  <p className="mt-2 text-[11px] text-default-400 capitalize">Shipping: {order.shippingStatus.replace(/_/g, " ")}</p>
                </div>
                <div className="rounded-lg bg-default-50 p-3">
                  <p className="text-xs text-default-400 mb-1">Tracking ID</p>
                  <p className="text-sm font-medium text-default-700 break-all">{order.trackingId || order.orderNumber || "Pending"}</p>
                </div>
                <div className="rounded-lg bg-default-50 p-3">
                  <p className="text-xs text-default-400 mb-1">Courier</p>
                  <p className="text-sm font-medium text-default-700">{order.courier || "Pending"}</p>
                </div>
                <div className="rounded-lg bg-default-50 p-3">
                  <p className="text-xs text-default-400 mb-1">Courier Tracking</p>
                  <p className="text-sm font-medium text-default-700 break-all">{order.courierTrackingNumber || "Pending"}</p>
                </div>
                {order.estimatedDelivery && (
                  <div className="rounded-lg bg-default-50 p-3">
                    <p className="text-xs text-default-400 mb-1">Est. Delivery</p>
                    <p className="text-sm font-medium text-default-700">
                      {new Date(order.estimatedDelivery).toLocaleDateString()}
                    </p>
                  </div>
                )}
              </div>

              <div className="mb-5 overflow-x-auto">
                <div className="min-w-[680px] grid grid-cols-7 gap-2">
                  {deliverySteps.map((step, index) => {
                    const isCurrent = step.status === order.status;
                    const isDone = index < currentDeliveryStepIndex || isCurrent;
                    return (
                      <div key={step.status} className="relative">
                        {index < deliverySteps.length - 1 && (
                          <div className={cn(
                            "absolute left-[calc(50%+18px)] right-[calc(-50%+18px)] top-4 h-px",
                            index < currentDeliveryStepIndex ? "bg-success" : "bg-default-200"
                          )} />
                        )}
                        <div className="relative z-10 flex flex-col items-center text-center">
                          <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full border",
                            isCurrent
                              ? "border-primary bg-primary text-primary-foreground"
                              : isDone
                                ? "border-success bg-success/10 text-success"
                                : "border-default-200 bg-default-50 text-default-400"
                          )}>
                            <Icon icon={statusIcons[step.status] || "heroicons:clock"} className="h-4 w-4" />
                          </div>
                          <p className="mt-2 text-xs font-medium text-default-800">{step.label}</p>
                          <p className="mt-1 text-[11px] leading-4 text-default-400">{step.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {!["cancelled", "refunded", "delivered"].includes(order.status) && (
                <div className="border-t border-default-100 pt-4 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-default-700">Update Delivery Details</p>
                    <div className="flex flex-wrap gap-2">
                      {deliveryActionStatuses.map((status) => (
                        <Button
                          key={status}
                          size="sm"
                          variant={canTransitionTo(order.status, status) ? "default" : "outline"}
                          onClick={() => handleDeliveryStatusChange(status)}
                          disabled={isSaving || !canTransitionTo(order.status, status)}
                        >
                          {getStatusLabel(status)}
                        </Button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <Input
                      placeholder="Tracking ID"
                      value={trackingId}
                      onChange={(e) => setTrackingId(e.target.value)}
                      className="h-9"
                    />
                    <Input
                      placeholder="Courier"
                      value={courier}
                      onChange={(e) => setCourier(e.target.value)}
                      className="h-9"
                    />
                    <Input
                      placeholder="Courier tracking number"
                      value={courierTrackingNumber}
                      onChange={(e) => setCourierTrackingNumber(e.target.value)}
                      className="h-9"
                    />
                    <Input
                      type="date"
                      value={estimatedDeliveryDate}
                      onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <textarea
                    value={adminNotes}
                    onChange={(event) => setAdminNotes(event.target.value)}
                    className="min-h-20 w-full rounded-md border border-default-200 bg-background px-3 py-2 text-sm"
                    placeholder="Admin notes"
                  />
                  <Button size="sm" onClick={handleUpdateShipping} disabled={isSaving}>Update Delivery</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column — Timeline + Customer */}
        <div className="col-span-12 lg:col-span-4 space-y-5">
          {/* Customer Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Customer
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={order.customerAvatar} />
                  <AvatarFallback>{order.customerName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium text-default-800">{order.customerName}</p>
                  <p className="text-xs text-default-400">{order.customerEmail}</p>
                  {order.customerPhone && (
                    <p className="text-xs text-default-400">{order.customerPhone}</p>
                  )}
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-xs text-default-400 mb-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Shipping Address
                  </p>
                  <p className="text-sm text-default-600">
                    {order.shippingAddress.street}<br />
                    {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.zipCode}<br />
                    {order.shippingAddress.country}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Timeline */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" /> Order Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative">
                {order.timeline.map((event, i) => (
                  <div key={event.id} className="flex gap-3 pb-6 last:pb-0">
                    {/* Line */}
                    <div className="flex flex-col items-center">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center shrink-0",
                        i === order.timeline.length - 1
                          ? statusColors[event.status]
                          : "bg-default-100"
                      )}>
                        <Icon
                          icon={statusIcons[event.status] || "heroicons:clock"}
                          className={cn(
                            "h-4 w-4",
                            i === order.timeline.length - 1 ? "" : "text-default-400"
                          )}
                        />
                      </div>
                      {i < order.timeline.length - 1 && (
                        <div className="w-px h-full bg-default-200 mt-1" />
                      )}
                    </div>
                    {/* Content */}
                    <div className="pt-1 pb-2">
                      <p className="text-sm font-medium text-default-700 capitalize">
                        {event.status}
                      </p>
                      {event.note && (
                        <p className="text-xs text-default-400 mt-0.5">{event.note}</p>
                      )}
                      <p className="text-[11px] text-default-300 mt-1">
                        {formatDate(event.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          {order.notes && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-default-600">{order.notes}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetailsPage;
