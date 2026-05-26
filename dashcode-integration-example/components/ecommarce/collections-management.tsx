"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Power, Save, Trash2 } from "lucide-react";
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
import type {
  Collection,
  CollectionCondition,
  CollectionRuleField,
  CollectionRuleOperator,
  Product,
} from "@/lib/store/types";

type CollectionFormState = {
  id?: string;
  title: string;
  slug: string;
  description: string;
  imageUrl: string;
  collectionType: Collection["collectionType"];
  isActive: boolean;
  salesChannels: string[];
  themeTemplate: string;
  sortOrder: string;
  sortType: Collection["sortType"];
  conditionsMatch: Collection["conditionsMatch"];
  conditions: CollectionCondition[];
  productIds: string[];
  tags: string;
};

const defaultChannels = ["Online Store"];

const fieldLabels: Record<CollectionRuleField, string> = {
  title: "Product title",
  category: "Category",
  tag: "Tag",
  price: "Price",
  stock: "Inventory",
  sku: "SKU",
};

const operatorLabels: Record<CollectionRuleOperator, string> = {
  equals: "is equal to",
  not_equals: "is not equal to",
  contains: "contains",
  not_contains: "does not contain",
  starts_with: "starts with",
  ends_with: "ends with",
  greater_than: "is greater than",
  less_than: "is less than",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createCondition(): CollectionCondition {
  return {
    id: crypto.randomUUID(),
    field: "title",
    operator: "contains",
    value: "",
  };
}

function createEmptyForm(): CollectionFormState {
  return {
    title: "",
    slug: "",
    description: "",
    imageUrl: "",
    collectionType: "manual",
    isActive: true,
    salesChannels: defaultChannels,
    themeTemplate: "default-collection",
    sortOrder: "0",
    sortType: "manual",
    conditionsMatch: "all",
    conditions: [createCondition()],
    productIds: [],
    tags: "",
  };
}

function toForm(collection: Collection): CollectionFormState {
  return {
    id: collection.id,
    title: collection.title,
    slug: collection.slug,
    description: collection.description || "",
    imageUrl: collection.imageUrl || "",
    collectionType: collection.collectionType,
    isActive: collection.isActive,
    salesChannels: collection.salesChannels?.length ? collection.salesChannels : defaultChannels,
    themeTemplate: collection.themeTemplate || "default-collection",
    sortOrder: String(collection.sortOrder ?? 0),
    sortType: collection.sortType || "manual",
    conditionsMatch: collection.conditionsMatch || "all",
    conditions: collection.conditions?.length ? collection.conditions : [createCondition()],
    productIds: collection.productIds ?? [],
    tags: (collection.tags ?? []).join(", "),
  };
}

function toPayload(form: CollectionFormState): Partial<Collection> {
  return {
    title: form.title.trim(),
    slug: form.slug.trim() || slugify(form.title),
    description: form.description.trim() || undefined,
    imageUrl: form.imageUrl.trim() || undefined,
    collectionType: form.collectionType,
    isActive: form.isActive,
    salesChannels: form.salesChannels,
    themeTemplate: form.themeTemplate.trim() || "default-collection",
    sortOrder: Number(form.sortOrder) || 0,
    sortType: form.sortType,
    conditionsMatch: form.conditionsMatch,
    conditions: form.conditions
      .map((condition) => ({
        ...condition,
        value: condition.value.trim(),
      }))
      .filter((condition) => condition.value),
    productIds: form.collectionType === "manual" ? form.productIds : [],
    tags: form.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
  };
}

function productMatchesCondition(product: Product, condition: CollectionCondition) {
  const rawValue =
    condition.field === "title"
      ? product.name
      : condition.field === "category"
        ? product.category
        : condition.field === "tag"
          ? product.tags.join(", ")
          : condition.field === "price"
            ? String(product.price)
            : condition.field === "stock"
              ? String(product.stock)
              : product.sku;

  const left = String(rawValue || "").toLowerCase();
  const right = String(condition.value || "").toLowerCase();

  switch (condition.operator) {
    case "equals":
      return left === right;
    case "not_equals":
      return left !== right;
    case "contains":
      return left.includes(right);
    case "not_contains":
      return !left.includes(right);
    case "starts_with":
      return left.startsWith(right);
    case "ends_with":
      return left.endsWith(right);
    case "greater_than":
      return Number(rawValue) > Number(condition.value);
    case "less_than":
      return Number(rawValue) < Number(condition.value);
    default:
      return false;
  }
}

const CollectionsManagement = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [form, setForm] = useState<CollectionFormState>(createEmptyForm());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoadError(null);
    const [collectionRes, productRes] = await Promise.all([
      fetch("/api/collections", { cache: "no-store" }),
      fetch("/api/products", { cache: "no-store" }),
    ]);

    const [collectionPayload, productPayload] = await Promise.all([
      collectionRes.json().catch(() => null),
      productRes.json().catch(() => null),
    ]);

    if (!collectionRes.ok || !Array.isArray(collectionPayload?.data)) {
      throw new Error(collectionPayload?.message || "Unable to load collections.");
    }

    setCollections(collectionPayload.data);
    setProducts(Array.isArray(productPayload?.data) ? productPayload.data : []);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      try {
        await loadData();
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load collections.";
          setLoadError(message);
          toast.error("Unable to load collections");
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const sortedCollections = useMemo(
    () => [...collections].sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
    [collections]
  );

  const matchingProducts = useMemo(() => {
    if (form.collectionType === "manual") {
      return products.filter((product) => form.productIds.includes(product.id));
    }

    const activeConditions = form.conditions.filter((condition) => condition.value.trim());
    if (!activeConditions.length) {
      return [];
    }

    return products.filter((product) => {
      const results = activeConditions.map((condition) => productMatchesCondition(product, condition));
      return form.conditionsMatch === "all" ? results.every(Boolean) : results.some(Boolean);
    });
  }, [form.collectionType, form.conditions, form.conditionsMatch, form.productIds, products]);

  const resetForm = () => setForm(createEmptyForm());

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Collection title is required");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(form.id ? `/api/collections/${form.id}` : "/api/collections", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || "Unable to save collection.");
      }

      await loadData();
      resetForm();
      toast.success(form.id ? "Collection updated" : "Collection created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save collection");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (collection: Collection) => {
    if (!window.confirm(`Delete ${collection.title}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/collections/${collection.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || "Unable to delete collection.");
      }

      await loadData();
      if (form.id === collection.id) {
        resetForm();
      }
      toast.success("Collection deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete collection");
    }
  };

  const handleToggle = async (collection: Collection) => {
    try {
      const response = await fetch(`/api/collections/${collection.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...collection,
          isActive: !collection.isActive,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to update collection.");
      }
      await loadData();
      toast.success("Collection updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update collection");
    }
  };

  const updateCondition = (conditionId: string, patch: Partial<CollectionCondition>) => {
    setForm((current) => ({
      ...current,
      conditions: current.conditions.map((condition) =>
        condition.id === conditionId ? { ...condition, ...patch } : condition
      ),
    }));
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-default-900">Collections</h2>
          <p className="text-sm text-default-500 mt-1">
            Create manual and smart product collections for the storefront and discounts
          </p>
          {loadError && <p className="text-xs text-destructive mt-1">{loadError}</p>}
        </div>
        <Button size="sm" className="gap-1" onClick={resetForm}>
          <Plus className="h-4 w-4" /> New Collection
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[520px_1fr] gap-5">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-default-900">
                {form.id ? "Edit Collection" : "Create Collection"}
              </h3>
              <p className="text-xs text-default-500 mt-1">
                Smart collections update automatically from product rules. Manual collections use selected products.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                    slug: current.id ? current.slug : slugify(event.target.value),
                  }))
                }
                placeholder="Gifts under 500"
              />
            </div>

            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
                placeholder="gifts-under-500"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                className="min-h-[110px]"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                placeholder="Products that fit your budget or campaign theme."
              />
            </div>

            <div className="space-y-2">
              <Label>Image URL</Label>
              <Input
                value={form.imageUrl}
                onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))}
                placeholder="https://..."
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Collection Type</Label>
                <Select
                  value={form.collectionType}
                  onValueChange={(value) =>
                    setForm((current) => ({
                      ...current,
                      collectionType: value as Collection["collectionType"],
                      sortType: value === "smart" ? "best_selling" : current.sortType,
                    }))
                  }
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="smart">Smart</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Storefront Sort</Label>
                <Select
                  value={form.sortType}
                  onValueChange={(value) => setForm((current) => ({ ...current, sortType: value as Collection["sortType"] }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Manual</SelectItem>
                    <SelectItem value="best_selling">Best selling</SelectItem>
                    <SelectItem value="alpha_asc">Alphabetical A-Z</SelectItem>
                    <SelectItem value="alpha_desc">Alphabetical Z-A</SelectItem>
                    <SelectItem value="price_asc">Price low to high</SelectItem>
                    <SelectItem value="price_desc">Price high to low</SelectItem>
                    <SelectItem value="created_desc">Newest first</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Theme Template</Label>
                <Input
                  value={form.themeTemplate}
                  onChange={(event) => setForm((current) => ({ ...current, themeTemplate: event.target.value }))}
                />
              </div>
            </div>

            {form.collectionType === "manual" ? (
              <div className="space-y-3 rounded-lg border border-default-200 p-4">
                <div>
                  <p className="text-sm font-medium text-default-900">Products</p>
                  <p className="text-xs text-default-500">Select exactly which products belong in this collection.</p>
                </div>
                <div className="max-h-60 overflow-auto space-y-2">
                  {products.map((product) => (
                    <label key={product.id} className="flex items-center gap-2 text-sm text-default-700">
                      <Checkbox
                        checked={form.productIds.includes(product.id)}
                        onCheckedChange={() =>
                          setForm((current) => ({
                            ...current,
                            productIds: current.productIds.includes(product.id)
                              ? current.productIds.filter((id) => id !== product.id)
                              : [...current.productIds, product.id],
                          }))
                        }
                        color="primary"
                      />
                      <span>{product.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-lg border border-default-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-default-900">Conditions</p>
                    <p className="text-xs text-default-500">Products are included automatically when they match these rules.</p>
                  </div>
                  <Select
                    value={form.conditionsMatch}
                    onValueChange={(value) => setForm((current) => ({ ...current, conditionsMatch: value as Collection["conditionsMatch"] }))}
                  >
                    <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Match all conditions</SelectItem>
                      <SelectItem value="any">Match any condition</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-3">
                  {form.conditions.map((condition) => (
                    <div key={condition.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2 items-center">
                      <Select
                        value={condition.field}
                        onValueChange={(value) => updateCondition(condition.id, { field: value as CollectionRuleField })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(fieldLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={condition.operator}
                        onValueChange={(value) => updateCondition(condition.id, { operator: value as CollectionRuleOperator })}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {Object.entries(operatorLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        value={condition.value}
                        onChange={(event) => updateCondition(condition.id, { value: event.target.value })}
                        placeholder="Value"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            conditions:
                              current.conditions.length > 1
                                ? current.conditions.filter((item) => item.id !== condition.id)
                                : [createCondition()],
                          }))
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setForm((current) => ({ ...current, conditions: [...current.conditions, createCondition()] }))}
                >
                  Add Condition
                </Button>
              </div>
            )}

            <div className="space-y-2">
              <Label>Tags</Label>
              <Textarea
                className="min-h-[80px]"
                value={form.tags}
                onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
                placeholder="featured, festive, summer"
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-default-200 bg-default-50 p-3">
              <div>
                <p className="text-sm font-medium text-default-900">Active</p>
                <p className="text-xs text-default-500">Visible to storefront collection queries</p>
              </div>
              <Switch
                checked={form.isActive}
                onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))}
              />
            </div>

            <div className="rounded-lg border border-default-200 bg-default-50 p-4">
              <p className="text-sm font-medium text-default-900">Preview</p>
              <p className="text-xs text-default-500 mt-1">
                {matchingProducts.length} product(s) will appear in this collection
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {matchingProducts.slice(0, 6).map((product) => (
                  <Badge key={product.id} className="rounded-full bg-default-100 text-default-700">
                    {product.name}
                  </Badge>
                ))}
                {matchingProducts.length > 6 && (
                  <Badge className="rounded-full bg-default-100 text-default-700">
                    +{matchingProducts.length - 6} more
                  </Badge>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              <Button className="gap-1" onClick={() => void handleSave()} disabled={isSaving}>
                <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Collection"}
              </Button>
              {form.id && <Button variant="outline" onClick={resetForm}>Cancel</Button>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-default-200">
                  <TableHead>Collection</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-default-400">
                      Loading collections...
                    </TableCell>
                  </TableRow>
                ) : sortedCollections.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-10 text-default-400">
                      No collections created yet
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedCollections.map((collection) => {
                    const count =
                      collection.collectionType === "manual"
                        ? collection.productIds.length
                        : products.filter((product) => {
                            const results = (collection.conditions ?? []).map((condition) =>
                              productMatchesCondition(product, condition)
                            );
                            return collection.conditionsMatch === "all"
                              ? results.every(Boolean)
                              : results.some(Boolean);
                          }).length;

                    return (
                      <TableRow key={collection.id}>
                        <TableCell>
                          <div className="space-y-1">
                            <div className="font-medium text-default-900">{collection.title}</div>
                            <div className="text-xs text-default-500">
                              /collections/{collection.slug}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("rounded-full text-[10px]", collection.collectionType === "smart" ? "bg-info/10 text-info" : "bg-warning/10 text-warning")}>
                            {collection.collectionType === "smart" ? "Smart" : "Manual"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-default-600">{count}</TableCell>
                        <TableCell>
                          <Badge className={cn("text-[10px]", collection.isActive ? "bg-success/10 text-success" : "bg-default-100 text-default-500")}>
                            {collection.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void handleToggle(collection)}>
                              <Power className={cn("h-4 w-4", collection.isActive ? "text-success" : "text-default-400")} />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => setForm(toForm(collection))}>
                              Edit
                            </Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => void handleDelete(collection)}>
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CollectionsManagement;
