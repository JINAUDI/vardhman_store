"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, CheckCircle2, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import {
  canCouponBeActive,
  getComputedCouponStatus,
  getPersistedCouponStatus,
  type ComputedCouponStatus,
} from "@/lib/store/coupon-status";
import type { Category, Collection, Coupon, DiscountCategory, Product } from "@/lib/store/types";

const discountTabs: { value: DiscountCategory; label: string }[] = [
  { value: "product_discount", label: "Amount Off Products" },
  { value: "order_discount", label: "Amount Off Order" },
  { value: "buy_x_get_y", label: "Buy X Get Y" },
  { value: "free_shipping", label: "Free Shipping" },
];

const defaultChannels = ["Online Store"];

type DiscountFormState = {
  id?: string;
  title: string;
  method: "code" | "automatic";
  code: string;
  discountCategory: DiscountCategory;
  type: "percentage" | "flat";
  value: string;
  requirementType: Coupon["requirementType"];
  minOrderAmount: string;
  minQuantity: string;
  maxDiscount: string;
  usageLimit: string;
  usedCount: number;
  oncePerCustomer: boolean;
  targetScope: Coupon["targetScope"];
  targetProductIds: string[];
  targetCollectionIds: string[];
  targetCategorySlugs: string[];
  buyQuantity: string;
  getQuantity: string;
  buyTargetScope: Coupon["buyTargetScope"];
  buyProductIds: string[];
  buyCollectionIds: string[];
  buyCategorySlugs: string[];
  getTargetScope: Coupon["getTargetScope"];
  getProductIds: string[];
  getCollectionIds: string[];
  getCategorySlugs: string[];
  combinesWithProductDiscounts: boolean;
  combinesWithOrderDiscounts: boolean;
  combinesWithShippingDiscounts: boolean;
  startsAt: string;
  endsAt: string;
  status: Coupon["status"];
  salesChannels: string[];
  tags: string;
};

function formatDateTimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function createEmptyForm(category: DiscountCategory): DiscountFormState {
  return {
    title: "",
    method: category === "buy_x_get_y" ? "automatic" : "code",
    code: "",
    discountCategory: category,
    type: category === "free_shipping" ? "flat" : "percentage",
    value: category === "buy_x_get_y" ? "100" : "",
    requirementType: "none",
    minOrderAmount: "",
    minQuantity: "1",
    maxDiscount: "",
    usageLimit: "100",
    usedCount: 0,
    oncePerCustomer: false,
    targetScope: "all_products",
    targetProductIds: [],
    targetCollectionIds: [],
    targetCategorySlugs: [],
    buyQuantity: "2",
    getQuantity: "1",
    buyTargetScope: "all_products",
    buyProductIds: [],
    buyCollectionIds: [],
    buyCategorySlugs: [],
    getTargetScope: "all_products",
    getProductIds: [],
    getCollectionIds: [],
    getCategorySlugs: [],
    combinesWithProductDiscounts: false,
    combinesWithOrderDiscounts: false,
    combinesWithShippingDiscounts: false,
    startsAt: formatDateTimeLocal(new Date().toISOString()),
    endsAt: "",
    status: "active",
    salesChannels: defaultChannels,
    tags: "",
  };
}

function toForm(discount: Coupon): DiscountFormState {
  return {
    id: discount.id,
    title: discount.title || "",
    method: discount.method || "code",
    code: discount.code || "",
    discountCategory: discount.discountCategory,
    type: discount.type,
    value: String(discount.value ?? ""),
    requirementType: discount.requirementType || "none",
    minOrderAmount: String(discount.minOrderAmount ?? ""),
    minQuantity: String(discount.minQuantity ?? 1),
    maxDiscount: String(discount.maxDiscount ?? ""),
    usageLimit: String(discount.usageLimit ?? 0),
    usedCount: discount.usedCount ?? 0,
    oncePerCustomer: Boolean(discount.oncePerCustomer),
    targetScope: discount.targetScope || "all_products",
    targetProductIds: discount.targetProductIds ?? discount.selectedProductIds ?? [],
    targetCollectionIds: discount.targetCollectionIds ?? [],
    targetCategorySlugs: discount.targetCategorySlugs ?? [],
    buyQuantity: String(discount.buyQuantity ?? 2),
    getQuantity: String(discount.getQuantity ?? 1),
    buyTargetScope: discount.buyTargetScope || "all_products",
    buyProductIds: discount.buyProductIds ?? [],
    buyCollectionIds: discount.buyCollectionIds ?? [],
    buyCategorySlugs: discount.buyCategorySlugs ?? [],
    getTargetScope: discount.getTargetScope || "all_products",
    getProductIds: discount.getProductIds ?? [],
    getCollectionIds: discount.getCollectionIds ?? [],
    getCategorySlugs: discount.getCategorySlugs ?? [],
    combinesWithProductDiscounts: Boolean(discount.combinesWithProductDiscounts),
    combinesWithOrderDiscounts: Boolean(discount.combinesWithOrderDiscounts),
    combinesWithShippingDiscounts: Boolean(discount.combinesWithShippingDiscounts),
    startsAt: formatDateTimeLocal(discount.startsAt),
    endsAt: formatDateTimeLocal(discount.endsAt || discount.expiresAt),
    status: discount.status,
    salesChannels: discount.salesChannels?.length ? discount.salesChannels : defaultChannels,
    tags: (discount.tags ?? []).join(", "),
  };
}

