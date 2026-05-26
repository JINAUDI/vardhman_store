"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useAtom, useAtomValue } from "jotai";
import { productsAtom, inventoryItemsAtom, lowStockCountAtom, outOfStockCountAtom } from "@/lib/store/ecommerce-store";
import { updateStockThreshold } from "@/lib/store/actions";
import type { Product } from "@/lib/store/types";
import { Search, AlertTriangle, Package, PackageX, ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import { Icon } from "@/components/ui/icon";
import { toast } from "sonner";

const PAGE_SIZE = 15;

const statusColors: Record<string, string> = {
  in_stock: "bg-success/10 text-success",
  low_stock: "bg-warning/10 text-warning",
  out_of_stock: "bg-destructive/10 text-destructive",
};

function getApiMessage(payload: unknown, fallback: string) {
  return typeof payload === "object" && payload && "message" in payload
    ? String((payload as { message?: unknown }).message || fallback)
    : fallback;
}

const InventoryPage = () => {
  const [products, setProducts] = useAtom(productsAtom);
  const inventory = useAtomValue(inventoryItemsAtom);
  const lowStockCount = useAtomValue(lowStockCountAtom);
  const outOfStockCount = useAtomValue(outOfStockCountAtom);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>("all");
  const [page, setPage] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const syncProductsFromApi = useCallback(async () => {
    const response = await fetch("/api/products", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok || !Array.isArray(payload.data)) {
      throw new Error(getApiMessage(payload, "Unable to fetch products."));
    }

    setProducts(payload.data as Product[]);
  }, [setProducts]);

  useEffect(() => {
    let cancelled = false;

    async function loadInventory() {
      setIsLoading(true);
      setLoadError(null);
      try {
        await syncProductsFromApi();
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load Supabase inventory.";
          setLoadError(message);
          toast.error("Unable to load synced inventory");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    void loadInventory();

    return () => {
      cancelled = true;
    };
  }, [syncProductsFromApi]);

  const filtered = useMemo(() => {
    let result = inventory;
    if (filter !== "all") {
      result = result.filter((i) => i.status === filter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) => i.productName.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q)
      );
    }
    return result;
  }, [inventory, filter, search]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSaveThreshold = async (productId: string) => {
    const val = parseInt(editValue, 10);
    if (Number.isNaN(val) || val < 0) {
      setEditingId(null);
      return;
    }

    const previous = products;
    setSavingId(productId);
    setProducts((prev) => updateStockThreshold(prev, productId, val));

    try {
      const response = await fetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lowStockThreshold: val }),
      });
      const payload = await response.json();

      if (!response.ok || !payload.data) {
        throw new Error(getApiMessage(payload, "Unable to update stock threshold."));
      }

      setProducts((prev) =>
        prev.map((product) => (product.id === productId ? (payload.data as Product) : product))
      );
      toast.success("Stock threshold updated");
    } catch (error) {
      setProducts(previous);
      toast.error(error instanceof Error ? error.message : "Unable to update stock threshold");
    } finally {
      setSavingId(null);
      setEditingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-default-900">Inventory</h2>
        <p className="text-sm text-default-500 mt-1">Monitor and manage product stock levels</p>
        {loadError && <p className="text-xs text-destructive mt-1">{loadError}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setFilter("all")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-default-500">Total Products</p>
              <p className="text-xl font-semibold text-default-900">{inventory.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer hover:shadow-md transition-shadow", filter === "low_stock" && "ring-2 ring-warning/30")} onClick={() => setFilter("low_stock")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-default-500">Low Stock</p>
              <p className="text-xl font-semibold text-warning">{lowStockCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card className={cn("cursor-pointer hover:shadow-md transition-shadow", filter === "out_of_stock" && "ring-2 ring-destructive/30")} onClick={() => setFilter("out_of_stock")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-11 w-11 rounded-full bg-destructive/10 flex items-center justify-center">
              <PackageX className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-default-500">Out of Stock</p>
              <p className="text-xl font-semibold text-destructive">{outOfStockCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="relative w-full sm:max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-default-400" />
              <Input placeholder="Search by product or SKU..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} className="pl-9 h-9" />
            </div>
            <div className="flex gap-1">
              {["all", "in_stock", "low_stock", "out_of_stock"].map((f) => (
                <Button key={f} variant={filter === f ? "default" : "outline"} size="sm" onClick={() => { setFilter(f); setPage(0); }} className="capitalize text-xs">
                  {f.replace(/_/g, " ")}
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-default-200">
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-center">Stock</TableHead>
                <TableHead className="text-center">Threshold</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center">
                    <div className="flex flex-col items-center text-default-400">
                      <LoaderCircle className="h-6 w-6 mb-2 animate-spin" />
                      <p>Loading inventory...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-32 text-center text-default-400">No items found</TableCell>
                </TableRow>
              ) : (
                paginated.map((item) => (
                  <TableRow key={item.productId} className={cn("h-[56px]", item.status === "out_of_stock" && "bg-destructive/[0.02]", item.status === "low_stock" && "bg-warning/[0.02]")}>
                    <TableCell>
                      <p className="text-sm font-medium text-default-700 truncate max-w-[200px]">{item.productName}</p>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-default-100 px-1.5 py-0.5 rounded text-default-600">{item.sku}</code>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn("text-sm font-semibold", item.currentStock === 0 ? "text-destructive" : item.currentStock <= item.lowStockThreshold ? "text-warning" : "text-default-800")}>
                        {item.currentStock}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      {editingId === item.productId ? (
                        <div className="flex items-center justify-center gap-1">
                          <Input className="h-7 w-16 text-center text-sm" value={editValue} onChange={(e) => setEditValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void handleSaveThreshold(item.productId)} autoFocus />
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-success" disabled={savingId === item.productId} onClick={() => void handleSaveThreshold(item.productId)}>
                            {savingId === item.productId ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Icon icon="heroicons:check" className="h-3.5 w-3.5" />}
                          </Button>
                        </div>
                      ) : (
                        <button className="text-sm text-default-600 hover:text-primary cursor-pointer" onClick={() => { setEditingId(item.productId); setEditValue(item.lowStockThreshold.toString()); }}>
                          {item.lowStockThreshold}
                        </button>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge className={cn("text-[11px] capitalize rounded-full px-2.5", statusColors[item.status])}>
                        {item.status.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
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
    </div>
  );
};

export default InventoryPage;
