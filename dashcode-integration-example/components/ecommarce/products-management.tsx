"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Link } from "@/i18n/routing";
import { routing } from "@/i18n/routing";
import {
  authUserAtom,
  productsAtom,
} from "@/lib/store/ecommerce-store";
import {
  bulkDeleteProducts,
  deleteProduct,
  duplicateProduct,
  exportToCSV,
  toggleFeatured,
  toggleProductVisibility,
  updateProduct,
} from "@/lib/store/actions";
import { track } from "@/lib/analytics/analytics";
import type { Product } from "@/lib/store/types";
import { cn } from "@/lib/utils";
import { formatINR } from "@/lib/utils/currency";
import { toast } from "sonner";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Grid3X3,
  List,
  LoaderCircle,
  MoreHorizontal,
  Search,
  Star,
  Trash2,
  Copy,
  Pencil,
  Plus,
  Download,
  EyeOff,
} from "lucide-react";

const PAGE_SIZE = 12;

const requestedCategories = [
  "All",
  "Electronics",
  "Mobile Accessories",
  "Health Supplements",
  "Hygiene & Personal Care",
  "Baby Products",
  "Household Items",
];

const sortOptions = [
  { value: "newest", label: "Newest First" },
  { value: "price_desc", label: "Price High to Low" },
  { value: "price_asc", label: "Price Low to High" },
  { value: "stock_asc", label: "Stock Low to High" },
] as const;

const statusFilterOptions = [
  { value: "all", label: "All status" },
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "hidden", label: "Hidden" },
  { value: "out_of_stock", label: "Out of Stock" },
  { value: "featured", label: "Featured" },
] as const;

const productStatusOptions: Array<{ value: Product["status"]; label: string }> = [
  { value: "active", label: "Active" },
  { value: "draft", label: "Draft" },
  { value: "hidden", label: "Hidden" },
  { value: "out_of_stock", label: "Out of Stock" },
];

const storefrontBaseUrl =
  process.env.NEXT_PUBLIC_RADIOS_STOREFRONT_URL ||
  process.env.NEXT_PUBLIC_STOREFRONT_URL ||
  process.env.NEXT_PUBLIC_STORE_URL ||
  "http://127.0.0.1:8080";

const configuredStorefrontProductRoute =
  process.env.NEXT_PUBLIC_STOREFRONT_PRODUCT_ROUTE || "";
const defaultStorefrontSlugRoute = "shop-single.html?slug=:slug";
const defaultStorefrontIdRoute = "shop-single.html?id=:id";

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, "");
}

function replaceRouteToken(route: string, token: string, value: string) {
  return route.split(token).join(value);
}

function getStorefrontProductUrl(product: Product) {
  const baseUrl = storefrontBaseUrl.trim().replace(/\/+$/g, "");
  const slug = product.slug?.trim();
  const routeTemplate =
    configuredStorefrontProductRoute.trim() ||
    (slug ? defaultStorefrontSlugRoute : defaultStorefrontIdRoute);
  const id = encodeURIComponent(product.id);
  const slugOrId = encodeURIComponent(slug || product.id);
  let route = routeTemplate.replace(/^\/+/, "");
  const hadPlaceholder = /(:id|:slug|\{id\}|\{slug\})/.test(route);

  route = replaceRouteToken(route, ":slug", slugOrId);
  route = replaceRouteToken(route, "{slug}", slugOrId);
  route = replaceRouteToken(route, ":id", id);
  route = replaceRouteToken(route, "{id}", id);

  if (!hadPlaceholder) {
    if (route.includes("?")) {
      const url = new URL(`${baseUrl}/${route}`);
      if (!url.searchParams.has("id") && !url.searchParams.has("slug")) {
        url.searchParams.set(slug ? "slug" : "id", slug || product.id);
      }
      return url.toString();
    }

    return `${baseUrl}/${trimSlashes(route)}/${slugOrId}`;
  }

  return `${baseUrl}/${route}`;
}

type SortValue = (typeof sortOptions)[number]["value"];
type StatusFilterValue = (typeof statusFilterOptions)[number]["value"];

type EditFormState = {
  name: string;
  category: string;
  price: string;
  compareAtPrice: string;
  sku: string;
  stock: string;
  lowStockThreshold: string;
  status: Product["status"];
  featured: boolean;
  description: string;
};

type ApiCategory = {
  name: string;
  isActive?: boolean;
};

function createEditForm(product: Product): EditFormState {
  return {
    name: product.name,
    category: product.category,
    price: product.price.toString(),
    compareAtPrice: product.compareAtPrice?.toString() || "",
    sku: product.sku,
    stock: product.stock.toString(),
    lowStockThreshold: product.lowStockThreshold.toString(),
    status: getProductAdminStatus(product),
    featured: product.featured,
    description: product.description,
  };
}

