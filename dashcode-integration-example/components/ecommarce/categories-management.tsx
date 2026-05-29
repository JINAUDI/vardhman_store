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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { slugifyCatalogValue } from "@/lib/supabase/catalog";
import type { Category } from "@/lib/store/types";

type CategoryFormState = {
  id?: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  isActive: boolean;
  sortOrder: string;
};

const emptyForm: CategoryFormState = {
  name: "",
  slug: "",
  icon: "fas fa-tag",
  description: "",
  isActive: true,
  sortOrder: "0",
};

function toForm(category: Category): CategoryFormState {
  return {
    id: category.id,
    name: category.name,
    slug: category.slug,
    icon: category.icon || "fas fa-tag",
    description: category.description || "",
    isActive: category.isActive,
    sortOrder: category.sortOrder.toString(),
  };
}

function toPayload(form: CategoryFormState): Partial<Category> {
  return {
    name: form.name.trim(),
    slug: form.slug.trim() || slugifyCatalogValue(form.name),
    icon: form.icon.trim(),
    description: form.description.trim(),
    isActive: form.isActive,
    sortOrder: Number(form.sortOrder) || 0,
  };
}

const CategoriesManagement = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState<CategoryFormState>(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [categories]
  );

  const loadCategories = useCallback(async () => {
    setLoadError(null);
    const response = await fetch("/api/categories", { cache: "no-store" });
    const payload = await response.json().catch(() => null);

    if (!response.ok || !Array.isArray(payload?.data)) {
      throw new Error(payload?.message || "Unable to load categories.");
    }

    setCategories(payload.data);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setIsLoading(true);
      try {
        await loadCategories();
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load categories.";
          setLoadError(message);
          toast.error("Unable to load categories");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [loadCategories]);

  const handleNameChange = (name: string) => {
    setForm((current) => ({
      ...current,
      name,
      slug: current.id ? current.slug : slugifyCatalogValue(name),
    }));
  };

  const resetForm = () => setForm(emptyForm);

  const handleSave = async () => {
    if (!form.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(form.id ? `/api/categories/${form.id}` : "/api/categories", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.message || "Unable to save category.");
      }

      await loadCategories();
      resetForm();
      toast.success(form.id ? "Category updated" : "Category created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save category");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async (category: Category) => {
    try {
      const response = await fetch(`/api/categories/${category.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...category, isActive: !category.isActive }),
      });
      if (!response.ok) throw new Error("Unable to update category status.");
      await loadCategories();
      toast.success("Category status updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update category");
    }
  };

  const handleDelete = async (category: Category, force = false) => {
    try {
      const response = await fetch(`/api/categories/${category.id}${force ? "?force=true" : ""}`, {
        method: "DELETE",
      });
      const payload = await response.json().catch(() => null);

      if (response.status === 409 && !force) {
        const confirmed = window.confirm(payload?.message || "This category has linked products. Delete anyway?");
        if (confirmed) await handleDelete(category, true);
        return;
      }

      if (!response.ok) {
        throw new Error(payload?.message || "Unable to delete category.");
      }

      await loadCategories();
      if (form.id === category.id) resetForm();
      toast.success("Category deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete category");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-default-900">Categories</h2>
          <p className="text-sm text-default-500 mt-1">
            Manage storefront categories synced with Supabase
          </p>
          {loadError && <p className="text-xs text-destructive mt-1">{loadError}</p>}
        </div>
        <Button size="sm" className="gap-1" onClick={resetForm}>
          <Plus className="h-4 w-4" /> New Category
        </Button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-5">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-default-900">
                {form.id ? "Edit Category" : "Add Category"}
              </h3>
              <p className="text-xs text-default-500 mt-1">Use Font Awesome icon classes to preserve Vardhman Store styling.</p>
            </div>

            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={form.name} onChange={(event) => handleNameChange(event.target.value)} placeholder="Electronics" />
            </div>

            <div className="space-y-2">
              <Label>Slug</Label>
              <Input value={form.slug} onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))} placeholder="electronics" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Icon</Label>
                <Input value={form.icon} onChange={(event) => setForm((current) => ({ ...current, icon: event.target.value }))} placeholder="fas fa-laptop" />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea className="min-h-[110px]" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-default-200 bg-default-50 p-3">
              <div>
                <p className="text-sm font-medium text-default-900">Active</p>
                <p className="text-xs text-default-500">Visible on Vardhman Store storefront</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
            </div>

            <div className="flex gap-2">
              <Button className="gap-1" onClick={() => void handleSave()} disabled={isSaving}>
                <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Category"}
              </Button>
              {form.id && (
                <Button variant="outline" onClick={resetForm}>
                  Cancel
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="px-0 pt-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-default-200">
                  <TableHead>Category</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Sort</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-default-400">Loading categories...</TableCell>
                  </TableRow>
                ) : sortedCategories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-default-400">No categories found</TableCell>
                  </TableRow>
                ) : (
                  sortedCategories.map((category) => (
                    <TableRow key={category.id} className="h-[64px]">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-warning/10 text-warning flex items-center justify-center">
                            <i className={category.icon || "fas fa-tag"} />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-default-900">{category.name}</p>
                            <p className="text-xs text-default-500 line-clamp-1">{category.description || "No description"}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-default-600">{category.slug}</TableCell>
                      <TableCell className="text-sm">{category.sortOrder}</TableCell>
                      <TableCell>
                        <Badge className={cn("text-[10px]", category.isActive ? "bg-success/10 text-success" : "bg-default-100 text-default-500")}>
                          {category.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => void handleToggle(category)} title="Toggle active">
                            <Power className={cn("h-4 w-4", category.isActive ? "text-success" : "text-default-400")} />
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setForm(toForm(category))}>Edit</Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => void handleDelete(category)} title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CategoriesManagement;
