"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/utils/currency";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AbandonedCart } from "@/lib/store/types";
import {
  Clock3,
  Eye,
  LoaderCircle,
  Mail,
  Phone,
  RefreshCw,
  Search,
  ShoppingCart,
  TimerReset,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";

const ABANDONED_AFTER_MINUTES = 30;

type ApiResponse<T> = {
  status?: string;
  data?: T;
  message?: string;
};

type CartViewStatus = "all" | "abandoned" | "active" | "converted" | "emptied";

function getApiMessage(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload && "message" in payload
    ? String((payload as { message?: unknown }).message || fallback)
    : fallback;
}

function getAgeMinutes(value: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 60000));
}

function getCartViewStatus(cart: AbandonedCart): Exclude<CartViewStatus, "all"> {
  if (cart.status === "converted") return "converted";
  if (cart.status === "emptied" || cart.itemCount <= 0) return "emptied";
  return getAgeMinutes(cart.lastActivityAt) >= ABANDONED_AFTER_MINUTES ? "abandoned" : "active";
}

function getStatusClass(status: Exclude<CartViewStatus, "all">) {
  if (status === "abandoned") return "bg-warning/10 text-warning";
  if (status === "active") return "bg-info/10 text-info";
  if (status === "converted") return "bg-success/10 text-success";
  return "bg-default-100 text-default-500";
}