function getAvailableStock(product: Product) {
  return typeof product.availableStock === "number"
    ? product.availableStock
    : Math.max(product.stock - (product.reservedStock || 0), 0);
}

function getInventoryStatus(product: Product): NonNullable<Product["inventoryStatus"]> {
  if (product.trackInventory === false) return "not_tracked";
  if (product.inventoryStatus) return product.inventoryStatus;
  const availableStock = getAvailableStock(product);
  if (availableStock <= 0 && product.allowBackorder !== true) return "out_of_stock";
  if (availableStock <= product.lowStockThreshold) return "low_stock";
  return "in_stock";
}

function stockTone(product: Product) {
  const status = getInventoryStatus(product);

  if (status === "in_stock") {
    return {
      dot: "bg-success",
      text: "text-success",
      badge: "bg-success/10 text-success",
      label: "In Stock",
    };
  }

  if (status === "low_stock") {
    return {
      dot: "bg-warning",
      text: "text-warning",
      badge: "bg-warning/10 text-warning",
      label: "Low Stock",
    };
  }

  if (status === "not_tracked") {
    return {
      dot: "bg-default-400",
      text: "text-default-500",
      badge: "bg-default-100 text-default-600",
      label: "Not Tracked",
    };
  }

  return {
    dot: "bg-destructive",
    text: "text-destructive",
    badge: "bg-destructive/10 text-destructive",
    label: "Out of Stock",
  };
}

function isAutoHiddenFromStore(product: Product) {
  return (
    (getInventoryStatus(product) === "out_of_stock" || product.status === "out_of_stock") &&
    product.allowBackorder !== true
  );
}

function getProductAdminStatus(product: Product): Product["status"] {
  if (isAutoHiddenFromStore(product)) return "out_of_stock";
  if (product.status === "draft") return "draft";
  if (product.status === "hidden" || product.visible === false || product.isVisible === false) return "hidden";
  if (product.status === "archived") return "archived";
  return "active";
}

function productStatusTone(product: Product) {
  const status = getProductAdminStatus(product);

  if (status === "out_of_stock") {
    return {
      className: "bg-destructive/10 text-destructive",
      label: "Out of Stock",
    };
  }

  if (status === "hidden") {
    return {
      className: "bg-default-200 text-default-600",
      label: "Hidden",
    };
  }

  if (status === "draft") {
    return {
      className: "bg-warning/10 text-warning",
      label: "Draft",
    };
  }

  if (status === "archived") {
    return {
      className: "bg-default-100 text-default-500",
      label: "Archived",
    };
  }

  return {
    className: "bg-success/10 text-success",
    label: "Active",
  };
}

function isVisibleOnStorefront(product: Product) {
  return getProductAdminStatus(product) === "active" && product.visible !== false && !isAutoHiddenFromStore(product);
}

