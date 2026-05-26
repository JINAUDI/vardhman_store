"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { ProductDraft } from "@/lib/store/types";
import { formatINR } from "@/lib/utils/currency";

interface PricingFormProps {
  draft: ProductDraft;
  onUpdate: (updates: Partial<ProductDraft>) => void;
}

const PricingForm: React.FC<PricingFormProps> = ({ draft, onUpdate }) => {
  const handleRegionalPricing = (
    region: "india",
    value: string
  ) => {
    onUpdate({
      regionalPricing: {
        ...draft.regionalPricing,
        [region]: value ? parseFloat(value) : undefined,
      },
    });
  };

  return (
    <div className="space-y-4">
      {/* Main Pricing */}
      <Card>
        <CardHeader className="border-b border-default-200 mb-4">
          <CardTitle className="text-lg">Pricing</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Price <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <Input
                  type="number"
                  value={draft.price || ""}
                  onChange={(e) =>
                    onUpdate({ price: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                  className="pl-7"
                  step="0.01"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-default-400">
                  ₹
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Compare-at price</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={draft.compareAtPrice || ""}
                  onChange={(e) =>
                    onUpdate({
                      compareAtPrice: parseFloat(e.target.value) || undefined,
                    })
                  }
                  placeholder="0.00"
                  className="pl-7"
                  step="0.01"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-default-400">
                  ₹
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Cost per item</Label>
              <div className="relative">
                <Input
                  type="number"
                  value={draft.costPerItem || ""}
                  onChange={(e) =>
                    onUpdate({
                      costPerItem: parseFloat(e.target.value) || undefined,
                    })
                  }
                  placeholder="0.00"
                  className="pl-7"
                  step="0.01"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-default-400">
                  ₹
                </span>
              </div>
            </div>
          </div>

          {/* Margin indicator */}
          {draft.price > 0 && draft.costPerItem && draft.costPerItem > 0 && (
            <div className="flex items-center gap-4 p-3 rounded-lg bg-default-50 border border-default-200">
              <div className="text-sm">
                <span className="text-default-500">Margin: </span>
                <span className="font-semibold text-success">
                  {(
                    ((draft.price - draft.costPerItem) / draft.price) *
                    100
                  ).toFixed(1)}
                  %
                </span>
              </div>
              <div className="text-sm">
                <span className="text-default-500">Profit: </span>
                <span className="font-semibold text-default-900">
                  {formatINR(draft.price - draft.costPerItem, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Regional Pricing */}
      <Card>
        <CardHeader className="border-b border-default-200 mb-4">
          <CardTitle className="text-lg">Regional Pricing</CardTitle>
          <p className="text-sm text-default-500 mt-1">
            Set different prices for different regions
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "india" as const, label: "India", flag: "🇮🇳", currency: "INR" },
          ].map((region) => (
            <div
              key={region.key}
              className="flex items-center gap-3"
            >
              <span className="text-lg w-6">{region.flag}</span>
              <Label className="w-[140px] text-sm">{region.label}</Label>
              <div className="relative flex-1 max-w-[180px]">
                <Input
                  type="number"
                  value={draft.regionalPricing?.[region.key] || ""}
                  onChange={(e) =>
                    handleRegionalPricing(region.key, e.target.value)
                  }
                  placeholder={draft.price ? draft.price.toFixed(2) : "0.00"}
                  className="pl-12"
                  step="0.01"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-default-400">
                  {region.currency}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Inventory */}
      <Card>
        <CardHeader className="border-b border-default-200 mb-4">
          <CardTitle className="text-lg">Inventory</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                SKU (Stock Keeping Unit)
              </Label>
              <Input
                value={draft.sku}
                onChange={(e) => onUpdate({ sku: e.target.value })}
                placeholder="SKU-001"
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Barcode</Label>
              <Input
                value={draft.barcode || ""}
                onChange={(e) => onUpdate({ barcode: e.target.value })}
                placeholder="e.g. 123456789012"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Quantity <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                value={draft.quantity || ""}
                onChange={(e) =>
                  onUpdate({ quantity: parseInt(e.target.value) || 0 })
                }
                placeholder="0"
                min="0"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Low stock alert threshold
              </Label>
              <Input
                type="number"
                value={draft.lowStockThreshold}
                onChange={(e) =>
                  onUpdate({
                    lowStockThreshold: parseInt(e.target.value) || 10,
                  })
                }
                placeholder="10"
                min="0"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default PricingForm;
