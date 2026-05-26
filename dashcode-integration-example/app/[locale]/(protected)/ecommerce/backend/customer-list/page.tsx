"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useAtom } from "jotai";
import { customersAtom, ordersAtom } from "@/lib/store/ecommerce-store";
import type { Customer, Order } from "@/lib/store/types";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  DollarSign,
  ShoppingBag,
  LoaderCircle,
  Heart,
  Star,
  RotateCcw,
  Repeat,
  Mail,
  Phone,
  MapPin,
  CalendarClock,
  ReceiptText,
} from "lucide-react";
import { Icon } from "@/components/ui/icon";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatINR } from "@/lib/utils/currency";
import { toast } from "sonner";
import { Link } from "@/i18n/routing";

const PAGE_SIZE = 10;

type CustomerReturnRequest = {
  id: string;
  orderId?: string;
  reason?: string;
  status?: string;
  createdAt?: string;
};

type CustomerInsight = Customer & {
  authUserId?: string;
  wishlistCount?: number;
  reviewCount?: number;
  returnRequests?: CustomerReturnRequest[];
  wishlistItems?: Array<{ id: string; productId?: string; createdAt?: string }>;
  reviewItems?: Array<{ id: string; productId?: string; status?: string; createdAt?: string }>;
};
function getApiMessage(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload && "message" in payload
    ? String((payload as { message?: unknown }).message || fallback)
    : fallback;
}

function normalizePhone(value?: string) {
  return (value || "").replace(/\D/g, "");
}

function normalizeEmail(value?: string) {
  return (value || "").trim().toLowerCase();
}

function getAddressLine(address?: Order["shippingAddress"]) {
  if (!address) return "";
  return [address.street, address.city, address.state, address.zipCode, address.country].filter(Boolean).join(", ");
}

