"use client";

import React from "react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import type { DiscountCategory } from "@/lib/store/types";
import { Tag, ShoppingCart, Percent, Truck } from "lucide-react";

type DiscountOption = {
  type: DiscountCategory;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
};

const discountOptions: DiscountOption[] = [
  {
    type: "product_discount",
    label: "Amount off products",
    description:
      "Discount specific products or collections with a percentage or fixed amount.",
    icon: <Tag className="h-6 w-6" />,
    color: "text-primary bg-primary/10 border-primary/20",
  },
  {
    type: "buy_x_get_y",
    label: "Buy X Get Y",
    description:
      "Offer customers free or discounted products when they buy a set quantity.",
    icon: <ShoppingCart className="h-6 w-6" />,
    color: "text-success bg-success/10 border-success/20",
  },
  {
    type: "order_discount",
    label: "Amount off order",
    description:
      "Discount the entire order with a percentage or fixed amount off the total.",
    icon: <Percent className="h-6 w-6" />,
    color: "text-info bg-info/10 border-info/20",
  },
  {
    type: "free_shipping",
    label: "Free shipping",
    description:
      "Offer free shipping on orders that meet specific conditions or minimums.",
    icon: <Truck className="h-6 w-6" />,
    color: "text-warning bg-warning/10 border-warning/20",
  },
];

interface DiscountTypeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (type: DiscountCategory) => void;
}

const DiscountTypeModal: React.FC<DiscountTypeModalProps> = ({
  open,
  onOpenChange,
  onSelect,
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" className="p-0 gap-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="text-xl">Select discount type</DialogTitle>
          <p className="text-sm text-default-500 mt-1">
            Choose the type of discount you want to create
          </p>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-6 pt-4">
          {discountOptions.map((option) => {
            const colorClasses = option.color.split(" ");
            const textColor = colorClasses[0];
            const bgColor = colorClasses[1];
            const borderColor = colorClasses[2];

            return (
              <Card
                key={option.type}
                className={cn(
                  "cursor-pointer border-2 border-transparent transition-all duration-200 hover:shadow-md group",
                  `hover:${borderColor}`
                )}
                onClick={() => {
                  onSelect(option.type);
                  onOpenChange(false);
                }}
              >
                <CardContent className="p-4 flex gap-4 items-start">
                  <div
                    className={cn(
                      "rounded-lg p-2.5 shrink-0 transition-all duration-200",
                      bgColor,
                      textColor
                    )}
                  >
                    {option.icon}
                  </div>
                  <div className="space-y-1 min-w-0">
                    <h4 className="text-sm font-semibold text-default-900 group-hover:text-primary transition-colors">
                      {option.label}
                    </h4>
                    <p className="text-xs text-default-500 leading-relaxed">
                      {option.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DiscountTypeModal;
export { discountOptions };
