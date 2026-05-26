"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { GripVertical, Image as ImageIcon, LoaderCircle, Plus, Save, Trash2, Upload } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Category, HomepageBanner } from "@/lib/store/types";

const noCategoryValue = "__none__";

const bannerSections = [
  { key: "hero", label: "Hero Slider" },
  { key: "category_promo", label: "Category Promotional" },
  { key: "mid_offer", label: "Mid Page Offer" },
  { key: "deals", label: "Deals / Offers" },
  { key: "trending", label: "Trending / Best Seller" },
  { key: "bottom_promo", label: "Bottom Promotional" },
] as const;

type SectionKey = (typeof bannerSections)[number]["key"];

type BannerFormState = {
  id?: string;
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
  imageUrl: string;
  categoryId: string;
  sectionKey: SectionKey;
  bannerType: string;
  isActive: boolean;
  sortOrder: string;
};

function createEmptyForm(sectionKey: SectionKey): BannerFormState {
  return {
    title: "",
    subtitle: "",
    buttonText: "Shop Now",
    buttonLink: "shop-left-sidebar.html",
    imageUrl: "",
    categoryId: "",
    sectionKey,
    bannerType: sectionKey,
    isActive: true,
    sortOrder: "0",
  };
}

function toForm(banner: HomepageBanner): BannerFormState {
  const sectionKey = (banner.sectionKey || banner.bannerType || "hero") as SectionKey;
  return {
    id: banner.id,
    title: banner.title,
    subtitle: banner.subtitle || "",
    buttonText: banner.buttonText,
    buttonLink: banner.buttonLink || "",
    imageUrl: banner.imageUrl,
    categoryId: banner.categoryId || "",
    sectionKey,
    bannerType: banner.bannerType || sectionKey,
    isActive: banner.isActive,
    sortOrder: banner.sortOrder.toString(),
  };
}

function toPayload(form: BannerFormState): Partial<HomepageBanner> {
  return {
    title: form.title.trim(),
    subtitle: form.subtitle.trim(),
    buttonText: form.buttonText.trim() || "Shop Now",
    buttonLink: form.buttonLink.trim(),
    imageUrl: form.imageUrl.trim(),
    categoryId: form.categoryId || undefined,
    sectionKey: form.sectionKey,
    bannerType: form.bannerType.trim() || form.sectionKey,
    isActive: form.isActive,
    sortOrder: Number(form.sortOrder) || 0,
  };
}