function getTimeAgo(value: string) {
  const minutes = getAgeMinutes(value);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function getCustomerLabel(cart: AbandonedCart) {
  return cart.customerName || cart.customerEmail || cart.customerPhone || "Guest shopper";
}

function getCartSearchText(cart: AbandonedCart) {
  return [
    cart.sessionId,
    cart.customerName,
    cart.customerEmail,
    cart.customerPhone,
    cart.items.map((item) => item.name).join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

const filters: Array<{ value: CartViewStatus; label: string }> = [
  { value: "all", label: "All" },
  { value: "abandoned", label: "Abandoned" },
  { value: "active", label: "Active" },
  { value: "converted", label: "Converted" },
  { value: "emptied", label: "Emptied" },
];

export default function AbandonedCartsPage() {
  const [carts, setCarts] = useState<AbandonedCart[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<CartViewStatus>("abandoned");
  const [search, setSearch] = useState("");
  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);

  const syncCarts = useCallback(async () => {
    const response = await fetch("/api/abandoned-carts", { cache: "no-store" });
    const payload = (await response.json()) as ApiResponse<AbandonedCart[]>;

    if (!response.ok || !Array.isArray(payload.data)) {
      throw new Error(getApiMessage(payload, "Unable to fetch abandoned carts."));
    }

    setCarts(payload.data);
    return payload.data;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCarts() {
      setIsLoading(true);
      setLoadError(null);
      try {
        await syncCarts();
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load abandoned carts.";
          setLoadError(message);
          toast.error("Unable to load abandoned carts");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadCarts();

    return () => {
      cancelled = true;
    };
  }, [syncCarts]);

  useEffect(() => {
    let isMounted = true;
    let supabase: ReturnType<typeof getSupabaseBrowserClient>;

    try {
      supabase = getSupabaseBrowserClient();
    } catch (error) {
      console.warn("[abandoned-carts] Unable to initialize realtime client.", error);
      return () => {
        isMounted = false;
      };
    }

    const channel = supabase
      .channel("dashboard-abandoned-carts")
      .on("postgres_changes", { event: "*", schema: "public", table: "abandoned_carts" }, () => {
        if (!isMounted) return;
        void syncCarts().catch((error) => console.warn("[abandoned-carts] Realtime refresh failed.", error));
      })
      .subscribe();

    return () => {
      isMounted = false;
      void supabase.removeChannel(channel);
    };
  }, [syncCarts]);

  const summary = useMemo(() => {
    return carts.reduce(
      (acc, cart) => {
        const status = getCartViewStatus(cart);
        if (status === "abandoned") {
          acc.abandoned += 1;
          acc.recoverableValue += cart.total || cart.subtotal;
        }
        if (status === "active") acc.active += 1;
        if (status === "converted") acc.converted += 1;
        acc.totalValue += cart.total || cart.subtotal;
        return acc;
      },
      { abandoned: 0, active: 0, converted: 0, recoverableValue: 0, totalValue: 0 }
    );
  }, [carts]);

  const filteredCarts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return carts
      .filter((cart) => {
        const status = getCartViewStatus(cart);
        if (activeFilter !== "all" && status !== activeFilter) return false;
        return !q || getCartSearchText(cart).includes(q);
      })
      .sort((left, right) => new Date(right.lastActivityAt).getTime() - new Date(left.lastActivityAt).getTime());
  }, [activeFilter, carts, search]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-default-900">Abandoned Carts</h2>
          <p className="text-sm text-default-500 mt-1">
            Track shoppers who added products but did not complete checkout.
          </p>
          {loadError && <p className="text-xs text-destructive mt-1">{loadError}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={() => void syncCarts()} disabled={isLoading}>
          <RefreshCw className={cn("h-4 w-4 me-2", isLoading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-warning/10 flex items-center justify-center">
              <TimerReset className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-default-500">Abandoned</p>
              <p className="text-xl font-semibold">{summary.abandoned}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-info/10 flex items-center justify-center">
              <ShoppingCart className="h-5 w-5 text-info" />
            </div>
            <div>
              <p className="text-sm text-default-500">Active Carts</p>
              <p className="text-xl font-semibold">{summary.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-success/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-default-500">Converted</p>
              <p className="text-xl font-semibold">{summary.converted}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-default-500">Recoverable Value</p>
              <p className="text-xl font-semibold">{formatINR(summary.recoverableValue, { maximumFractionDigits: 0 })}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-default-400" />
              <Input
                placeholder="Search customer, phone, item, session..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => (
                <Button
                  key={filter.value}
                  type="button"
                  size="sm"
                  variant={activeFilter === filter.value ? "default" : "outline"}
                  onClick={() => setActiveFilter(filter.value)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-default-200">
                <TableHead>Shopper</TableHead>
                <TableHead>Cart</TableHead>
                <TableHead className="text-right">Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Activity</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center">
                    <div className="flex flex-col items-center text-default-400">
                      <LoaderCircle className="h-6 w-6 mb-2 animate-spin" />
                      <p>Loading carts...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredCarts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-default-400">
                    No carts match this view
                  </TableCell>
                </TableRow>
              ) : (
                filteredCarts.map((cart) => {
                  const status = getCartViewStatus(cart);
                  const firstItems = cart.items.slice(0, 2).map((item) => item.name).join(", ");
                  return (
                    <TableRow key={cart.id} className="h-[72px] hover:bg-default-50">
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-default-800">{getCustomerLabel(cart)}</p>
                          <p className="text-xs text-default-400">{cart.customerEmail || cart.customerPhone || `Session ${cart.sessionId.slice(0, 8)}`}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-default-700">{cart.itemCount} item{cart.itemCount === 1 ? "" : "s"}</p>
                        <p className="text-xs text-default-400 max-w-[320px] truncate">{firstItems || "No items"}</p>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">
                        {formatINR(cart.total || cart.subtotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-[11px] rounded-full capitalize", getStatusClass(status))}>
                          {status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm text-default-700">{getTimeAgo(cart.lastActivityAt)}</p>
                        <p className="text-xs text-default-400">{new Date(cart.lastActivityAt).toLocaleString("en-IN")}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setSelectedCart(cart)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!selectedCart} onOpenChange={(open) => !open && setSelectedCart(null)}>
        <DialogContent className="max-w-[760px] max-h-[85vh]">
          <DialogHeader>
            <DialogTitle>Cart Details</DialogTitle>
          </DialogHeader>
          {selectedCart && (
            <ScrollArea className="max-h-[70vh]">
              <div className="space-y-5 pr-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg bg-default-50 p-3">
                    <p className="text-xs text-default-400">Customer</p>
                    <p className="text-sm font-semibold mt-1">{getCustomerLabel(selectedCart)}</p>
                  </div>
                  <div className="rounded-lg bg-default-50 p-3">
                    <p className="text-xs text-default-400">Cart Value</p>
                    <p className="text-sm font-semibold mt-1">{formatINR(selectedCart.total || selectedCart.subtotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <div className="rounded-lg bg-default-50 p-3">
                    <p className="text-xs text-default-400">Last Activity</p>
                    <p className="text-sm font-semibold mt-1">{getTimeAgo(selectedCart.lastActivityAt)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="rounded-lg border border-default-200 bg-default-50 p-3">
                    <div className="flex items-center gap-2 text-default-500">
                      <Mail className="h-4 w-4" />
                      <p className="text-xs font-medium">Email</p>
                    </div>
                    <p className="mt-2 text-sm font-medium break-all">{selectedCart.customerEmail || "Not captured"}</p>
                  </div>
                  <div className="rounded-lg border border-default-200 bg-default-50 p-3">
                    <div className="flex items-center gap-2 text-default-500">
                      <Phone className="h-4 w-4" />
                      <p className="text-xs font-medium">Phone</p>
                    </div>
                    <p className="mt-2 text-sm font-medium">{selectedCart.customerPhone || "Not captured"}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-semibold text-default-800">Products</p>
                  {selectedCart.items.map((item) => (
                    <div key={`${item.productId}-${item.name}`} className="flex items-center justify-between gap-3 rounded-lg border border-default-200 p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="h-12 w-12 rounded-md object-cover" />
                        ) : (
                          <div className="h-12 w-12 rounded-md bg-default-100" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-default-800">{item.name}</p>
                          <p className="text-xs text-default-400">Qty {item.quantity} x {formatINR(item.price, { maximumFractionDigits: 0 })}</p>
                        </div>
                      </div>
                      <p className="text-sm font-semibold">{formatINR(item.price * item.quantity, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  ))}
                </div>

                <div className="rounded-lg bg-default-50 p-3 text-xs text-default-500">
                  Session: {selectedCart.sessionId}
                  {selectedCart.sourcePage && <span className="block mt-1">Last page: {selectedCart.sourcePage}</span>}
                  {selectedCart.convertedOrderId && <span className="block mt-1">Converted order: {selectedCart.convertedOrderId}</span>}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
