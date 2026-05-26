"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAtom } from "jotai";
import {
  emptyDraft,
  productDraftAtom,
  productDraftStepAtom,
  productsAtom,
} from "@/lib/store/ecommerce-store";
import { createProductDraft } from "@/lib/store/actions";
import { generateId } from "@/lib/store/ecommerce-store";
import type { ProductDraft, ProductVariantDraft } from "@/lib/store/types";
import { formatINR } from "@/lib/utils/currency";
import {
  getSupabaseSetupMessage,
  isSupabaseConfigured,
} from "@/lib/supabase/config";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import StepperTabs, { type StepConfig } from "./stepper-tabs";
import MediaUpload from "./media-upload";
import PricingForm from "./pricing-form";
import ShippingForm from "./shipping-form";

import {
  ArrowLeft,
  ArrowRight,
  Save,
  Rocket,
  Plus,
  X,
  Check,
  Eye,
} from "lucide-react";

const STEPS: StepConfig[] = [
  { id: "media", title: "Photo & Video", shortTitle: "Photos" },
  { id: "category", title: "Category", shortTitle: "Category" },
  { id: "details", title: "Item Details", shortTitle: "Details" },
  { id: "variations", title: "Item Options", shortTitle: "Options" },
  { id: "pricing", title: "Pricing & Inventory", shortTitle: "Pricing" },
  { id: "shipping", title: "Delivery & Returns", shortTitle: "Delivery" },
  { id: "review", title: "Review & Publish", shortTitle: "Review" },
];

const categories = [
  "Electronics",
  "Mobile Accessories",
  "Health Supplements",
  "Hygiene & Personal Care",
  "Baby Products",
  "Household Items",
];

const subcategories: Record<string, string[]> = {
  Electronics: ["Keyboard", "Mouse", "OTG", "Pendrive", "Wifi Camera"],
  "Mobile Accessories": [
    "Bluetooth Speakers",
    "Caller Mic",
    "Data Cable",
    "Earbuds",
    "Headphone",
    "Mobile Charger",
    "Mobile Stand",
    "Neckbands",
    "SD Cards",
    "Smart Watches",
  ],
  "Health Supplements": [
    "Liquid Supplements",
    "Medicinal Supplements",
    "Supplement Powder",
  ],
  "Hygiene & Personal Care": [
    "Hair Dryer",
    "Hair Oil",
    "Hair Shampoo",
    "Hair Straightener",
    "Period Panty",
    "Sanitary Pads",
    "Toothpaste",
    "Trimmer",
    "Wipes",
  ],
  "Baby Products": [
    "Baby Cream",
    "Baby Lotion",
    "Baby Oil",
    "Baby Shampoo",
    "Baby Wipes",
  ],
  "Household Items": ["Dish Wash", "Toilet Cleaner"],
};

const colors = [
  "Black",
  "White",
  "Red",
  "Blue",
  "Green",
  "Navy",
  "Gray",
  "Brown",
  "Pink",
  "Yellow",
];

const sizes = ["XS", "S", "M", "L", "XL", "XXL"];