function formatCurrency(value: number) {
  return formatINR(value, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

const PRODUCT_PLACEHOLDER_IMAGE = "/images/all-img/p-1.png";
const productStatuses: Product["status"][] = ["active", "draft", "hidden", "out_of_stock", "archived"];
const inventoryStatuses: NonNullable<Product["inventoryStatus"]>[] = ["in_stock", "low_stock", "out_of_stock", "not_tracked"];

function safeString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function safeBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function safeDateString(value: unknown) {
  const raw = safeString(value);
  if (!raw) return new Date().toISOString();
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function normalizeProductStatus(value: unknown, stock: number): Product["status"] {
  const status = safeString(value).toLowerCase();
  if (productStatuses.includes(status as Product["status"])) return status as Product["status"];
  if (["published", "enabled", "live"].includes(status)) return "active";
  if (["inactive", "disabled", "unpublished"].includes(status)) return "hidden";
  return stock <= 0 ? "out_of_stock" : "active";
}

function normalizeInventoryStatus(value: unknown, stock: number, reservedStock: number, lowStockThreshold: number): Product["inventoryStatus"] {
  const status = safeString(value).toLowerCase();
  if (inventoryStatuses.includes(status as NonNullable<Product["inventoryStatus"]>)) {
    return status as Product["inventoryStatus"];
  }
  const available = Math.max(stock - reservedStock, 0);
  if (available <= 0) return "out_of_stock";
  if (available <= lowStockThreshold) return "low_stock";
  return "in_stock";
}

function normalizeProduct(rawProduct: unknown, index: number): Product | null {
  if (!rawProduct || typeof rawProduct !== "object") return null;

  const raw = rawProduct as Record<string, unknown>;
  const id = safeString(raw.id, `product-${index + 1}`);
  const name = safeString(raw.name, safeString(raw.title, safeString(raw.productName, `Product ${index + 1}`)));
  const sku = safeString(raw.sku, `SKU-${id.slice(0, 8).toUpperCase()}`);
  const imageFromField = safeString(raw.imageUrl, safeString(raw.image_url, safeString(raw.image)));
  const imagesFromArray = Array.isArray(raw.images)
    ? raw.images.map((image) => safeString(image)).filter(Boolean)
    : [];
  const images = Array.from(new Set([imageFromField, ...imagesFromArray].filter(Boolean)));
  const stock = Math.max(0, safeNumber(raw.stock, safeNumber(raw.quantity, 0)));
  const reservedStock = Math.max(0, safeNumber(raw.reservedStock, safeNumber(raw.reserved_stock, 0)));
  const availableStock = Math.max(0, safeNumber(raw.availableStock, safeNumber(raw.available_stock, stock - reservedStock)));
  const lowStockThreshold = Math.max(0, safeNumber(raw.lowStockThreshold, safeNumber(raw.low_stock_threshold, 10)));
  const status = normalizeProductStatus(raw.status, stock);
  const category = safeString(raw.category, safeString(raw.category_name, "Uncategorized"));
  const tags = Array.isArray(raw.tags) ? raw.tags.map((tag) => safeString(tag)).filter(Boolean) : [];
  const variants = Array.isArray(raw.variants) ? (raw.variants as Product["variants"]) : [];

  return {
    ...(rawProduct as Product),
    id,
    name,
    slug: safeString(raw.slug, name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")),
    sku,
    description: safeString(raw.description),
    price: Math.max(0, safeNumber(raw.price, 0)),
    compareAtPrice: raw.compareAtPrice === undefined && raw.compare_at_price === undefined
      ? undefined
      : Math.max(0, safeNumber(raw.compareAtPrice, safeNumber(raw.compare_at_price, 0))),
    images: images.length ? images : [PRODUCT_PLACEHOLDER_IMAGE],
    category,
    tags,
    variants,
    stock,
    reservedStock,
    availableStock,
    lowStockThreshold,
    trackInventory: safeBoolean(raw.trackInventory, safeBoolean(raw.track_inventory, true)),
    allowBackorder: safeBoolean(raw.allowBackorder, safeBoolean(raw.allow_backorder, false)),
    inventoryStatus: normalizeInventoryStatus(raw.inventoryStatus || raw.inventory_status, stock, reservedStock, lowStockThreshold),
    status,
    featured: safeBoolean(raw.featured, safeBoolean(raw.isFeatured, safeBoolean(raw.is_featured, false))),
    visible: safeBoolean(raw.visible, status === "active"),
    isVisible: safeBoolean(raw.isVisible, safeBoolean(raw.is_active, status === "active")),
    metaTitle: safeString(raw.metaTitle, safeString(raw.meta_title, name)),
    metaDescription: safeString(raw.metaDescription, safeString(raw.meta_description)),
    createdAt: safeDateString(raw.createdAt || raw.created_at),
    updatedAt: safeDateString(raw.updatedAt || raw.updated_at),
  };
}

function normalizeProducts(rawProducts: unknown): Product[] {
  if (!Array.isArray(rawProducts)) return [];
  return rawProducts
    .map((product, index) => normalizeProduct(product, index))
    .filter((product): product is Product => Boolean(product));
}

const ProductsManagement = () => {
  const [storedProducts, setProducts] = useAtom(productsAtom);
  const products = useMemo(() => normalizeProducts(storedProducts), [storedProducts]);
  const authUser = useAtomValue(authUserAtom);
  const userId = authUser?.id || "anonymous";

  const [isLoading, setIsLoading] = useState(false);
  const [rawSearch, setRawSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState<SortValue>("newest");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>("all");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState<EditFormState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [catalogCategories, setCatalogCategories] = useState<string[]>(requestedCategories);

  const productsRef = useRef(products);

  const syncProductsFromApi = useCallback(async () => {
    const response = await fetch("/api/products", {
      cache: "no-store",
    });

    if (!response.ok) {
      let message = "Unable to fetch products";
      try {
        const payload = await response.json();
        message = payload?.message || message;
      } catch {
        // Ignore parse errors and use the fallback message.
      }
      throw new Error(message);
    }

    const payload = await response.json();
    if (!Array.isArray(payload.data)) {
      throw new Error("Products response payload is invalid.");
    }

    const nextProducts = normalizeProducts(payload.data);
    productsRef.current = nextProducts;
    setProducts(nextProducts);
    return nextProducts;
  }, [setProducts]);

  useEffect(() => {
    productsRef.current = products;
  }, [products]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(rawSearch.trim());
    }, 300);

    return () => clearTimeout(timeout);
  }, [rawSearch]);

  useEffect(() => {
    track("page_view", {
      page: "products_admin",
      userId,
    });

    let cancelled = false;

    const loadProducts = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const nextProducts = await syncProductsFromApi();
        if (!cancelled) {
          productsRef.current = nextProducts;
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to load products from the database.";
          setLoadError(message);
          toast.error("Unable to load products");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadProducts();

    return () => {
      cancelled = true;
    };
  }, [syncProductsFromApi, userId]);

  useEffect(() => {
    let cancelled = false;

    const loadCategories = async () => {
      try {
        const response = await fetch("/api/categories?active=true", {
          cache: "no-store",
        });
        const payload = await response.json();

        if (!response.ok || !Array.isArray(payload.data)) {
          return;
        }

        if (!cancelled) {
          setCatalogCategories(
            payload.data
              .filter((item: ApiCategory) => item?.isActive !== false)
              .map((item: ApiCategory) => item.name)
          );
        }
      } catch {
        // Keep the requested default categories if the catalog endpoint is unavailable.
      }
    };

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setSelectedIds((current) =>
      current.filter((id) => products.some((product) => product.id === id))
    );
  }, [products]);

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...requestedCategories,
          ...catalogCategories,
          ...products.map((product) => product.category).filter(Boolean),
        ])
      ),
    [catalogCategories, products]
  );

  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (category !== "All") {
      result = result.filter((product) => product.category === category);
    }

    if (lowStockOnly) {
      result = result.filter((product) => {
        const status = getInventoryStatus(product);
        return status === "low_stock" || status === "out_of_stock";
      });
    }

    if (statusFilter !== "all") {
      result = result.filter((product) =>
        statusFilter === "featured"
          ? product.featured
          : getProductAdminStatus(product) === statusFilter
      );
    }

    if (debouncedSearch) {
      const query = debouncedSearch.toLowerCase();
      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query)
      );
    }

    result.sort((left, right) => {
      if (sortBy === "price_desc") return right.price - left.price;
      if (sortBy === "price_asc") return left.price - right.price;
      if (sortBy === "stock_asc") return getAvailableStock(left) - getAvailableStock(right);
      return (
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      );
    });

    return result;
  }, [category, debouncedSearch, lowStockOnly, products, sortBy, statusFilter]);

  useEffect(() => {
    if (!debouncedSearch) return;
    track("product_search", {
      query: debouncedSearch,
      results: filteredProducts.length,
      userId,
    });
  }, [debouncedSearch, filteredProducts.length, userId]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paginatedProducts = filteredProducts.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  const selectedProducts = useMemo(
    () => products.filter((product) => selectedIds.includes(product.id)),
    [products, selectedIds]
  );

  const allVisibleSelected =
    paginatedProducts.length > 0 &&
    paginatedProducts.every((product) => selectedIds.includes(product.id));

  const applyOptimisticProducts = async (
    updater: (current: Product[]) => Product[],
    request: () => Promise<Response>
  ) => {
    const previous = productsRef.current;
    const next = updater(previous);
    productsRef.current = next;
    setProducts(next);

    try {
      const response = await request();
      if (!response.ok) {
        let message = "Request failed";
        try {
          const payload = await response.json();
          message = payload?.message || message;
        } catch {
          // Ignore body parse errors and use the fallback message.
        }
        throw new Error(message);
      }
      return response;
    } catch {
      productsRef.current = previous;
      setProducts(previous);
      throw new Error("Unable to complete the product action.");
    }
  };

  const handleToggleFeatured = async (productId: string) => {
    const nextFeatured =
      !productsRef.current.find((product) => product.id === productId)?.featured;
    try {
      await applyOptimisticProducts(
        (current) => toggleFeatured(current, productId),
        () =>
          fetch(`/api/products/${productId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              featured: nextFeatured,
            }),
          })
      );
      await syncProductsFromApi();
      toast.success("Product featured status updated");
    } catch {
      toast.error("Unable to update featured status");
    }
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setEditForm(createEditForm(product));
    setOpenMenuId(null);
    track("product_edit_open", {
      productId: product.id,
      userId,
    });
  };

  const handleSaveEdit = async () => {
    if (!editingProduct || !editForm) return;

    const nextStock = parseInt(editForm.stock, 10) || 0;
    if (editForm.status === "active" && nextStock <= 0) {
      toast.error("Restock this product before marking it Active.");
      return;
    }

    const storefrontVisible = editForm.status === "active";
    const updates: Partial<Product> = {
      name: editForm.name.trim(),
      category: editForm.category,
      price: parseFloat(editForm.price) || 0,
      compareAtPrice: editForm.compareAtPrice
        ? parseFloat(editForm.compareAtPrice)
        : undefined,
      sku: editForm.sku.trim(),
      stock: nextStock,
      lowStockThreshold: parseInt(editForm.lowStockThreshold, 10) || 10,
      status: editForm.status,
      visible: storefrontVisible,
      isVisible: storefrontVisible,
      featured: editForm.featured,
      description: editForm.description.trim(),
    };

    try {
      await applyOptimisticProducts(
        (current) => updateProduct(current, editingProduct.id, updates),
        () =>
          fetch(`/api/products/${editingProduct.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updates),
          })
      );
      await syncProductsFromApi();

      track("product_updated", {
        productId: editingProduct.id,
        userId,
        fieldCount: Object.keys(updates).length,
      });

      toast.success("Product updated successfully");
      setEditingProduct(null);
      setEditForm(null);
    } catch {
      toast.error("Unable to update product");
    }
  };

  const handleDuplicate = async (product: Product) => {
    setOpenMenuId(null);
    try {
      await applyOptimisticProducts(
        (current) => duplicateProduct(current, product.id),
        () =>
          fetch(`/api/products/duplicate/${product.id}`, {
            method: "POST",
          })
      );
      await syncProductsFromApi();

      track("product_duplicated", {
        productId: product.id,
        userId,
      });
      toast.success("Product duplicated");
    } catch {
      toast.error("Unable to duplicate product");
    }
  };

  const handleSetProductStatus = async (product: Product, status: Product["status"]) => {
    setOpenMenuId(null);

    if (status === "active" && isAutoHiddenFromStore(product)) {
      toast.error("Restock this product before marking it Active.");
      return;
    }

    const storefrontVisible = status === "active";

    try {
      await applyOptimisticProducts(
        (current) =>
          updateProduct(current, product.id, {
            status,
            visible: storefrontVisible,
            isVisible: storefrontVisible,
          }),
        () =>
          fetch(`/api/products/${product.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status,
              visible: storefrontVisible,
              isVisible: storefrontVisible,
            }),
          })
      );
      await syncProductsFromApi();

      track("product_updated", {
        productId: product.id,
        status,
        userId,
      });
      toast.success(`Product marked ${status.replace(/_/g, " ")}`);
    } catch {
      toast.error("Unable to update product status");
    }
  };

  const handleToggleVisibility = async (product: Product) => {
    const nextVisible = product.visible === false || product.isVisible === false;
    setOpenMenuId(null);

    if (nextVisible && isAutoHiddenFromStore(product)) {
      toast.error("Restock this product before showing it on the storefront.");
      return;
    }

    try {
      await applyOptimisticProducts(
        (current) => toggleProductVisibility(current, product.id),
        () =>
          fetch(`/api/products/${product.id}/visibility`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ visible: nextVisible }),
          })
      );
      await syncProductsFromApi();

      track("product_visibility_toggled", {
        productId: product.id,
        userId,
        visible: nextVisible,
      });
      toast.success(nextVisible ? "Product is now visible" : "Product is now hidden");
    } catch {
      toast.error("Unable to update product visibility");
    }
  };
  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;

    const productId = deleteTarget.id;
    try {
      await applyOptimisticProducts(
        (current) => deleteProduct(current, productId),
        () =>
          fetch(`/api/products/${productId}`, {
            method: "DELETE",
          })
      );
      await syncProductsFromApi();

      track("product_deleted", {
        productId,
        userId,
      });

      toast.success("Product deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Unable to delete product");
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    const ids = [...selectedIds];
    try {
      await applyOptimisticProducts(
        (current) => bulkDeleteProducts(current, ids),
        () =>
          fetch("/api/products/bulk-delete", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ids }),
          })
      );
      await syncProductsFromApi();

      track("bulk_delete", {
        ids,
        count: ids.length,
        userId,
      });

      toast.success("Selected products deleted");
      setSelectedIds([]);
      setBulkDeleteOpen(false);
    } catch {
      toast.error("Unable to delete selected products");
    }
  };

  const handleExportSelected = () => {
    if (selectedProducts.length === 0) return;

    exportToCSV(
      selectedProducts.map((product) => ({
        id: product.id,
        name: product.name,
        sku: product.sku,
        category: product.category,
        price: product.price,
        stock: product.stock,
        reservedStock: product.reservedStock || 0,
        availableStock: getAvailableStock(product),
        inventoryStatus: getInventoryStatus(product),
        status: getProductAdminStatus(product),
        featured: product.featured,
        visible: isVisibleOnStorefront(product),
      })),
      "products_export"
    );

    track("bulk_export", {
      count: selectedProducts.length,
      ids: selectedProducts.map((product) => product.id),
      userId,
    });
  };

  const handleViewOnStore = (product: Product) => {
    const storeUrl = getStorefrontProductUrl(product);
    const storeTab = window.open(storeUrl, "_blank", "noopener,noreferrer");
    if (storeTab) {
      storeTab.opener = null;
    }
    setOpenMenuId(null);

    track("product_view_store", {
      productId: product.id,
      productSlug: product.slug || null,
      storeUrl,
      userId,
    });
  };

  const toggleSelection = (productId: string, checked: boolean) => {
    setSelectedIds((current) =>
      checked
        ? Array.from(new Set([...current, productId]))
        : current.filter((id) => id !== productId)
    );
  };

  const toggleVisiblePageSelection = (checked: boolean) => {
    const pageIds = paginatedProducts.map((product) => product.id);
    setSelectedIds((current) => {
      if (checked) {
        return Array.from(new Set([...current, ...pageIds]));
      }
      return current.filter((id) => !pageIds.includes(id));
    });
  };

  const renderActionMenu = (product: Product) => (
    <DropdownMenu
      open={openMenuId === product.id}
      onOpenChange={(open) => setOpenMenuId(open ? product.id : null)}
    >
      <DropdownMenuTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={cn(
            "h-8 w-8 rounded-full bg-card/80 backdrop-blur-sm border border-default-200 transition-all duration-200",
            openMenuId === product.id
              ? "opacity-100 scale-100"
              : "opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100"
          )}
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={() => handleOpenEdit(product)}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit Product
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleDuplicate(product)}>
          <Copy className="mr-2 h-4 w-4" />
          Duplicate Product
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetProductStatus(product, "active")}>
          <Eye className="mr-2 h-4 w-4" />
          Mark Active
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleSetProductStatus(product, "draft")}>
          <Pencil className="mr-2 h-4 w-4" />
          Move to Draft
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleToggleVisibility(product)}>
          {product.visible === false || product.isVisible === false ? (
            <Eye className="mr-2 h-4 w-4" />
          ) : (
            <EyeOff className="mr-2 h-4 w-4" />
          )}
          {product.visible === false || product.isVisible === false ? "Show Product" : "Hide Product"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleToggleFeatured(product.id)}>
          <Star className="mr-2 h-4 w-4" />
          {product.featured ? "Remove Featured" : "Mark Featured"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleViewOnStore(product)}>
          <Eye className="mr-2 h-4 w-4" />
          View on Store
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setDeleteTarget(product);
            setOpenMenuId(null);
          }}
          className="text-destructive focus:text-destructive"
        >
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Product
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const renderGridCard = (product: Product) => {
    const tone = stockTone(product);
    const statusTone = productStatusTone(product);
    const availableStock = getAvailableStock(product);
    const isSelected = selectedIds.includes(product.id);

    return (
      <Card
        key={product.id}
        className="group overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
      >
        <div className="relative p-4 bg-default-50 flex items-center justify-center h-[180px]">
          <div
            className={cn(
              "absolute top-3 left-3 transition-all duration-200",
              isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
            )}
          >
            <Checkbox
              color="primary"
              checked={isSelected}
              onCheckedChange={(checked) => toggleSelection(product.id, checked === true)}
            />
          </div>

          <div className="absolute top-3 right-3">{renderActionMenu(product)}</div>

          <img
            src={product.images[0] || PRODUCT_PLACEHOLDER_IMAGE}
            alt={product.name}
            className="h-[120px] w-auto object-contain"
            onError={(event) => {
              event.currentTarget.src = PRODUCT_PLACEHOLDER_IMAGE;
            }}
          />

          <div className="absolute bottom-3 left-3 flex gap-2">
            <Badge className={cn("text-[10px] rounded-full", tone.badge)}>
              {tone.label}
            </Badge>
            <Badge
              className={cn("text-[10px] rounded-full", statusTone.className)}
            >
              {statusTone.label}
            </Badge>
            {product.featured && (
              <Badge className="text-[10px] rounded-full bg-warning/10 text-warning">
                Featured
              </Badge>
            )}
          </div>
        </div>

        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Badge className="bg-default-100 text-default-600 text-[10px] mb-2">
                {product.category}
              </Badge>
              <h3 className="text-sm font-semibold text-default-900 truncate">
                {product.name}
              </h3>
              <p className="text-[11px] text-default-500 mt-1 truncate">
                {product.sku}
              </p>
            </div>
            <button
              className="shrink-0"
              onClick={() => void handleToggleFeatured(product.id)}
            >
              <Star
                className={cn(
                  "h-4 w-4 transition-colors",
                  product.featured
                    ? "fill-warning text-warning"
                    : "text-default-300 hover:text-warning"
                )}
              />
            </button>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-base font-semibold text-default-900">
                {formatCurrency(product.price)}
              </p>
              {product.compareAtPrice && (
                <p className="text-xs text-default-400 line-through">
                  {formatCurrency(product.compareAtPrice)}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1">
                <span className={cn("h-2 w-2 rounded-full", tone.dot)} />
                <span className={cn("text-xs font-medium", tone.text)}>
                  {availableStock}
                </span>
              </div>
              <p className="text-[11px] text-default-500 mt-1">
                {product.stock} stock / {product.reservedStock || 0} reserved
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderListRow = (product: Product) => {
    const tone = stockTone(product);
    const statusTone = productStatusTone(product);
    const availableStock = getAvailableStock(product);
    const isSelected = selectedIds.includes(product.id);

    return (
      <div
        key={product.id}
        className="group flex items-center gap-4 p-4 border-b border-default-100 last:border-b-0 hover:bg-default-50 transition-colors"
      >
        <div
          className={cn(
            "transition-all duration-200",
            isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
        >
          <Checkbox
            color="primary"
            checked={isSelected}
            onCheckedChange={(checked) => toggleSelection(product.id, checked === true)}
          />
        </div>

        <div className="h-14 w-14 rounded bg-default-100 flex items-center justify-center shrink-0">
          <img
            src={product.images[0] || PRODUCT_PLACEHOLDER_IMAGE}
            alt={product.name}
            className="h-10 w-10 object-contain"
            onError={(event) => {
              event.currentTarget.src = PRODUCT_PLACEHOLDER_IMAGE;
            }}
          />
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-default-900 truncate">
            {product.name}
          </h3>
          <p className="text-xs text-default-500 truncate">
            {product.sku} / {product.category}
          </p>
        </div>

        <div className="text-sm font-semibold text-default-900">
          {formatCurrency(product.price)}
        </div>

        <div className="flex flex-col items-end gap-1">
          <Badge className={cn("text-[10px] rounded-full", tone.badge)}>
            {availableStock} available
          </Badge>
          <span className="text-[11px] text-default-500">
            {product.stock} stock / {product.reservedStock || 0} reserved
          </span>
        </div>

        <Badge
          className={cn("text-[10px] rounded-full", statusTone.className)}
        >
          {statusTone.label}
        </Badge>

        {product.featured && (
          <Badge className="text-[10px] rounded-full bg-warning/10 text-warning">
            Featured
          </Badge>
        )}

        <button className="shrink-0" onClick={() => void handleToggleFeatured(product.id)}>
          <Star
            className={cn(
              "h-4 w-4 transition-colors",
              product.featured
                ? "fill-warning text-warning"
                : "text-default-300 hover:text-warning"
            )}
          />
        </button>

        <div className="shrink-0">{renderActionMenu(product)}</div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-default-900">Products</h2>
          <p className="text-sm text-default-500 mt-1">
            {products.length} total products
          </p>
          {loadError && (
            <p className="text-xs text-destructive mt-1">{loadError}</p>
          )}
        </div>
        <Button asChild size="sm" className="gap-1">
          <Link
            href="/ecommerce/backend/add-product"
            onClick={() =>
              track("add_product_clicked", {
                source: "products_header",
                userId,
              })
            }
          >
            <Plus className="h-4 w-4" /> Add Product
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col xl:flex-row gap-3 xl:items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-default-400" />
              <Input
                value={rawSearch}
                onChange={(event) => {
                  setRawSearch(event.target.value);
                  setPage(0);
                }}
                placeholder="Search by product name or SKU"
                className="pl-9 h-9"
              />
            </div>

            <Select
              value={category}
              onValueChange={(value) => {
                setCategory(value);
                setPage(0);
                track("product_filter_applied", {
                  category: value,
                  userId,
                });
              }}
            >
              <SelectTrigger className="w-full sm:w-[210px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(value: StatusFilterValue) => {
                setStatusFilter(value);
                setPage(0);
                track("product_filter_applied", {
                  status: value,
                  userId,
                });
              }}
            >
              <SelectTrigger className="w-full sm:w-[170px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusFilterOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={sortBy}
              onValueChange={(value: SortValue) => {
                setSortBy(value);
                track("product_sort_applied", {
                  sortBy: value,
                  userId,
                });
              }}
            >
              <SelectTrigger className="w-full sm:w-[190px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center justify-between gap-3 rounded-lg border border-default-200 bg-default-50 px-3 py-2 min-w-[180px]">
              <div>
                <p className="text-sm font-medium text-default-900">Low stock</p>
                <p className="text-[11px] text-default-500">At or below threshold</p>
              </div>
              <Switch
                checked={lowStockOnly}
                onCheckedChange={(checked) => {
                  setLowStockOnly(checked);
                  setPage(0);
                  track("low_stock_filter_used", {
                    enabled: checked,
                    userId,
                  });
                }}
                color="warning"
              />
            </div>

            <div className="flex gap-1 xl:ml-auto">
              <Button
                size="icon"
                variant={viewMode === "grid" ? "default" : "outline"}
                className="h-9 w-9"
                onClick={() => setViewMode("grid")}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant={viewMode === "list" ? "default" : "outline"}
                className="h-9 w-9"
                onClick={() => setViewMode("list")}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {selectedIds.length > 0 && (
        <Card className="border-primary/20 bg-primary/5 animate-in slide-in-from-top-2 duration-300">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Checkbox
                color="primary"
                checked={allVisibleSelected}
                onCheckedChange={(checked) =>
                  toggleVisiblePageSelection(checked === true)
                }
              />
              <div>
                <p className="text-sm font-medium text-default-900">
                  {selectedIds.length} products selected
                </p>
                <p className="text-xs text-default-500">
                  Bulk actions apply to the current selection
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={handleExportSelected}>
                <Download className="mr-2 h-4 w-4" />
                Export Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                color="destructive"
                onClick={() => setBulkDeleteOpen(true)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Card>
          <CardContent className="py-16 flex flex-col items-center gap-3 text-default-500">
            <LoaderCircle className="h-6 w-6 animate-spin" />
            <p className="text-sm">Loading products...</p>
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {paginatedProducts.map(renderGridCard)}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            {paginatedProducts.map(renderListRow)}
          </CardContent>
        </Card>
      )}

      {!isLoading && paginatedProducts.length === 0 && (
        <Card>
          <CardContent className="py-14 text-center">
            <p className="text-sm font-medium text-default-900">
              No products match the current filters
            </p>
            <p className="text-xs text-default-500 mt-1">
              Try adjusting search, category, status, or stock filters.
            </p>
          </CardContent>
        </Card>
      )}

      {filteredProducts.length > PAGE_SIZE && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-default-500">
            Page {currentPage + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage === 0}
              onClick={() => setPage((current) => Math.max(0, current - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage >= totalPages - 1}
              onClick={() =>
                setPage((current) => Math.min(totalPages - 1, current + 1))
              }
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <Sheet
        open={Boolean(editingProduct && editForm)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProduct(null);
            setEditForm(null);
          }
        }}
      >
        <SheetContent className="w-[400px] sm:max-w-[400px]">
          <SheetHeader>
            <SheetTitle>Edit Product</SheetTitle>
            <SheetDescription>
              Update product details without leaving the current page.
            </SheetDescription>
          </SheetHeader>

          {editForm && (
            <div className="space-y-4 py-4 overflow-y-auto">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, name: event.target.value }
                        : current
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={editForm.category}
                  onValueChange={(value) =>
                    setEditForm((current) =>
                      current ? { ...current, category: value } : current
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions
                      .filter((option) => option !== "All")
                      .map((option) => (
                        <SelectItem key={option} value={option}>
                          {option}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-[1fr_auto] gap-3 items-end">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) =>
                      setEditForm((current) =>
                        current ? { ...current, status: value as Product["status"] } : current
                      )
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {productStatusOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex h-10 items-center gap-2 rounded-md border border-default-200 px-3">
                  <Switch
                    checked={editForm.featured}
                    onCheckedChange={(checked) =>
                      setEditForm((current) =>
                        current ? { ...current, featured: Boolean(checked) } : current
                      )
                    }
                    color="warning"
                  />
                  <span className="text-sm font-medium text-default-700">Featured</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Price</Label>
                  <Input
                    type="number"
                    value={editForm.price}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? { ...current, price: event.target.value }
                          : current
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Compare Price</Label>
                  <Input
                    type="number"
                    value={editForm.compareAtPrice}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current
                          ? {
                              ...current,
                              compareAtPrice: event.target.value,
                            }
                          : current
                      )
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>SKU</Label>
                  <Input
                    value={editForm.sku}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current ? { ...current, sku: event.target.value } : current
                      )
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label>Stock</Label>
                  <Input
                    type="number"
                    value={editForm.stock}
                    onChange={(event) =>
                      setEditForm((current) =>
                        current ? { ...current, stock: event.target.value } : current
                      )
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Low Stock Threshold</Label>
                <Input
                  type="number"
                  value={editForm.lowStockThreshold}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? {
                            ...current,
                            lowStockThreshold: event.target.value,
                          }
                        : current
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={editForm.description}
                  onChange={(event) =>
                    setEditForm((current) =>
                      current
                        ? { ...current, description: event.target.value }
                        : current
                    )
                  }
                  className="min-h-[140px]"
                />
              </div>
            </div>
          )}

          <SheetFooter>
            <Button
              variant="outline"
              onClick={() => {
                setEditingProduct(null);
                setEditForm(null);
              }}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleSaveEdit()}>Save Changes</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {deleteTarget?.name || "this product"} from the admin
              list and the synced product store.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDeleteProduct()}
            >
              Delete Product
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected products?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {selectedIds.length} selected products from the
              current catalog.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleBulkDelete()}
            >
              Delete Selected
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductsManagement;