function getStatusBadgeClass(status: Order["status"]) {
  if (status === "delivered") return "bg-success/10 text-success";
  if (status === "cancelled" || status === "refunded" || status === "returned") return "bg-destructive/10 text-destructive";
  if (status === "pending") return "bg-warning/10 text-warning";
  return "bg-primary/10 text-primary";
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const CustomerListPage = () => {
  const [customers, setCustomers] = useAtom(customersAtom);
  const [orders, setOrders] = useAtom(ordersAtom);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const syncCustomersFromApi = useCallback(async () => {
    const response = await fetch("/api/customers", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok || !Array.isArray(payload.data)) {
      throw new Error(getApiMessage(payload, "Unable to fetch customers."));
    }

    setCustomers(payload.data as Customer[]);
  }, [setCustomers]);

  const syncOrdersFromApi = useCallback(async () => {
    const response = await fetch("/api/orders", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok || !Array.isArray(payload.data)) {
      throw new Error(getApiMessage(payload, "Unable to fetch orders."));
    }

    setOrders(payload.data as Order[]);
  }, [setOrders]);

  const sendCustomerNotification = useCallback(async (customer: CustomerInsight) => {
    if (!customer.authUserId) {
      toast.error("This customer does not have a linked auth account yet.");
      return;
    }

    const title = window.prompt("Notification title", "Account update");
    if (!title || !title.trim()) return;
    const message = window.prompt("Message", "We have an update for your Radios account.");
    if (message === null) return;

    try {
      const response = await fetch("/api/customer-notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authUserId: customer.authUserId, title: title.trim(), message: message.trim(), type: "account" }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(getApiMessage(payload, "Unable to send notification."));
      toast.success("Customer notification sent");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to send notification.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadSyncedCustomers() {
      setIsLoading(true);
      setLoadError(null);
      try {
        await Promise.all([syncCustomersFromApi(), syncOrdersFromApi()]);
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load Supabase customers.";
          setLoadError(message);
          toast.error("Unable to load synced customers");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadSyncedCustomers();

    return () => {
      cancelled = true;
    };
  }, [syncCustomersFromApi, syncOrdersFromApi]);

  const filtered = useMemo(() => {
    if (!search.trim()) return customers;
    const q = search.toLowerCase();
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.phone.toLowerCase().includes(q)
    );
  }, [customers, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId) as CustomerInsight | undefined;
  const customerOrders = useMemo(() => {
    if (!selectedCustomer) return [];
    const email = normalizeEmail(selectedCustomer.email);
    const phone = normalizePhone(selectedCustomer.phone);
    const customerKeys = new Set(
      [selectedCustomer.id, selectedCustomer.authUserId, selectedCustomer.email, selectedCustomer.phone]
        .map((value) => (value || "").trim())
        .filter(Boolean)
    );

    return orders
      .filter((order) => {
        const orderEmail = normalizeEmail(order.customerEmail);
        const orderPhone = normalizePhone(order.customerPhone);
        return (
          customerKeys.has(order.customerId) ||
          (!!selectedCustomer.authUserId && order.customerId === selectedCustomer.authUserId) ||
          (!!email && orderEmail === email) ||
          (!!phone && orderPhone === phone)
        );
      })
      .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
  }, [orders, selectedCustomer]);
  const latestCustomerOrder = customerOrders[0];
  const selectedOrderCount = customerOrders.length || selectedCustomer?.totalOrders || 0;
  const selectedTotalSpend = customerOrders.length
    ? customerOrders.reduce((sum, order) => sum + order.total, 0)
    : selectedCustomer?.totalSpend || 0;
  const repeatPurchaseCount = Math.max(selectedOrderCount - 1, 0);
  const selectedPhone = selectedCustomer?.phone || latestCustomerOrder?.customerPhone || "";
  const primaryAddress =
    selectedCustomer?.addresses.find((address) => getAddressLine(address)) ||
    latestCustomerOrder?.shippingAddress;
  const primaryAddressLine = getAddressLine(primaryAddress);
  const savedAddresses = selectedCustomer?.addresses.filter((address) => getAddressLine(address)) || [];
  const lastOrderAt = latestCustomerOrder?.createdAt || selectedCustomer?.lastOrderAt;

  const totalSpendAll = customers.reduce((sum, c) => sum + c.totalSpend, 0);
  const totalOrdersAll = customers.reduce((sum, c) => sum + c.totalOrders, 0);
  const totalWishlistAll = customers.reduce((sum, c) => sum + ((c as CustomerInsight).wishlistCount || 0), 0);
  const totalReviewsAll = customers.reduce((sum, c) => sum + ((c as CustomerInsight).reviewCount || 0), 0);
  const totalReturnsAll = customers.reduce((sum, c) => sum + c.totalReturns, 0);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-default-900">Customers</h2>
        <p className="text-sm text-default-500 mt-1">View customer profiles, account activity, orders, wishlist, reviews, and returns.</p>
        {loadError && <p className="text-xs text-destructive mt-1">{loadError}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-default-500">Total Customers</p>
              <p className="text-xl font-semibold">{customers.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-success/10 flex items-center justify-center">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-default-500">Total Revenue</p>
              <p className="text-xl font-semibold">{formatINR(totalSpendAll, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-info/10 flex items-center justify-center">
              <ShoppingBag className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-sm text-default-500">Total Orders</p>
              <p className="text-xl font-semibold">{totalOrdersAll}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-warning/10 flex items-center justify-center">
              <Heart className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-default-500">Wishlist Saves</p>
              <p className="text-xl font-semibold">{totalWishlistAll}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-destructive/10 flex items-center justify-center">
              <RotateCcw className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-default-500">Returns</p>
              <p className="text-xl font-semibold">{totalReturnsAll}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-default-400" />
            <Input placeholder="Search customers..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-default-200">
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead className="text-center">Orders</TableHead>
                <TableHead className="text-center">Wishlist</TableHead>
                <TableHead className="text-center">Reviews</TableHead>
                <TableHead className="text-right">Total Spend</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center">
                    <div className="flex flex-col items-center text-default-400">
                      <LoaderCircle className="h-6 w-6 mb-2 animate-spin" />
                      <p>Loading customers...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-32 text-center text-default-400">No customers found</TableCell>
                </TableRow>
              ) : (
                paginated.map((c) => {
                  const customer = c as CustomerInsight;
                  return (
                    <TableRow key={customer.id} className="h-[64px] cursor-pointer hover:bg-default-50" onClick={() => setSelectedCustomerId(customer.id)}>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={customer.avatar} />
                            <AvatarFallback>{customer.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium text-default-800">{customer.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-default-500">{customer.email || "-"}</TableCell>
                      <TableCell className="text-sm text-default-500">{customer.phone || "-"}</TableCell>
                      <TableCell className="text-center text-sm">{customer.totalOrders}</TableCell>
                      <TableCell className="text-center text-sm">{customer.wishlistCount || 0}</TableCell>
                      <TableCell className="text-center text-sm">{customer.reviewCount || 0}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatINR(customer.totalSpend, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-[11px] rounded-full capitalize", customer.status === "active" ? "bg-success/10 text-success" : customer.status === "blocked" ? "bg-destructive/10 text-destructive" : "bg-default-100 text-default-500")}>
                          {customer.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); setSelectedCustomerId(customer.id); }}>
                          <Icon icon="heroicons:eye" className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-4">
              <span className="text-sm text-default-500">Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedCustomerId} onOpenChange={() => setSelectedCustomerId(null)}>
        <DialogContent className="max-w-[920px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Customer Order History</DialogTitle>
          </DialogHeader>
          {selectedCustomer && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-5 pr-4">
                <div className="flex items-center gap-4">
                  <Avatar className="h-16 w-16">
                    <AvatarImage src={selectedCustomer.avatar} />
                    <AvatarFallback className="text-lg">{selectedCustomer.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="text-lg font-semibold">{selectedCustomer.name}</h3>
                    <p className="text-sm text-default-500">{selectedCustomer.email || "No email"}</p>
                    <p className="text-sm text-default-400">{selectedPhone || "No phone"}</p>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={!selectedCustomer.authUserId} onClick={() => void sendCustomerNotification(selectedCustomer)}>
                      Notify
                    </Button>
                    <Badge className={cn("capitalize", selectedCustomer.status === "active" ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                      {selectedCustomer.status}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                  <div className="rounded-lg border border-default-200 bg-default-50 p-3">
                    <div className="flex items-center gap-2 text-default-500">
                      <Mail className="h-4 w-4" />
                      <p className="text-xs font-medium">Email</p>
                    </div>
                    <p className="mt-2 text-sm font-medium text-default-800 break-all">{selectedCustomer.email || "Not provided"}</p>
                  </div>
                  <div className="rounded-lg border border-default-200 bg-default-50 p-3">
                    <div className="flex items-center gap-2 text-default-500">
                      <Phone className="h-4 w-4" />
                      <p className="text-xs font-medium">Phone</p>
                    </div>
                    <p className="mt-2 text-sm font-medium text-default-800">{selectedPhone || "Not provided"}</p>
                  </div>
                  <div className="rounded-lg border border-default-200 bg-default-50 p-3 xl:col-span-2">
                    <div className="flex items-center gap-2 text-default-500">
                      <MapPin className="h-4 w-4" />
                      <p className="text-xs font-medium">Primary Address</p>
                    </div>
                    <p className="mt-2 text-sm font-medium text-default-800">{primaryAddressLine || "No address saved"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
                  <div className="bg-default-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-default-400">Total Spend</p>
                    <p className="text-base font-semibold">{formatINR(selectedTotalSpend, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="bg-default-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-default-400">Orders</p>
                    <p className="text-lg font-semibold">{selectedOrderCount}</p>
                  </div>
                  <div className="bg-default-50 rounded-lg p-3 text-center">
                    <div className="flex items-center justify-center gap-1 text-xs text-default-400">
                      <Repeat className="h-3.5 w-3.5" />
                      <span>Repeat Purchases</span>
                    </div>
                    <p className="text-lg font-semibold">{repeatPurchaseCount}</p>
                  </div>
                  <div className="bg-default-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-default-400">Returns</p>
                    <p className="text-lg font-semibold">{selectedCustomer.totalReturns}</p>
                  </div>
                  <div className="bg-default-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-default-400">Wishlist</p>
                    <p className="text-lg font-semibold">{selectedCustomer.wishlistCount || 0}</p>
                  </div>
                  <div className="bg-default-50 rounded-lg p-3 text-center">
                    <p className="text-xs text-default-400">Reviews</p>
                    <p className="text-lg font-semibold">{selectedCustomer.reviewCount || 0}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 rounded-lg border border-default-200 bg-default-50 px-3 py-2 text-sm text-default-500">
                  <CalendarClock className="h-4 w-4" />
                  <span>Last order: {lastOrderAt ? formatDateTime(lastOrderAt) : "No orders yet"}</span>
                </div>

                <Tabs defaultValue="orders">
                  <TabsList className="flex flex-wrap h-auto">
                    <TabsTrigger value="orders">Orders ({customerOrders.length})</TabsTrigger>
                    <TabsTrigger value="addresses">Addresses</TabsTrigger>
                    <TabsTrigger value="returns">Returns ({selectedCustomer.returnRequests?.length || 0})</TabsTrigger>
                    <TabsTrigger value="engagement">Wishlist & Reviews</TabsTrigger>
                  </TabsList>
                  <TabsContent value="orders" className="mt-3">
                    {customerOrders.length === 0 ? (
                      <p className="text-sm text-default-400 py-4 text-center">No orders yet</p>
                    ) : (
                      <div className="space-y-3">
                        {customerOrders.map((o) => (
                          <div key={o.id} className="rounded-lg border border-default-200 bg-default-50 p-3">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="flex items-start gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                                  <ReceiptText className="h-4 w-4" />
                                </div>
                                <div>
                                  <p className="text-sm font-semibold text-default-900">{o.orderNumber}</p>
                                  <p className="text-xs text-default-400">{formatDateTime(o.createdAt)}</p>
                                  {o.trackingId && <p className="text-xs text-default-500 mt-1">Tracking: {o.trackingId}</p>}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                                <span className="text-sm font-semibold text-default-900">{formatINR(o.total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                                <Badge className={cn("text-[10px] capitalize rounded-full", getStatusBadgeClass(o.status))}>
                                  {o.status.replace(/_/g, " ")}
                                </Badge>
                                <Button asChild size="sm" variant="outline" className="h-8">
                                  <Link href={`/ecommerce/backend/order-details?id=${o.id}`}>View</Link>
                                </Button>
                              </div>
                            </div>
                            <div className="mt-3 grid grid-cols-1 gap-2 text-xs text-default-500 sm:grid-cols-3">
                              <div>
                                <span className="text-default-400">Items</span>
                                <p className="text-sm font-medium text-default-700">{o.items.reduce((sum, item) => sum + item.quantity, 0)}</p>
                              </div>
                              <div>
                                <span className="text-default-400">Payment</span>
                                <p className="text-sm font-medium text-default-700 capitalize">{o.paymentStatus.replace(/_/g, " ")}</p>
                              </div>
                              <div>
                                <span className="text-default-400">Ship To</span>
                                <p className="text-sm font-medium text-default-700">{getAddressLine(o.shippingAddress) || "No address"}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="addresses" className="mt-3">
                    {savedAddresses.length === 0 ? (
                      <p className="text-sm text-default-400 py-4 text-center">No addresses saved</p>
                    ) : (
                      savedAddresses.map((addr) => (
                        <div key={addr.id} className="p-3 bg-default-50 rounded-lg mb-2">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge className="text-[10px] bg-transparent border border-default-200 text-default-700">{addr.label}</Badge>
                            {addr.isDefault && <Badge className="text-[10px] bg-primary/10 text-primary">Default</Badge>}
                          </div>
                          <p className="text-sm text-default-600">
                            {getAddressLine(addr)}
                          </p>
                        </div>
                      ))
                    )}
                  </TabsContent>
                  <TabsContent value="returns" className="mt-3">
                    {(selectedCustomer.returnRequests || []).length === 0 ? (
                      <p className="text-sm text-default-400 py-4 text-center">No return requests</p>
                    ) : (
                      <div className="space-y-2">
                        {(selectedCustomer.returnRequests || []).map((request) => (
                          <div key={request.id} className="p-3 bg-default-50 rounded-lg">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-sm font-medium">Order {request.orderId || "Unknown"}</p>
                              <Badge className="text-[10px] capitalize bg-warning/10 text-warning">{request.status || "requested"}</Badge>
                            </div>
                            <p className="text-sm text-default-600 mt-1">{request.reason || "No reason provided"}</p>
                            {request.createdAt && <p className="text-xs text-default-400 mt-1">{new Date(request.createdAt).toLocaleDateString()}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="engagement" className="mt-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="p-4 rounded-lg border border-default-200 bg-default-50">
                        <div className="flex items-center gap-2 text-default-700">
                          <Heart className="h-4 w-4 text-warning" />
                          <p className="text-sm font-medium">Wishlist Items</p>
                        </div>
                        <p className="text-2xl font-semibold mt-2">{selectedCustomer.wishlistCount || 0}</p>
                        <p className="text-xs text-default-400 mt-1">Products saved by this customer.</p>
                      </div>
                      <div className="p-4 rounded-lg border border-default-200 bg-default-50">
                        <div className="flex items-center gap-2 text-default-700">
                          <Star className="h-4 w-4 text-warning" />
                          <p className="text-sm font-medium">Reviews</p>
                        </div>
                        <p className="text-2xl font-semibold mt-2">{selectedCustomer.reviewCount || 0}</p>
                        <p className="text-xs text-default-400 mt-1">Reviews submitted from the customer account area.</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-default-700">Wishlist Records</p>
                        {(selectedCustomer.wishlistItems || []).length === 0 ? (
                          <p className="text-sm text-default-400 rounded-lg border border-dashed border-default-200 p-3">No wishlist records</p>
                        ) : (
                          (selectedCustomer.wishlistItems || []).slice(0, 8).map((item) => (
                            <div key={item.id} className="p-3 rounded-lg bg-default-50 border border-default-100">
                              <p className="text-xs text-default-400">Product ID</p>
                              <p className="text-sm font-medium break-all">{item.productId || "Unknown"}</p>
                              {item.createdAt && <p className="text-xs text-default-400 mt-1">Saved {new Date(item.createdAt).toLocaleDateString()}</p>}
                            </div>
                          ))
                        )}
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-default-700">Review Records</p>
                        {(selectedCustomer.reviewItems || []).length === 0 ? (
                          <p className="text-sm text-default-400 rounded-lg border border-dashed border-default-200 p-3">No review records</p>
                        ) : (
                          (selectedCustomer.reviewItems || []).slice(0, 8).map((item) => (
                            <div key={item.id} className="p-3 rounded-lg bg-default-50 border border-default-100">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-sm font-medium break-all">{item.productId || "Unknown product"}</p>
                                <Badge className="text-[10px] capitalize bg-default-100 text-default-600">{item.status || "pending"}</Badge>
                              </div>
                              {item.createdAt && <p className="text-xs text-default-400 mt-1">Reviewed {new Date(item.createdAt).toLocaleDateString()}</p>}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerListPage;


