"use client";

import React, { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { Coupon, CouponType, DiscountCategory } from "@/lib/store/types";
import { generateCouponCode } from "@/lib/store/actions";
import { productsAtom } from "@/lib/store/ecommerce-store";
import { useAtomValue } from "jotai";
import { RefreshCw, Sparkles, X } from "lucide-react";

interface DiscountFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  discountCategory: DiscountCategory;
  onSubmit: (coupon: Omit<Coupon, "id" | "createdAt" | "usedCount">) => void;
}

const categoryLabels: Record<DiscountCategory, string> = {
  product_discount: "Amount off products",
  buy_x_get_y: "Buy X Get Y",
  order_discount: "Amount off order",
  free_shipping: "Free shipping",
};

const categoryColors: Record<DiscountCategory, string> = {
  product_discount: "bg-primary/10 text-primary",
  buy_x_get_y: "bg-success/10 text-success",
  order_discount: "bg-info/10 text-info",
  free_shipping: "bg-warning/10 text-warning",
};

const shippingRegions = [
  "North America",
  "Europe",
  "Asia",
  "South America",
  "Africa",
  "Oceania",
];

function formatInputDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const DiscountForm: React.FC<DiscountFormProps> = ({
  open,
  onOpenChange,
  discountCategory,
  onSubmit,
}) => {
  const products = useAtomValue(productsAtom);

  const [code, setCode] = useState("");
  const [type, setType] = useState<CouponType>("percentage");
  const [value, setValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [minQuantity, setMinQuantity] = useState("1");
  const [maxDiscount, setMaxDiscount] = useState("");
  const [usageLimit, setUsageLimit] = useState("100");
  const [expiryDate, setExpiryDate] = useState("");
  const [buyQuantity, setBuyQuantity] = useState("2");
  const [getQuantity, setGetQuantity] = useState("1");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [regions, setRegions] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product.name])),
    [products]
  );

  const needsProductSelection =
    discountCategory === "product_discount" || discountCategory === "buy_x_get_y";
  const needsDiscountValue =
    discountCategory === "product_discount" || discountCategory === "order_discount";
  const needsOrderMin =
    discountCategory === "order_discount" || discountCategory === "free_shipping";

  useEffect(() => {
    if (!open) return;
    const defaultExpiry = new Date();
    defaultExpiry.setDate(defaultExpiry.getDate() + 30);

    setCode(generateCouponCode());
    setType(
      discountCategory === "free_shipping"
        ? "flat"
        : discountCategory === "buy_x_get_y"
          ? "percentage"
          : "percentage"
    );
    setValue(discountCategory === "buy_x_get_y" ? "100" : "");
    setMinOrderAmount("");
    setMinQuantity("1");
    setMaxDiscount("");
    setUsageLimit("100");
    setExpiryDate(formatInputDate(defaultExpiry));
    setBuyQuantity("2");
    setGetQuantity("1");
    setSelectedProductId("");
    setSelectedProductIds([]);
    setRegions([]);
    setIsActive(true);
  }, [open, discountCategory]);

  const handleGenerateCode = () => setCode(generateCouponCode());

  const handleAddProduct = () => {
    if (!selectedProductId || selectedProductIds.includes(selectedProductId)) return;
    setSelectedProductIds((prev) => [...prev, selectedProductId]);
    setSelectedProductId("");
  };

  const handleRemoveProduct = (productId: string) => {
    setSelectedProductIds((prev) => prev.filter((id) => id !== productId));
  };

  const toggleRegion = (region: string) => {
    setRegions((prev) =>
      prev.includes(region) ? prev.filter((item) => item !== region) : [...prev, region]
    );
  };

  const handleSubmit = () => {
    if (!code.trim()) return;
    if (needsDiscountValue && !value) return;
    if (needsProductSelection && selectedProductIds.length === 0) return;
    if (discountCategory === "free_shipping" && regions.length === 0) return;
    if (discountCategory === "product_discount" && (parseInt(minQuantity, 10) || 0) < 1) return;
    if (discountCategory === "buy_x_get_y") {
      if ((parseInt(buyQuantity, 10) || 0) < 1) return;
      if ((parseInt(getQuantity, 10) || 0) < 1) return;
    }
    if (!expiryDate) return;

    const parsedExpiry = new Date(`${expiryDate}T23:59:59`);
    const expiresAt = Number.isNaN(parsedExpiry.getTime())
      ? new Date(Date.now() + 30 * 86400000).toISOString()
      : parsedExpiry.toISOString();

    const appliesTo =
      needsProductSelection && selectedProductIds.length > 0
        ? "specific_products"
        : "all";

    onSubmit({
      code: code.toUpperCase(),
      type,
      discountCategory,
      value:
        discountCategory === "free_shipping"
          ? 0
          : discountCategory === "buy_x_get_y"
            ? 100
            : parseFloat(value) || 0,
      minOrderAmount: needsOrderMin ? parseFloat(minOrderAmount) || 0 : 0,
      minQuantity:
        discountCategory === "product_discount" ? parseInt(minQuantity, 10) || 1 : undefined,
      maxDiscount:
        type === "percentage" && needsDiscountValue
          ? parseFloat(maxDiscount) || undefined
          : undefined,
      usageLimit: parseInt(usageLimit, 10) || 100,
      expiresAt,
      status: isActive ? "active" : "disabled",
      appliesTo,
      selectedProductIds: needsProductSelection ? selectedProductIds : undefined,
      buyQuantity: discountCategory === "buy_x_get_y" ? parseInt(buyQuantity, 10) || 1 : undefined,
      getQuantity: discountCategory === "buy_x_get_y" ? parseInt(getQuantity, 10) || 1 : undefined,
      regions: discountCategory === "free_shipping" ? regions : undefined,
      autoGenerated: false,
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="p-0 gap-0 max-h-[85vh] overflow-y-auto">
        <DialogHeader className="p-6 pb-3 border-b border-default-200">
          <div className="flex items-center gap-3">
            <DialogTitle className="text-lg">Create Discount</DialogTitle>
            <Badge
              className={cn(
                "text-[11px] rounded-full font-medium",
                categoryColors[discountCategory]
              )}
            >
              {categoryLabels[discountCategory]}
            </Badge>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Discount Code</Label>
            <div className="flex gap-2">
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. SPRINGSALE"
                className="flex-1 uppercase font-mono tracking-wider"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={handleGenerateCode}
                title="Generate code"
                className="shrink-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {needsDiscountValue && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Discount Type</Label>
                <Select value={type} onValueChange={(val) => setType(val as CouponType)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentage (%)</SelectItem>
                    <SelectItem value="flat">Fixed Amount ($)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  {type === "percentage" ? "Discount value (%)" : "Discount value"}
                </Label>
                <div className="relative">
                  <Input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder={type === "percentage" ? "10" : "20.00"}
                    className="h-9 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-default-400">
                    {type === "percentage" ? "%" : "$"}
                  </span>
                </div>
              </div>
            </div>
          )}

          {discountCategory === "buy_x_get_y" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Buy quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={buyQuantity}
                  onChange={(e) => setBuyQuantity(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Get quantity</Label>
                <Input
                  type="number"
                  min="1"
                  value={getQuantity}
                  onChange={(e) => setGetQuantity(e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          )}

          {needsProductSelection && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Product selection</Label>
              <div className="flex gap-2">
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="flex-1 h-9">
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    {products.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" onClick={handleAddProduct}>
                  Add
                </Button>
              </div>
              {selectedProductIds.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {selectedProductIds.map((id) => (
                    <Badge
                      key={id}
                      className="text-[11px] bg-default-100 text-default-700 rounded-full gap-1 pr-1"
                    >
                      {productMap.get(id) || id}
                      <button
                        onClick={() => handleRemoveProduct(id)}
                        className="rounded-full hover:bg-default-200 p-0.5"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {(needsOrderMin || discountCategory === "product_discount" || (needsDiscountValue && type === "percentage")) && (
            <div className="grid grid-cols-2 gap-3">
              {needsOrderMin && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min. order value</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={minOrderAmount}
                      onChange={(e) => setMinOrderAmount(e.target.value)}
                      className="h-9 pl-7"
                      placeholder="0.00"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-default-400">
                      $
                    </span>
                  </div>
                </div>
              )}

              {discountCategory === "product_discount" && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Min. quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={minQuantity}
                    onChange={(e) => setMinQuantity(e.target.value)}
                    className="h-9"
                  />
                </div>
              )}

              {type === "percentage" && needsDiscountValue && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Max discount cap</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={maxDiscount}
                      onChange={(e) => setMaxDiscount(e.target.value)}
                      className="h-9 pl-7"
                      placeholder="No limit"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-default-400">
                      $
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {discountCategory === "free_shipping" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Shipping regions</Label>
              <div className="flex flex-wrap gap-1.5">
                {shippingRegions.map((region) => (
                  <button
                    key={region}
                    type="button"
                    onClick={() => toggleRegion(region)}
                    className={cn(
                      "text-xs px-2.5 py-1.5 rounded-full border transition-all",
                      regions.includes(region)
                        ? "bg-primary/10 text-primary border-primary/30"
                        : "bg-default-50 text-default-600 border-default-200 hover:border-primary/30"
                    )}
                  >
                    {region}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Usage limit</Label>
              <Input
                type="number"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Expiry date</Label>
              <Input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-default-50 border border-default-200">
            <div>
              <p className="text-sm font-medium text-default-900">Active discount</p>
              <p className="text-xs text-default-500">Enable immediately after creating</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} color="success" />
          </div>
        </div>

        <DialogFooter className="p-6 pt-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="gap-1.5">
            <Sparkles className="h-4 w-4" />
            Create Discount
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DiscountForm;