function toPayload(form: DiscountFormState): Partial<Coupon> {
  const discountCode =
    form.code?.trim().toUpperCase() ||
    `VARDHMAN-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

  return {
    title: form.title.trim() || undefined,
    method: form.method,
    code: discountCode,
    type: form.type,
    valueType: form.type === "flat" ? "fixed_amount" : "percentage",
    discountCategory: form.discountCategory,
    value: Number(form.value) || 0,
    requirementType: form.requirementType,
    minOrderAmount: Number(form.minOrderAmount) || 0,
    minQuantity: Number(form.minQuantity) || undefined,
    maxDiscount: Number(form.maxDiscount) || undefined,
    usageLimit: Number(form.usageLimit) || 0,
    oncePerCustomer: form.oncePerCustomer,
    targetScope: form.targetScope,
    targetProductIds: form.targetProductIds,
    targetCollectionIds: form.targetCollectionIds,
    targetCategorySlugs: form.targetCategorySlugs,
    selectedProductIds: form.targetProductIds,
    buyQuantity: Number(form.buyQuantity) || undefined,
    getQuantity: Number(form.getQuantity) || undefined,
    buyTargetScope: form.buyTargetScope,
    buyProductIds: form.buyProductIds,
    buyCollectionIds: form.buyCollectionIds,
    buyCategorySlugs: form.buyCategorySlugs,
    getTargetScope: form.getTargetScope,
    getProductIds: form.getProductIds,
    getCollectionIds: form.getCollectionIds,
    getCategorySlugs: form.getCategorySlugs,
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
    expiresAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
    status: getPersistedCouponStatus({
      status: form.status,
      usageLimit: Number(form.usageLimit) || 0,
      usedCount: form.usedCount,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
      expiresAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
    }),
    appliesTo:
      form.targetScope === "specific_products"
        ? "specific_products"
        : form.targetScope === "specific_collections"
          ? "specific_collections"
          : "all",
    combinesWithProductDiscounts: form.combinesWithProductDiscounts,
    combinesWithOrderDiscounts: form.combinesWithOrderDiscounts,
    combinesWithShippingDiscounts: form.combinesWithShippingDiscounts,
    salesChannels: form.salesChannels,
    tags: form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

type ScopePickerProps = {
  label: string;
  scope: Coupon["targetScope"] | Coupon["buyTargetScope"] | Coupon["getTargetScope"];
  onScopeChange: (value: DiscountFormState["targetScope"]) => void;
  productIds: string[];
  onProductIdsChange: (ids: string[]) => void;
  collectionIds: string[];
  onCollectionIdsChange: (ids: string[]) => void;
  categorySlugs: string[];
  onCategorySlugsChange: (ids: string[]) => void;
  products: Product[];
  collections: Collection[];
  categories: Category[];
};

function toggleValue(list: string[], value: string) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function getFormStatusInput(form: DiscountFormState): Partial<Coupon> {
  return {
    status: form.status,
    usageLimit: Number(form.usageLimit) || 0,
    usedCount: form.usedCount,
    startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : undefined,
    endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
    expiresAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
  };
}

function getStatusLabel(status: ComputedCouponStatus) {
  if (status === "exhausted") return "Fully used";
  return status;
}

function getStatusBadgeClass(status: ComputedCouponStatus) {
  if (status === "active") return "bg-success/10 text-success";
  if (status === "disabled") return "bg-destructive/10 text-destructive";
  if (status === "exhausted") return "bg-warning/10 text-warning";
  return "bg-default-100 text-default-500";
}

function readPositiveInteger(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

function readPositiveNumber(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function hasScopeSelection(
  scope: Coupon["targetScope"] | Coupon["buyTargetScope"] | Coupon["getTargetScope"],
  productIds: string[],
  collectionIds: string[],
  categorySlugs: string[]
) {
  if (!scope || scope === "all_products") return true;
  if (scope === "specific_products") return productIds.length > 0;
  if (scope === "specific_collections") return collectionIds.length > 0;
  if (scope === "specific_categories") return categorySlugs.length > 0;
  return true;
}

function getScopeSummary(
  scope: Coupon["targetScope"] | Coupon["buyTargetScope"] | Coupon["getTargetScope"],
  productIds: string[],
  collectionIds: string[],
  categorySlugs: string[]
) {
  if (!scope || scope === "all_products") return "all products";
  if (scope === "specific_products") return `${productIds.length} selected product${productIds.length === 1 ? "" : "s"}`;
  if (scope === "specific_collections") return `${collectionIds.length} selected collection${collectionIds.length === 1 ? "" : "s"}`;
  if (scope === "specific_categories") return `${categorySlugs.length} selected categor${categorySlugs.length === 1 ? "y" : "ies"}`;
  return "selected products";
}

function getDiscountConditionText(form: DiscountFormState) {
  if (form.discountCategory === "buy_x_get_y") {
    const buyQuantity = readPositiveInteger(form.buyQuantity, 1);
    const getQuantity = readPositiveInteger(form.getQuantity, 1);
    const usesSamePool =
      form.buyTargetScope === form.getTargetScope &&
      form.buyProductIds.join("|") === form.getProductIds.join("|") &&
      form.buyCollectionIds.join("|") === form.getCollectionIds.join("|") &&
      form.buyCategorySlugs.join("|") === form.getCategorySlugs.join("|");

    return usesSamePool
      ? `cart has ${buyQuantity + getQuantity} matching item${buyQuantity + getQuantity === 1 ? "" : "s"}`
      : `cart has ${buyQuantity} matching buy item${buyQuantity === 1 ? "" : "s"} and ${getQuantity} matching get item${getQuantity === 1 ? "" : "s"}`;
  }

  if (form.requirementType === "minimum_quantity") {
    const quantity = readPositiveInteger(form.minQuantity, 1);
    return `cart has at least ${quantity} matching item${quantity === 1 ? "" : "s"}`;
  }

  if (form.requirementType === "minimum_purchase_amount") {
    return `order subtotal reaches ${formatINR(readPositiveNumber(form.minOrderAmount))}`;
  }

  if (form.discountCategory === "order_discount") return "an eligible order is in the cart";
  if (form.discountCategory === "free_shipping") return "the cart is eligible for shipping";
  return "cart has a matching item";
}

function getDiscountPreview(form: DiscountFormState, formStatus: ComputedCouponStatus) {
  const blockers: string[] = [];
  const details: string[] = [];
  const condition = getDiscountConditionText(form);
  const automatic = form.method === "automatic";

  if (!automatic) {
    blockers.push("Method is Discount code, so customers must enter the code manually.");
  }

  if (form.status !== "active") blockers.push("Discount is currently disabled.");
  if (formStatus === "expired") blockers.push("End date has passed.");
  if (formStatus === "exhausted") blockers.push("Usage limit has already been reached.");

  const startsAt = form.startsAt ? new Date(form.startsAt) : null;
  if (startsAt && !Number.isNaN(startsAt.getTime()) && startsAt.getTime() > Date.now()) {
    blockers.push(`Discount starts on ${startsAt.toLocaleString()}.`);
  }

  if (form.discountCategory === "buy_x_get_y") {
    if (!readPositiveInteger(form.buyQuantity)) blockers.push("Buy quantity must be at least 1.");
    if (!readPositiveInteger(form.getQuantity)) blockers.push("Get quantity must be at least 1.");
    if (
      !hasScopeSelection(
        form.buyTargetScope,
        form.buyProductIds,
        form.buyCollectionIds,
        form.buyCategorySlugs
      )
    ) {
      blockers.push("Customer Buys target is selected but no buy products, collections, or categories are chosen.");
    }
    if (
      !hasScopeSelection(
        form.getTargetScope,
        form.getProductIds,
        form.getCollectionIds,
        form.getCategorySlugs
      )
    ) {
      blockers.push("Customer Gets target is selected but no get products, collections, or categories are chosen.");
    }

    details.push(
      `Customer buys: ${getScopeSummary(
        form.buyTargetScope,
        form.buyProductIds,
        form.buyCollectionIds,
        form.buyCategorySlugs
      )}.`
    );
    details.push(
      `Customer gets: ${getScopeSummary(
        form.getTargetScope,
        form.getProductIds,
        form.getCollectionIds,
        form.getCategorySlugs
      )}.`
    );
  } else if (form.discountCategory !== "order_discount") {
    if (
      !hasScopeSelection(
        form.targetScope,
        form.targetProductIds,
        form.targetCollectionIds,
        form.targetCategorySlugs
      )
    ) {
      blockers.push("Applies To target is selected but no products, collections, or categories are chosen.");
    }

    details.push(
      `Applies to: ${getScopeSummary(
        form.targetScope,
        form.targetProductIds,
        form.targetCollectionIds,
        form.targetCategorySlugs
      )}.`
    );
  }

  if (form.discountCategory !== "buy_x_get_y" && form.discountCategory !== "free_shipping") {
    if (!readPositiveNumber(form.value)) blockers.push("Discount value must be greater than 0.");
  }

  if (form.discountCategory === "free_shipping" && !readPositiveNumber(form.value)) {
    blockers.push("Shipping discount value must be greater than 0.");
  }

  if (form.requirementType === "minimum_quantity" && !readPositiveInteger(form.minQuantity)) {
    blockers.push("Minimum quantity must be at least 1.");
  }

  if (form.requirementType === "minimum_purchase_amount" && !readPositiveNumber(form.minOrderAmount)) {
    blockers.push("Minimum purchase amount must be greater than 0.");
  }

  return {
    automatic,
    condition,
    canApply: blockers.length === 0,
    headline: automatic
      ? `This discount will apply automatically when ${condition}.`
      : `This discount can apply with a code when ${condition}.`,
    blockers,
    details,
  };
}

function ScopePicker({
  label,
  scope,
  onScopeChange,
  productIds,
  onProductIdsChange,
  collectionIds,
  onCollectionIdsChange,
  categorySlugs,
  onCategorySlugsChange,
  products,
  collections,
  categories,
}: ScopePickerProps) {
  const [search, setSearch] = useState("");
  const [isBrowsing, setIsBrowsing] = useState(false);

  const filteredProducts = useMemo(
    () =>
      products.filter((product) =>
        product.name.toLowerCase().includes(search.toLowerCase())
      ),
    [products, search]
  );

  const filteredCollections = useMemo(
    () =>
      collections.filter((collection) =>
        collection.title.toLowerCase().includes(search.toLowerCase())
      ),
    [collections, search]
  );

  const filteredCategories = useMemo(
    () =>
      categories.filter((category) =>
        category.name.toLowerCase().includes(search.toLowerCase())
      ),
    [categories, search]
  );

  const selectedCount =
    scope === "specific_products"
      ? productIds.length
      : scope === "specific_collections"
        ? collectionIds.length
        : scope === "specific_categories"
          ? categorySlugs.length
          : 0;

  const searchPlaceholder =
    scope === "specific_products"
      ? "Search products"
      : scope === "specific_collections"
        ? "Search collections"
        : "Search categories";

  return (
    <div className="space-y-3 rounded-lg border border-default-200 p-4">
      <div className="space-y-2">
        <Label>{label}</Label>
        <Select value={scope || "all_products"} onValueChange={(value) => onScopeChange(value as DiscountFormState["targetScope"])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all_products">All products</SelectItem>
            <SelectItem value="specific_products">Specific products</SelectItem>
            <SelectItem value="specific_collections">Specific collections</SelectItem>
            <SelectItem value="specific_categories">Specific categories</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {scope !== "all_products" && (
        <div className="space-y-3">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={searchPlaceholder}
            />
            <Button
              type="button"
              variant="outline"
              className="min-w-[96px]"
              onClick={() => setIsBrowsing((current) => !current)}
            >
              {isBrowsing ? "Hide" : "Browse"}
            </Button>
          </div>
          {selectedCount > 0 && (
            <p className="text-xs text-default-500">
              {selectedCount} item{selectedCount === 1 ? "" : "s"} selected
            </p>
          )}
        </div>
      )}

      {scope === "specific_products" && isBrowsing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-auto pr-1">
          {filteredProducts.map((product) => (
            <label key={product.id} className="flex items-center gap-2 text-sm text-default-700">
              <Checkbox
                checked={productIds.includes(product.id)}
                onCheckedChange={() => onProductIdsChange(toggleValue(productIds, product.id))}
                color="primary"
              />
              <span>{product.name}</span>
            </label>
          ))}
        </div>
      )}

      {scope === "specific_collections" && isBrowsing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-auto pr-1">
          {filteredCollections.map((collection) => (
            <label key={collection.id} className="flex items-center gap-2 text-sm text-default-700">
              <Checkbox
                checked={collectionIds.includes(collection.id)}
                onCheckedChange={() => onCollectionIdsChange(toggleValue(collectionIds, collection.id))}
                color="primary"
              />
              <span>{collection.title}</span>
            </label>
          ))}
        </div>
      )}

      {scope === "specific_categories" && isBrowsing && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-56 overflow-auto pr-1">
          {filteredCategories.map((category) => (
            <label key={category.id} className="flex items-center gap-2 text-sm text-default-700">
              <Checkbox
                checked={categorySlugs.includes(category.slug)}
                onCheckedChange={() => onCategorySlugsChange(toggleValue(categorySlugs, category.slug))}
                color="primary"
              />
              <span>{category.name}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

const DiscountsManagement = () => {
  const [discounts, setDiscounts] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [activeTab, setActiveTab] = useState<DiscountCategory>("product_discount");
  const [statusFilter, setStatusFilter] = useState<ComputedCouponStatus | "all">("all");
  const [form, setForm] = useState<DiscountFormState>(createEmptyForm("product_discount"));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    const [discountRes, productRes, categoryRes, collectionRes] = await Promise.all([
      fetch("/api/discounts", { cache: "no-store" }),
      fetch("/api/products", { cache: "no-store" }),
      fetch("/api/categories", { cache: "no-store" }),
      fetch("/api/collections", { cache: "no-store" }),
    ]);

    const [discountPayload, productPayload, categoryPayload, collectionPayload] = await Promise.all([
      discountRes.json().catch(() => null),
      productRes.json().catch(() => null),
      categoryRes.json().catch(() => null),
      collectionRes.json().catch(() => null),
    ]);

    if (!discountRes.ok || !Array.isArray(discountPayload?.data)) {
      throw new Error(discountPayload?.message || "Unable to load discounts.");
    }

    setDiscounts(discountPayload.data);
    setProducts(Array.isArray(productPayload?.data) ? productPayload.data : []);
    setCategories(Array.isArray(categoryPayload?.data) ? categoryPayload.data : []);
    setCollections(Array.isArray(collectionPayload?.data) ? collectionPayload.data : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        await loadData();
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load discounts.";
          setLoadError(message);
          toast.error("Unable to load discounts");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const visibleDiscounts = useMemo(
    () =>
      discounts.filter((discount) => {
        const computedStatus = getComputedCouponStatus(discount);
        return (
          discount.discountCategory === activeTab &&
          (statusFilter === "all" || computedStatus === statusFilter)
        );
      }),
    [activeTab, discounts, statusFilter]
  );

  const formStatus = getComputedCouponStatus(getFormStatusInput(form));
  const formCanBeActive = canCouponBeActive(getFormStatusInput(form));
  const applyPreview = getDiscountPreview(form, formStatus);

  const resetForm = (category = activeTab) => setForm(createEmptyForm(category));

  const handleTabChange = (value: DiscountCategory) => {
    setActiveTab(value);
    resetForm(value);
  };

  const handleSave = async () => {
    if (form.discountCategory !== "free_shipping" && !form.value.trim()) {
      toast.error("Discount value is required");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(form.id ? `/api/discounts/${form.id}` : "/api/discounts", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Unable to save discount.");

      await loadData();
      resetForm(form.discountCategory);
      toast.success(form.id ? "Discount updated" : "Discount created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save discount");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusToggle = (checked: boolean) => {
    if (checked && !canCouponBeActive(getFormStatusInput(form))) {
      toast.error(
        formStatus === "exhausted"
          ? "Fully used discounts cannot be reactivated."
          : "Expired discounts cannot be reactivated until the end date is extended."
      );
      return;
    }

    setForm((current) => ({ ...current, status: checked ? "active" : "disabled" }));
  };

  const handleDelete = async (discount: Coupon) => {
    if (!window.confirm(`Delete ${discount.code || discount.title || "this discount"}?`)) return;
    try {
      const response = await fetch(`/api/discounts/${discount.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Unable to delete discount.");
      await loadData();
      if (form.id === discount.id) resetForm(activeTab);
      toast.success("Discount deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete discount");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-default-900">Discounts</h2>
          <p className="text-sm text-default-500 mt-1">Shopify-style discount rules backed by Supabase</p>
          {loadError && <p className="text-xs text-destructive mt-1">{loadError}</p>}
        </div>
        <Button size="sm" className="gap-1" onClick={() => resetForm()}>
          <Plus className="h-4 w-4" /> New Discount
        </Button>
      </div>

      <div className="flex gap-1 bg-default-100 p-1 rounded-lg w-full overflow-x-auto">
        {discountTabs.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleTabChange(tab.value)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap",
              activeTab === tab.value ? "bg-card text-default-900 shadow-sm" : "text-default-500 hover:text-default-700"
            )}
          >
            {tab.label}
            <span className="ml-1.5 text-[10px] opacity-60">
              {discounts.filter((discount) => discount.discountCategory === tab.value).length}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[520px_1fr] gap-5">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-default-900">
                {form.id ? "Edit Discount" : "Create Discount"}
              </h3>
              <p className="text-xs text-default-500 mt-1">Current type: {discountTabs.find((tab) => tab.value === form.discountCategory)?.label}</p>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Summer launch offer" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Method</Label>
                <Select value={form.method} onValueChange={(value) => setForm((current) => ({ ...current, method: value as DiscountFormState["method"], code: value === "automatic" ? "" : current.code }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="code">Discount code</SelectItem>
                    <SelectItem value="automatic">Automatic discount</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.method === "code" && (
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    value={form.code}
                    onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                    placeholder="SAVE500"
                  />
                  <p className="text-[11px] text-default-500">
                    Customers can apply this code from the cart or checkout.
                  </p>
                </div>
              )}
            </div>

            {form.discountCategory !== "buy_x_get_y" && form.discountCategory !== "free_shipping" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Value Type</Label>
                  <Select value={form.type} onValueChange={(value) => setForm((current) => ({ ...current, type: value as DiscountFormState["type"] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage</SelectItem>
                      <SelectItem value="flat">Fixed amount</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Discount Value</Label>
                  <Input value={form.value} onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} placeholder={form.type === "percentage" ? "10" : "500"} />
                </div>
              </div>
            )}

            {form.discountCategory === "free_shipping" && (
              <div className="space-y-2">
                <Label>Shipping Discount Value</Label>
                <Input value={form.value} onChange={(event) => setForm((current) => ({ ...current, value: event.target.value }))} placeholder="99" />
              </div>
            )}

            {form.discountCategory === "buy_x_get_y" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Buy Quantity</Label>
                  <Input value={form.buyQuantity} onChange={(event) => setForm((current) => ({ ...current, buyQuantity: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Get Quantity</Label>
                  <Input value={form.getQuantity} onChange={(event) => setForm((current) => ({ ...current, getQuantity: event.target.value }))} />
                </div>
              </div>
            )}

            {form.discountCategory !== "order_discount" && (
              <ScopePicker
                label="Applies To"
                scope={form.targetScope}
                onScopeChange={(value) => setForm((current) => ({ ...current, targetScope: value }))}
                productIds={form.targetProductIds}
                onProductIdsChange={(ids) => setForm((current) => ({ ...current, targetProductIds: ids }))}
                collectionIds={form.targetCollectionIds}
                onCollectionIdsChange={(ids) => setForm((current) => ({ ...current, targetCollectionIds: ids }))}
                categorySlugs={form.targetCategorySlugs}
                onCategorySlugsChange={(ids) => setForm((current) => ({ ...current, targetCategorySlugs: ids }))}
                products={products}
                collections={collections}
                categories={categories}
              />
            )}

            {form.discountCategory === "buy_x_get_y" && (
              <>
                <ScopePicker
                  label="Customer Buys"
                  scope={form.buyTargetScope}
                  onScopeChange={(value) => setForm((current) => ({ ...current, buyTargetScope: value }))}
                  productIds={form.buyProductIds}
                  onProductIdsChange={(ids) => setForm((current) => ({ ...current, buyProductIds: ids }))}
                  collectionIds={form.buyCollectionIds}
                  onCollectionIdsChange={(ids) => setForm((current) => ({ ...current, buyCollectionIds: ids }))}
                  categorySlugs={form.buyCategorySlugs}
                  onCategorySlugsChange={(ids) => setForm((current) => ({ ...current, buyCategorySlugs: ids }))}
                  products={products}
                  collections={collections}
                  categories={categories}
                />
                <ScopePicker
                  label="Customer Gets"
                  scope={form.getTargetScope}
                  onScopeChange={(value) => setForm((current) => ({ ...current, getTargetScope: value }))}
                  productIds={form.getProductIds}
                  onProductIdsChange={(ids) => setForm((current) => ({ ...current, getProductIds: ids }))}
                  collectionIds={form.getCollectionIds}
                  onCollectionIdsChange={(ids) => setForm((current) => ({ ...current, getCollectionIds: ids }))}
                  categorySlugs={form.getCategorySlugs}
                  onCategorySlugsChange={(ids) => setForm((current) => ({ ...current, getCategorySlugs: ids }))}
                  products={products}
                  collections={collections}
                  categories={categories}
                />
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Requirement</Label>
                <Select value={form.requirementType || "none"} onValueChange={(value) => setForm((current) => ({ ...current, requirementType: value as DiscountFormState["requirementType"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No minimum</SelectItem>
                    <SelectItem value="minimum_purchase_amount">Minimum purchase amount</SelectItem>
                    <SelectItem value="minimum_quantity">Minimum quantity</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{form.requirementType === "minimum_quantity" ? "Minimum Quantity" : "Minimum Purchase"}</Label>
                <Input
                  value={form.requirementType === "minimum_quantity" ? form.minQuantity : form.minOrderAmount}
                  onChange={(event) =>
                    setForm((current) =>
                      current.requirementType === "minimum_quantity"
                        ? { ...current, minQuantity: event.target.value }
                        : { ...current, minOrderAmount: event.target.value }
                    )
                  }
                  placeholder={form.requirementType === "minimum_quantity" ? "2" : "1000"}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Usage Limit</Label>
                <Input value={form.usageLimit} onChange={(event) => setForm((current) => ({ ...current, usageLimit: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Max Discount</Label>
                <Input value={form.maxDiscount} onChange={(event) => setForm((current) => ({ ...current, maxDiscount: event.target.value }))} placeholder="Optional" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Starts At</Label>
                <Input type="datetime-local" value={form.startsAt} onChange={(event) => setForm((current) => ({ ...current, startsAt: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Ends At</Label>
                <Input type="datetime-local" value={form.endsAt} onChange={(event) => setForm((current) => ({ ...current, endsAt: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Tags</Label>
              <Textarea value={form.tags} onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))} placeholder="summer, festive, combo" className="min-h-[80px]" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-lg border border-default-200 p-4">
              <label className="flex items-center gap-2 text-sm text-default-700">
                <Checkbox checked={form.oncePerCustomer} onCheckedChange={(checked) => setForm((current) => ({ ...current, oncePerCustomer: Boolean(checked) }))} color="primary" />
                <span>Limit to one use per customer</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-default-700">
                <Checkbox checked={form.combinesWithProductDiscounts} onCheckedChange={(checked) => setForm((current) => ({ ...current, combinesWithProductDiscounts: Boolean(checked) }))} color="primary" />
                <span>Combine with product discounts</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-default-700">
                <Checkbox checked={form.combinesWithOrderDiscounts} onCheckedChange={(checked) => setForm((current) => ({ ...current, combinesWithOrderDiscounts: Boolean(checked) }))} color="primary" />
                <span>Combine with order discounts</span>
              </label>
              <label className="flex items-center gap-2 text-sm text-default-700">
                <Checkbox checked={form.combinesWithShippingDiscounts} onCheckedChange={(checked) => setForm((current) => ({ ...current, combinesWithShippingDiscounts: Boolean(checked) }))} color="primary" />
                <span>Combine with shipping discounts</span>
              </label>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-default-200 bg-default-50 p-3">
              <div>
                <p className="text-sm font-medium text-default-900">Active</p>
                <p className="text-xs text-default-500">
                  {formCanBeActive
                    ? "Available on storefront"
                    : formStatus === "exhausted"
                      ? "Usage limit has been reached"
                      : "End date has passed"}
                </p>
              </div>
              <Switch
                checked={form.status === "active" && formCanBeActive}
                disabled={!formCanBeActive}
                onCheckedChange={handleStatusToggle}
              />
            </div>

            <div
              className={cn(
                "rounded-lg border p-4 space-y-3",
                applyPreview.canApply
                  ? "border-success/30 bg-success/5"
                  : "border-warning/30 bg-warning/5"
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                    applyPreview.canApply ? "bg-success/10" : "bg-warning/10"
                  )}
                >
                  {applyPreview.canApply ? (
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-warning" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-default-900">Auto-apply preview</p>
                    <Badge
                      className={cn(
                        "rounded-full border-none text-[10px]",
                        applyPreview.automatic ? "bg-primary/10 text-primary" : "bg-default-100 text-default-600"
                      )}
                    >
                      {applyPreview.automatic ? "Automatic" : "Code required"}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-default-700">{applyPreview.headline}</p>
                </div>
              </div>

              <div className="rounded-md border border-default-200 bg-background/60 p-3">
                <p className="text-xs font-medium uppercase text-default-500">Rule summary</p>
                <p className="mt-1 text-sm text-default-700">
                  {form.discountCategory === "buy_x_get_y"
                    ? `Buy ${form.buyQuantity || 2}, get ${form.getQuantity || 1} discounted item(s).`
                    : form.discountCategory === "free_shipping"
                      ? `Reduces shipping by ${formatINR(Number(form.value) || 0)}.`
                      : form.type === "percentage"
                        ? `${form.value || 0}% off ${form.discountCategory === "order_discount" ? "the order" : "selected products"}.`
                        : `${formatINR(Number(form.value) || 0)} off ${form.discountCategory === "order_discount" ? "the order" : "selected products"}.`}
                </p>
                {applyPreview.details.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {applyPreview.details.map((detail) => (
                      <p key={detail} className="text-xs text-default-500">
                        {detail}
                      </p>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-medium uppercase text-default-500">
                  {applyPreview.blockers.length ? "Why it will not apply" : "Apply check"}
                </p>
                {applyPreview.blockers.length ? (
                  <ul className="mt-2 space-y-1.5">
                    {applyPreview.blockers.map((reason) => (
                      <li key={reason} className="flex gap-2 text-xs text-warning">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-warning" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-xs text-success">
                    No blocking issues found. Matching carts will receive this discount.
                  </p>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="gap-1" onClick={() => void handleSave()} disabled={isSaving}>
                <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Discount"}
              </Button>
              {form.id && <Button variant="outline" onClick={() => resetForm(form.discountCategory)}>Cancel</Button>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 text-sm text-default-500">Loading discounts...</div>
            ) : (
              <div>
                <div className="flex items-center justify-between gap-3 border-b border-default-200 p-4">
                  <p className="text-sm font-medium text-default-900">Discounts</p>
                  <div className="w-[160px]">
                    <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ComputedCouponStatus | "all")}>
                      <SelectTrigger size="sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All status</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="disabled">Disabled</SelectItem>
                        <SelectItem value="expired">Expired</SelectItem>
                        <SelectItem value="exhausted">Fully used</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow className="bg-default-200">
                      <TableHead>Code</TableHead>
                      <TableHead>Method</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Ends</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleDiscounts.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-10 text-default-400">
                          No discounts match this view
                        </TableCell>
                      </TableRow>
                    ) : (
                      visibleDiscounts.map((discount) => {
                        const computedStatus = getComputedCouponStatus(discount);

                        return (
                          <TableRow key={discount.id}>
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium text-default-900">
                                  {discount.method === "automatic" ? discount.title || "Automatic Discount" : discount.code || discount.title || "Discount"}
                                </div>
                                {discount.title && <div className="text-xs text-default-500">{discount.title}</div>}
                              </div>
                            </TableCell>
                            <TableCell className="capitalize text-sm">{discount.method || "code"}</TableCell>
                            <TableCell className="text-sm">
                              {discount.discountCategory === "buy_x_get_y"
                                ? `Buy ${discount.buyQuantity || 2} Get ${discount.getQuantity || 1}`
                                : discount.discountCategory === "free_shipping"
                                  ? `Ship ${formatINR(discount.value)} off`
                                  : discount.type === "percentage"
                                    ? `${discount.value}%`
                                    : formatINR(discount.value)}
                            </TableCell>
                            <TableCell>
                              <Badge className={cn("text-[11px] rounded-full capitalize", getStatusBadgeClass(computedStatus))}>
                                {getStatusLabel(computedStatus)}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-default-500">
                              {discount.endsAt || discount.expiresAt ? new Date(discount.endsAt || discount.expiresAt).toLocaleDateString() : "No end date"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button size="sm" variant="outline" onClick={() => setForm(toForm(discount))}>
                                  Edit
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => void handleDelete(discount)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DiscountsManagement;