const HomepageBannersManagement = () => {
  const [banners, setBanners] = useState<HomepageBanner[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeSection, setActiveSection] = useState<SectionKey>("hero");
  const [form, setForm] = useState<BannerFormState>(createEmptyForm("hero"));
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const categoryById = useMemo(() => new Map(categories.map((category) => [category.id, category])), [categories]);
  const activeCategories = categories.filter((category) => category.isActive);
  const currentSection = bannerSections.find((section) => section.key === activeSection) || bannerSections[0];

  const visibleBanners = useMemo(
    () =>
      banners
        .filter((banner) => (banner.sectionKey || banner.bannerType || "hero") === activeSection)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title)),
    [activeSection, banners]
  );

  const loadData = useCallback(async () => {
    setLoadError(null);
    const [bannerResponse, categoryResponse] = await Promise.all([
      fetch("/api/homepage-banners", { cache: "no-store" }),
      fetch("/api/categories", { cache: "no-store" }),
    ]);
    const [bannerPayload, categoryPayload] = await Promise.all([
      bannerResponse.json().catch(() => null),
      categoryResponse.json().catch(() => null),
    ]);

    if (!bannerResponse.ok || !Array.isArray(bannerPayload?.data)) {
      throw new Error(bannerPayload?.message || "Unable to load homepage banners.");
    }
    if (categoryResponse.ok && Array.isArray(categoryPayload?.data)) {
      setCategories(categoryPayload.data);
    }
    setBanners(bannerPayload.data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setIsLoading(true);
      try {
        await loadData();
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : "Unable to load banners.";
          setLoadError(message);
          toast.error("Unable to load homepage banners");
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

  const resetForm = (sectionKey = activeSection) => setForm(createEmptyForm(sectionKey));

  const handleSectionChange = (sectionKey: SectionKey) => {
    setActiveSection(sectionKey);
    resetForm(sectionKey);
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Banner title is required");
      return;
    }
    if (!form.imageUrl.trim()) {
      toast.error("Banner image URL is required");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(form.id ? `/api/homepage-banners/${form.id}` : "/api/homepage-banners", {
        method: form.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toPayload(form)),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Unable to save homepage banner.");

      await loadData();
      resetForm(form.sectionKey);
      toast.success(form.id ? "Homepage banner updated" : "Homepage banner created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save homepage banner");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = async (file: File | null) => {
    if (!file) return;

    const body = new FormData();
    body.append("file", file);
    setIsUploading(true);

    try {
      const response = await fetch("/api/homepage-banners/upload", {
        method: "POST",
        body,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.message || "Unable to upload banner image.");
      }

      const imageUrl = payload?.data?.url || payload?.data?.relativeUrl;
      if (!imageUrl) {
        throw new Error("Upload finished but no image URL was returned.");
      }

      setForm((current) => ({ ...current, imageUrl }));
      toast.success("Banner image uploaded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload banner image");
    } finally {
      setIsUploading(false);
    }
  };

  const handleToggle = async (banner: HomepageBanner) => {
    try {
      const response = await fetch(`/api/homepage-banners/${banner.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...banner, isActive: !banner.isActive }),
      });
      if (!response.ok) throw new Error("Unable to update banner status.");
      await loadData();
      toast.success("Banner status updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update banner");
    }
  };

  const handleDelete = async (banner: HomepageBanner) => {
    if (!window.confirm(`Delete "${banner.title}" from homepage banners?`)) return;

    try {
      const response = await fetch(`/api/homepage-banners/${banner.id}`, { method: "DELETE" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.message || "Unable to delete homepage banner.");

      await loadData();
      if (form.id === banner.id) resetForm(activeSection);
      toast.success("Homepage banner deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to delete homepage banner");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-default-900">Homepage Banners</h2>
          <p className="text-sm text-default-500 mt-1">Manage every Radios homepage banner section from Supabase</p>
          {loadError && <p className="text-xs text-destructive mt-1">{loadError}</p>}
        </div>
        <Button size="sm" className="gap-1" onClick={() => resetForm()}>
          <Plus className="h-4 w-4" /> New Banner
        </Button>
      </div>

      <div className="flex gap-1 bg-default-100 p-1 rounded-lg w-full overflow-x-auto">
        {bannerSections.map((section) => (
          <button
            key={section.key}
            onClick={() => handleSectionChange(section.key)}
            className={cn(
              "px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 whitespace-nowrap",
              activeSection === section.key ? "bg-card text-default-900 shadow-sm" : "text-default-500 hover:text-default-700"
            )}
          >
            {section.label}
            <span className="ml-1.5 text-[10px] opacity-60">
              {banners.filter((banner) => (banner.sectionKey || banner.bannerType || "hero") === section.key).length}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[420px_1fr] gap-5">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-default-900">{form.id ? "Edit Banner" : "Add Banner"}</h3>
              <p className="text-xs text-default-500 mt-1">Current section: {currentSection.label}</p>
            </div>

            <div className="space-y-2">
              <Label>Homepage Section</Label>
              <Select
                value={form.sectionKey}
                onValueChange={(value: SectionKey) =>
                  setForm((current) => ({ ...current, sectionKey: value, bannerType: current.bannerType || value }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {bannerSections.map((section) => (
                    <SelectItem key={section.key} value={section.key}>{section.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} placeholder="Electronics" />
            </div>

            <div className="space-y-2">
              <Label>Subtitle</Label>
              <Textarea className="min-h-[84px]" value={form.subtitle} onChange={(event) => setForm((current) => ({ ...current, subtitle: event.target.value }))} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Button Text</Label>
                <Input value={form.buttonText} onChange={(event) => setForm((current) => ({ ...current, buttonText: event.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Sort Order</Label>
                <Input type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Button Link</Label>
              <Input value={form.buttonLink} onChange={(event) => setForm((current) => ({ ...current, buttonLink: event.target.value }))} placeholder="shop-left-sidebar.html" />
            </div>

            <div className="space-y-2">
              <Label>Image URL</Label>
              <div className="flex gap-2">
                <Input value={form.imageUrl} onChange={(event) => setForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="Upload an image or paste a URL" />
                <label className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-default-200 bg-background px-3 text-sm font-medium text-default-700 hover:bg-default-50">
                  {isUploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    disabled={isUploading}
                    onChange={(event) => {
                      void handleImageUpload(event.target.files?.[0] || null);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={form.categoryId || noCategoryValue} onValueChange={(value) => setForm((current) => ({ ...current, categoryId: value === noCategoryValue ? "" : value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={noCategoryValue}>No category</SelectItem>
                    {activeCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Banner Type</Label>
                <Input value={form.bannerType} onChange={(event) => setForm((current) => ({ ...current, bannerType: event.target.value }))} />
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-default-200 bg-default-50 p-3">
              <div>
                <p className="text-sm font-medium text-default-900">Active</p>
                <p className="text-xs text-default-500">Visible in storefront section</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(checked) => setForm((current) => ({ ...current, isActive: checked }))} />
            </div>

            <div className="rounded-lg border border-default-200 overflow-hidden bg-default-50">
              {form.imageUrl ? (
                <div className="relative min-h-[180px] bg-default-900">
                  <img src={form.imageUrl} alt={form.title || "Banner preview"} className="absolute inset-0 h-full w-full object-cover" />
                  <div className="absolute inset-0 bg-black/35" />
                  <div className="relative p-5 text-white">
                    <p className="text-xs uppercase tracking-wide">{form.subtitle || currentSection.label}</p>
                    <h4 className="text-2xl font-semibold mt-1">{form.title || "Banner title"}</h4>
                    <span className="inline-flex mt-4 rounded bg-warning px-4 py-2 text-xs font-semibold text-default-900">{form.buttonText || "Shop Now"}</span>
                  </div>
                </div>
              ) : (
                <div className="h-[180px] flex flex-col items-center justify-center text-default-400 gap-2">
                  <ImageIcon className="h-8 w-8" />
                  <p className="text-sm">Image preview appears here</p>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button className="gap-1" onClick={() => void handleSave()} disabled={isSaving}>
                <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Banner"}
              </Button>
              {form.id && <Button variant="outline" onClick={() => resetForm(form.sectionKey)}>Cancel</Button>}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 h-fit">
          {isLoading ? (
            <Card><CardContent className="py-12 text-center text-default-400">Loading homepage banners...</CardContent></Card>
          ) : visibleBanners.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-default-400">No banners found for {currentSection.label}</CardContent></Card>
          ) : (
            visibleBanners.map((banner) => (
              <Card key={banner.id} className={cn("transition-all", !banner.isActive && "opacity-60")}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <GripVertical className="h-5 w-5 text-default-300 cursor-grab shrink-0" />
                    <div className="h-20 w-32 rounded-lg bg-default-100 overflow-hidden flex items-center justify-center shrink-0">
                      <img src={banner.imageUrl} alt={banner.title} className="h-full w-full object-cover" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-default-800">{banner.title}</h3>
                      <p className="text-xs text-default-400 mt-0.5">Position: {banner.sortOrder} / Section: {currentSection.label}</p>
                      <p className="text-xs text-default-400 truncate">{banner.subtitle || banner.buttonLink || "No subtitle"}</p>
                      {banner.categoryId && <p className="text-xs text-default-500 mt-1">Category: {categoryById.get(banner.categoryId)?.name || banner.categoryId}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge className={cn("text-[10px]", banner.isActive ? "bg-success/10 text-success" : "bg-default-100 text-default-500")}>{banner.isActive ? "Active" : "Inactive"}</Badge>
                      <Switch checked={banner.isActive} onCheckedChange={() => void handleToggle(banner)} />
                      <Button size="sm" variant="outline" onClick={() => setForm(toForm(banner))}>Edit</Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:bg-destructive/10" onClick={() => void handleDelete(banner)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default HomepageBannersManagement;