const ProductWizard: React.FC = () => {
  const [draft, setDraft] = useAtom(productDraftAtom);
  const [currentStep, setCurrentStep] = useAtom(productDraftStepAtom);
  const [, setProducts] = useAtom(productsAtom);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const [tagInput, setTagInput] = useState("");
  const [published, setPublished] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [catalogCategories, setCatalogCategories] = useState(categories);
  const isSupabaseReady = isSupabaseConfigured();
  const supabaseSetupMessage = getSupabaseSetupMessage();

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
          const names = payload.data
            .filter((item: { name?: string; isActive?: boolean }) => item?.name && item.isActive !== false)
            .map((item: { name: string }) => item.name);

          if (names.length > 0) {
            setCatalogCategories(names);
          }
        }
      } catch {
        // Keep seeded categories available while Supabase is being configured.
      }
    };

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  const updateDraft = useCallback(
    (updates: Partial<ProductDraft>) => {
      setDraft((prev) => createProductDraft(prev, updates));
    },
    [setDraft]
  );

  const validateStep = useCallback(
    (step: number) => {
      switch (step) {
        case 0:
          if (draft.images.length === 0) {
            return "Add at least one product image to continue.";
          }
          return null;
        case 1:
          if (!draft.category) {
            return "Select a category before moving to the next step.";
          }
          return null;
        case 2:
          if (!draft.name.trim()) return "Enter a product title.";
          if (!draft.description.trim()) return "Add a product description.";
          return null;
        case 3:
          if (
            draft.variants.some(
              (variant) => !variant.size || !variant.color || variant.stock < 0
            )
          ) {
            return "Complete each variant with size, color, and valid stock.";
          }
          return null;
        case 4:
          if (draft.price <= 0) return "Set a product price greater than 0.";
          if (!draft.sku.trim()) return "Add an SKU in Pricing & Inventory.";
          if (draft.quantity < 0) return "Inventory quantity cannot be negative.";
          return null;
        case 5:
          if (!draft.processingTime) {
            return "Select a processing time for delivery.";
          }
          if (
            !draft.freeShipping &&
            !draft.standardShipping &&
            !draft.expressShipping
          ) {
            return "Add at least one shipping option or enable free shipping.";
          }
          return null;
        default:
          return null;
      }
    },
    [draft]
  );

  const goNext = () => {
    const error = validateStep(currentStep);
    if (error) {
      setStepError(error);
      return;
    }

    setStepError(null);
    setCompletedSteps((prev) => new Set(Array.from(prev).concat(currentStep)));
    setCurrentStep(Math.min(currentStep + 1, STEPS.length - 1));
  };

  const goBack = () => {
    setStepError(null);
    setCurrentStep(Math.max(currentStep - 1, 0));
  };

  const handlePublish = async () => {
    if (!isSupabaseReady) {
      setStepError(supabaseSetupMessage);
      toast.error("Supabase is not configured");
      return;
    }

    for (let step = 0; step < STEPS.length - 1; step++) {
      const error = validateStep(step);
      if (error) {
        setCurrentStep(step);
        setStepError(error);
        return;
      }
    }

    try {
      setIsPublishing(true);
      setStepError(null);

      const response = await fetch("/api/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...draft,
          status: "published",
        }),
      });

      const payload = await response.json();
      if (!response.ok || !payload?.data) {
        throw new Error(payload?.message || "Unable to publish product.");
      }

      setProducts((prev) => [payload.data, ...prev]);
      setDraft(emptyDraft);
      setCurrentStep(0);
      setCompletedSteps(new Set());
      setPublished(true);
      toast.success("Product published to Supabase");
      setTimeout(() => setPublished(false), 3000);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to publish product.";
      setStepError(message);
      toast.error(message);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleSaveDraft = () => {
    updateDraft({ status: "draft" });
    setStepError(null);
  };

  const addTag = () => {
    const nextTag = tagInput.trim();
    if (nextTag && !draft.tags.includes(nextTag)) {
      updateDraft({ tags: [...draft.tags, nextTag] });
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    updateDraft({ tags: draft.tags.filter((item) => item !== tag) });
  };

  const addVariant = () => {
    const newVariant: ProductVariantDraft = {
      id: generateId("var"),
      size: "M",
      color: "Black",
      stock: 10,
      price: draft.price || 0,
      sku: `${draft.sku || "SKU"}-V${draft.variants.length + 1}`,
    };

    updateDraft({ variants: [...draft.variants, newVariant] });
  };

  const updateVariant = (
    index: number,
    updates: Partial<ProductVariantDraft>
  ) => {
    const variants = draft.variants.map((variant, variantIndex) =>
      variantIndex === index ? { ...variant, ...updates } : variant
    );
    updateDraft({ variants });
  };

  const removeVariant = (index: number) => {
    updateDraft({
      variants: draft.variants.filter((_, variantIndex) => variantIndex !== index),
    });
  };

  const renderCategory = () => (
    <Card>
      <CardHeader className="border-b border-default-200 mb-4">
        <CardTitle className="text-lg">Category</CardTitle>
        <p className="text-sm text-default-500 mt-1">
          Choose the best category for your item
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Label className="w-[120px] shrink-0">
            Category <span className="text-destructive">*</span>
          </Label>
          <Select
            value={draft.category}
            onValueChange={(value) =>
              updateDraft({ category: value, subcategory: undefined })
            }
          >
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Select category" />
            </SelectTrigger>
            <SelectContent>
              {catalogCategories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {draft.category && subcategories[draft.category] && (
          <div className="flex items-center gap-4">
            <Label className="w-[120px] shrink-0">Subcategory</Label>
            <Select
              value={draft.subcategory || ""}
              onValueChange={(value) => updateDraft({ subcategory: value })}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select subcategory" />
              </SelectTrigger>
              <SelectContent>
                {subcategories[draft.category].map((subcategory) => (
                  <SelectItem key={subcategory} value={subcategory}>
                    {subcategory}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </CardContent>
    </Card>
  );

  const renderDetails = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b border-default-200 mb-4">
          <CardTitle className="text-lg">Item Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </Label>
            <Input
              value={draft.name}
              onChange={(event) => updateDraft({ name: event.target.value })}
              placeholder="e.g. Handmade Ceramic Mug"
              maxLength={140}
            />
            <p className="text-xs text-default-400 text-right">
              {draft.name.length}/140
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              value={draft.description}
              onChange={(event) =>
                updateDraft({ description: event.target.value })
              }
              placeholder="Describe your item in detail..."
              className="min-h-[120px]"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Type and press Enter"
                className="flex-1"
              />
              <Button variant="outline" size="md" onClick={addTag}>
                Add
              </Button>
            </div>

            {draft.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {draft.tags.map((tag) => (
                  <Badge
                    key={tag}
                    className="bg-primary/10 text-primary text-xs gap-1 rounded-full pr-1"
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="ml-0.5 hover:bg-primary/20 rounded-full p-0.5"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-default-200 mb-4">
          <CardTitle className="text-lg">SEO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm">Meta Title</Label>
            <Input
              value={draft.metaTitle || ""}
              onChange={(event) => updateDraft({ metaTitle: event.target.value })}
              placeholder={draft.name || "Product title"}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm">Meta Description</Label>
            <Textarea
              value={draft.metaDescription || ""}
              onChange={(event) =>
                updateDraft({ metaDescription: event.target.value })
              }
              placeholder="SEO description..."
              className="min-h-[60px]"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderVariations = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b border-default-200 mb-4">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-lg">Variants</CardTitle>
              <p className="text-sm text-default-500 mt-1">
                Add size, color, and stock options
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-1"
              onClick={addVariant}
            >
              <Plus className="h-3.5 w-3.5" /> Add Variant
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {draft.variants.length === 0 ? (
            <div className="text-center py-8 text-default-400">
              <p className="text-sm">
                No variants yet. Add variants for size and color options.
              </p>
            </div>
          ) : (
            draft.variants.map((variant, index) => (
              <div
                key={variant.id}
                className="flex items-center gap-2 p-3 rounded-lg bg-default-50 border border-default-200"
              >
                <Select
                  value={variant.size || ""}
                  onValueChange={(value) => updateVariant(index, { size: value })}
                >
                  <SelectTrigger className="w-[80px] h-8 text-xs">
                    <SelectValue placeholder="Size" />
                  </SelectTrigger>
                  <SelectContent>
                    {sizes.map((size) => (
                      <SelectItem key={size} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={variant.color || ""}
                  onValueChange={(value) => updateVariant(index, { color: value })}
                >
                  <SelectTrigger className="w-[90px] h-8 text-xs">
                    <SelectValue placeholder="Color" />
                  </SelectTrigger>
                  <SelectContent>
                    {colors.map((color) => (
                      <SelectItem key={color} value={color}>
                        {color}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  type="number"
                  value={variant.stock}
                  onChange={(event) =>
                    updateVariant(index, {
                      stock: parseInt(event.target.value, 10) || 0,
                    })
                  }
                  className="w-[70px] h-8 text-xs"
                  placeholder="Stock"
                />

                <div className="relative flex-1 max-w-[100px]">
                  <Input
                    type="number"
                    value={variant.price}
                    onChange={(event) =>
                      updateVariant(index, {
                        price: parseFloat(event.target.value) || 0,
                      })
                    }
                    className="h-8 text-xs pl-5"
                    step="0.01"
                  />
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-default-400">
                    ₹
                  </span>
                </div>

                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 shrink-0 text-destructive"
                  onClick={() => removeVariant(index)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-default-200 mb-4">
          <CardTitle className="text-lg">Personalization</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Accept custom personalization</p>
              <p className="text-xs text-default-500">
                Allow buyers to add custom text or requests
              </p>
            </div>
            <Switch
              checked={draft.hasPersonalization}
              onCheckedChange={(checked) =>
                updateDraft({ hasPersonalization: checked })
              }
              color="success"
            />
          </div>

          {draft.hasPersonalization && (
            <Textarea
              value={draft.personalizationInstructions || ""}
              onChange={(event) =>
                updateDraft({
                  personalizationInstructions: event.target.value,
                })
              }
              placeholder="Instructions for buyers (e.g. 'Enter name to engrave')"
              className="min-h-[60px]"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );

  const renderReview = () => (
    <div className="space-y-4">
      <Card>
        <CardHeader className="border-b border-default-200 mb-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-default-500" />
            <CardTitle className="text-lg">Review Your Listing</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              {draft.images.length > 0 ? (
                <div className="aspect-square rounded-lg overflow-hidden border border-default-200">
                  <img
                    src={draft.images[0]}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="aspect-square rounded-lg bg-default-100 flex items-center justify-center text-default-400">
                  No image
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h3 className="text-xl font-semibold text-default-900">
                {draft.name || "Untitled Product"}
              </h3>
              <p className="text-2xl font-bold text-primary">
                {formatINR(draft.price, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
                {draft.compareAtPrice && (
                  <span className="text-sm line-through text-default-400 ml-2">
                    {formatINR(draft.compareAtPrice, {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </span>
                )}
              </p>
              {draft.category && (
                <Badge className="bg-default-100 text-default-600 text-xs">
                  {draft.category}
                  {draft.subcategory && ` / ${draft.subcategory}`}
                </Badge>
              )}
              <p className="text-sm text-default-600 leading-relaxed">
                {draft.description || "No description"}
              </p>
              {draft.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {draft.tags.map((tag) => (
                    <Badge
                      key={tag}
                      className="bg-primary/10 text-primary text-[10px] rounded-full"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-4 border-t border-default-200">
            {[
              { label: "Images", value: `${draft.images.length}` },
              { label: "Variants", value: `${draft.variants.length}` },
              { label: "Stock", value: `${draft.quantity}` },
              { label: "Shipping", value: draft.freeShipping ? "Free" : "Paid" },
            ].map((item) => (
              <div
                key={item.label}
                className="text-center p-3 rounded-lg bg-default-50"
              >
                <p className="text-xs text-default-500">{item.label}</p>
                <p className="text-sm font-semibold text-default-900 mt-0.5">
                  {item.value}
                </p>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-default-50 border border-default-200">
            <div>
              <p className="text-sm font-medium">Featured product</p>
              <p className="text-xs text-default-500">
                Show on homepage featured section
              </p>
            </div>
            <Switch
              checked={draft.featured}
              onCheckedChange={(checked) => updateDraft({ featured: checked })}
              color="success"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <MediaUpload draft={draft} onUpdate={updateDraft} />;
      case 1:
        return renderCategory();
      case 2:
        return renderDetails();
      case 3:
        return renderVariations();
      case 4:
        return <PricingForm draft={draft} onUpdate={updateDraft} />;
      case 5:
        return <ShippingForm draft={draft} onUpdate={updateDraft} />;
      case 6:
        return renderReview();
      default:
        return null;
    }
  };

  if (published) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center">
          <Check className="h-8 w-8 text-success" />
        </div>
        <h2 className="text-2xl font-semibold text-default-900">
          Product Published!
        </h2>
        <p className="text-sm text-default-500">
          Your product has been added to the catalog.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-semibold text-default-900">
            Create Product
          </h2>
          <p className="text-sm text-default-500 mt-1">
            Step {currentStep + 1} of {STEPS.length} - {STEPS[currentStep].title}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1"
          onClick={handleSaveDraft}
        >
          <Save className="h-3.5 w-3.5" /> Save Draft
        </Button>
      </div>

      <Card className="p-3">
        <StepperTabs
          steps={STEPS}
          currentStep={currentStep}
          completedSteps={completedSteps}
          onStepClick={(step) => {
            setStepError(null);
            setCurrentStep(step);
          }}
        />
      </Card>

      {!isSupabaseReady && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-4">
            <p className="text-sm font-medium text-warning">Supabase setup required</p>
            <p className="text-sm text-default-600 mt-1">{supabaseSetupMessage}</p>
          </CardContent>
        </Card>
      )}

      {renderStep()}

      {stepError && <p className="text-sm text-destructive px-1">{stepError}</p>}

      <div className="flex justify-between items-center pt-2">
        <Button
          variant="outline"
          onClick={goBack}
          disabled={currentStep === 0}
          className="gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>
        <div className="flex gap-2">
          {currentStep === STEPS.length - 1 ? (
            <Button
              onClick={() => void handlePublish()}
              className="gap-1.5"
              color="success"
              disabled={isPublishing || !isSupabaseReady}
              title={!isSupabaseReady ? supabaseSetupMessage : undefined}
            >
              <Rocket className="h-4 w-4" /> Publish Product
            </Button>
          ) : (
            <Button onClick={goNext} className="gap-1.5">
              Next <ArrowRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductWizard;
