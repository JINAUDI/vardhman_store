"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductDraft } from "@/lib/store/types";
import { Truck, RotateCcw } from "lucide-react";

interface ShippingFormProps {
  draft: ProductDraft;
  onUpdate: (updates: Partial<ProductDraft>) => void;
}

const ShippingForm: React.FC<ShippingFormProps> = ({ draft, onUpdate }) => {
  return (
    <div className="space-y-4">
      {/* Processing Time */}
      <Card>
        <CardHeader className="border-b border-default-200 mb-4">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-default-500" />
            <CardTitle className="text-lg">Delivery</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label className="w-[150px] shrink-0 text-sm font-medium">
              Processing time
            </Label>
            <Select
              value={draft.processingTime}
              onValueChange={(v) => onUpdate({ processingTime: v })}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1 business day">1 business day</SelectItem>
                <SelectItem value="1-2 business days">
                  1-2 business days
                </SelectItem>
                <SelectItem value="1-3 business days">
                  1-3 business days
                </SelectItem>
                <SelectItem value="3-5 business days">
                  3-5 business days
                </SelectItem>
                <SelectItem value="1-2 weeks">1-2 weeks</SelectItem>
                <SelectItem value="2-3 weeks">2-3 weeks</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Shipping Options */}
          <div className="space-y-3 pt-2">
            <Label className="text-sm font-medium">Shipping options</Label>

            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-default-50 border border-default-200">
              <div>
                <p className="text-sm font-medium text-default-900">
                  Free shipping
                </p>
                <p className="text-xs text-default-500">
                  No shipping cost for customers
                </p>
              </div>
              <Switch
                checked={draft.freeShipping}
                onCheckedChange={(checked) =>
                  onUpdate({ freeShipping: checked })
                }
                color="success"
              />
            </div>

            {!draft.freeShipping && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm">Standard shipping</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={draft.standardShipping || ""}
                      onChange={(e) =>
                        onUpdate({
                          standardShipping:
                            parseFloat(e.target.value) || undefined,
                        })
                      }
                      placeholder="99.00"
                      className="pl-7"
                      step="0.01"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-default-400">
                      Rs
                    </span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Express shipping</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      value={draft.expressShipping || ""}
                      onChange={(e) =>
                        onUpdate({
                          expressShipping:
                            parseFloat(e.target.value) || undefined,
                        })
                      }
                      placeholder="199.00"
                      className="pl-7"
                      step="0.01"
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-default-400">
                      Rs
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Return Policy */}
      <Card>
        <CardHeader className="border-b border-default-200 mb-4">
          <div className="flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-default-500" />
            <CardTitle className="text-lg">Return Policy</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Label className="w-[150px] shrink-0 text-sm font-medium">
              Return window
            </Label>
            <Select
              value={draft.returnPolicy}
              onValueChange={(v) =>
                onUpdate({
                  returnPolicy: v as ProductDraft["returnPolicy"],
                })
              }
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="30_days">30 days</SelectItem>
                <SelectItem value="14_days">14 days</SelectItem>
                <SelectItem value="no_returns">No returns</SelectItem>
                <SelectItem value="custom">Custom policy</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {draft.returnPolicy === "custom" && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Custom return policy</Label>
              <Textarea
                value={draft.customReturnPolicy || ""}
                onChange={(e) =>
                  onUpdate({ customReturnPolicy: e.target.value })
                }
                placeholder="Describe your return policy..."
                className="min-h-[80px]"
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ShippingForm;
