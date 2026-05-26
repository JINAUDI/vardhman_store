'use client'
import React, { useEffect, useCallback, useState, useMemo } from "react";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Link } from '@/i18n/routing';
import { Icon } from "@/components/ui/icon";
import { useConfig } from "@/hooks/use-config";
import { useAtomValue, useAtom } from "jotai";
import { productsAtom, ordersAtom, customersAtom, recentSearchesAtom } from "@/lib/store/ecommerce-store";
import { Badge } from "@/components/ui/badge";
import { formatINR } from "@/lib/utils/currency";

const HeaderSearch = () => {
    const [config] = useConfig();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const products = useAtomValue(productsAtom);
    const orders = useAtomValue(ordersAtom);
    const customers = useAtomValue(customersAtom);
    const [recentSearches, setRecentSearches] = useAtom(recentSearchesAtom);
    const safeRecentSearches = Array.isArray(recentSearches) ? recentSearches : [];

    // Ctrl+K shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "k") {
                e.preventDefault();
                setOpen((prev) => !prev);
            }
        };
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Save to recent searches
    const saveSearch = useCallback(
        (term: string) => {
            if (!term.trim()) return;
            setRecentSearches((prev) => {
                const previousSearches = Array.isArray(prev) ? prev : [];
                const filtered = previousSearches.filter((s) => s !== term);
                return [term, ...filtered].slice(0, 5);
            });
        },
        [setRecentSearches]
    );

    // Filter results based on query
    const filteredProducts = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        return products
            .filter((p) =>
                p.name.toLowerCase().includes(q) ||
                p.sku.toLowerCase().includes(q) ||
                p.category.toLowerCase().includes(q)
            )
            .slice(0, 5);
    }, [query, products]);

    const filteredOrders = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        return orders
            .filter((o) =>
                o.orderNumber.toLowerCase().includes(q) ||
                o.customerName.toLowerCase().includes(q)
            )
            .slice(0, 5);
    }, [query, orders]);

    const filteredCustomers = useMemo(() => {
        if (!query.trim()) return [];
        const q = query.toLowerCase();
        return customers
            .filter((c) =>
                c.name.toLowerCase().includes(q) ||
                c.email.toLowerCase().includes(q) ||
                c.phone.includes(q)
            )
            .slice(0, 5);
    }, [query, customers]);

    const hasResults =
        filteredProducts.length > 0 ||
        filteredOrders.length > 0 ||
        filteredCustomers.length > 0;

    const statusColors: Record<string, string> = {
        pending: "bg-warning/10 text-warning",
        confirmed: "bg-info/10 text-info",
        packed: "bg-primary/10 text-primary",
        shipped: "bg-warning/10 text-warning",
        delivered: "bg-success/10 text-success",
        cancelled: "bg-destructive/10 text-destructive",
    };

    if (config.layout === 'horizontal') return null;

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className="flex items-center xl:text-sm text-lg xl:text-default-400 text-default-800 dark:text-default-700 gap-3 cursor-pointer"
                >
                    <Icon icon="heroicons-outline:search" />
                    <span className="xl:inline-block hidden">Search...</span>
                    <kbd className="hidden xl:inline-flex h-5 items-center gap-1 rounded border bg-default-100 px-1.5 font-mono text-[10px] font-medium text-default-500">
                        <span className="text-xs">⌘</span>K
                    </kbd>
                </button>
            </DialogTrigger>
            <DialogContent className="p-0 max-w-[640px]">
                <DialogTitle className="hidden"></DialogTitle>
                <DialogDescription className="hidden"></DialogDescription>
                <Command className="bg-card" shouldFilter={false}>
                    <div className="flex items-center border-b border-default-200">
                        <CommandInput
                            placeholder="Search products, orders, customers..."
                            className="h-14 border-b-0"
                            value={query}
                            onValueChange={setQuery}
                        />
                    </div>
                    <CommandList className="py-3 px-3 max-h-[450px]">
                        {/* No query — show recent searches */}
                        {!query.trim() && (
                            <CommandGroup
                                heading="Recent Searches"
                                className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-default-400 [&_[cmdk-group-heading]]:mb-2 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest"
                            >
                                {safeRecentSearches.map((term, i) => (
                                    <CommandItem
                                        key={`recent-${i}`}
                                        className="aria-selected:bg-default-100 px-3 py-2 cursor-pointer"
                                        onSelect={() => setQuery(term)}
                                    >
                                        <Icon icon="heroicons:clock" className="mr-2 h-4 w-4 text-default-400" />
                                        <span className="text-sm text-default-600">{term}</span>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {/* Has query but no results */}
                        {query.trim() && !hasResults && (
                            <CommandEmpty>
                                <div className="flex flex-col items-center py-6">
                                    <Icon icon="heroicons:magnifying-glass" className="h-10 w-10 text-default-300 mb-2" />
                                    <p className="text-sm text-default-500">No results found for &ldquo;{query}&rdquo;</p>
                                </div>
                            </CommandEmpty>
                        )}

                        {/* Product results */}
                        {filteredProducts.length > 0 && (
                            <CommandGroup
                                heading="Products"
                                className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-default-400 [&_[cmdk-group-heading]]:mb-2 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest"
                            >
                                {filteredProducts.map((product) => (
                                    <CommandItem
                                        key={product.id}
                                        className="aria-selected:bg-default-100 px-3 py-2 cursor-pointer"
                                        onSelect={() => {
                                            saveSearch(product.name);
                                            setOpen(false);
                                        }}
                                    >
                                        <Link
                                            href={`/ecommerce/backend/products`}
                                            className="flex items-center gap-3 w-full"
                                        >
                                            <div className="h-8 w-8 rounded bg-default-100 flex items-center justify-center">
                                                <Icon icon="heroicons:cube" className="h-4 w-4 text-primary" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-default-700 truncate">{product.name}</p>
                                                <p className="text-xs text-default-400">{product.sku} • {formatINR(product.price, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                            </div>
                                            <Badge className="text-[10px] bg-default-100 text-default-500">{product.category}</Badge>
                                        </Link>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {/* Order results */}
                        {filteredOrders.length > 0 && (
                            <CommandGroup
                                heading="Orders"
                                className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-default-400 [&_[cmdk-group-heading]]:mb-2 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest"
                            >
                                {filteredOrders.map((order) => (
                                    <CommandItem
                                        key={order.id}
                                        className="aria-selected:bg-default-100 px-3 py-2 cursor-pointer"
                                        onSelect={() => {
                                            saveSearch(order.orderNumber);
                                            setOpen(false);
                                        }}
                                    >
                                        <Link
                                            href={`/ecommerce/backend/order-details?id=${order.id}`}
                                            className="flex items-center gap-3 w-full"
                                        >
                                            <div className="h-8 w-8 rounded bg-default-100 flex items-center justify-center">
                                                <Icon icon="heroicons:clipboard-document-list" className="h-4 w-4 text-info" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-default-700">{order.orderNumber}</p>
                                                <p className="text-xs text-default-400">{order.customerName} • {formatINR(order.total, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                            </div>
                                            <Badge className={`text-[10px] ${statusColors[order.status] || ""}`}>
                                                {order.status}
                                            </Badge>
                                        </Link>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}

                        {/* Customer results */}
                        {filteredCustomers.length > 0 && (
                            <CommandGroup
                                heading="Customers"
                                className="[&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-default-400 [&_[cmdk-group-heading]]:mb-2 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest"
                            >
                                {filteredCustomers.map((customer) => (
                                    <CommandItem
                                        key={customer.id}
                                        className="aria-selected:bg-default-100 px-3 py-2 cursor-pointer"
                                        onSelect={() => {
                                            saveSearch(customer.name);
                                            setOpen(false);
                                        }}
                                    >
                                        <Link
                                            href={`/ecommerce/backend/customer-list`}
                                            className="flex items-center gap-3 w-full"
                                        >
                                            <div className="h-8 w-8 rounded bg-default-100 flex items-center justify-center">
                                                <Icon icon="heroicons:user" className="h-4 w-4 text-success" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-default-700">{customer.name}</p>
                                                <p className="text-xs text-default-400">{customer.email}</p>
                                            </div>
                                            <span className="text-xs text-default-400">{customer.totalOrders} orders</span>
                                        </Link>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>

                    {/* Footer hint */}
                    <div className="border-t border-default-200 px-3 py-2 flex items-center gap-2 text-xs text-default-400">
                        <kbd className="rounded border bg-default-100 px-1 py-0.5 text-[10px]">↑↓</kbd>
                        <span>navigate</span>
                        <kbd className="rounded border bg-default-100 px-1 py-0.5 text-[10px]">↵</kbd>
                        <span>select</span>
                        <kbd className="rounded border bg-default-100 px-1 py-0.5 text-[10px]">esc</kbd>
                        <span>close</span>
                    </div>
                </Command>
            </DialogContent>
        </Dialog>
    );
};

export default HeaderSearch;
