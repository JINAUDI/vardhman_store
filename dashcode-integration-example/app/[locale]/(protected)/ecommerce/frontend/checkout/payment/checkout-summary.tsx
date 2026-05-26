"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupButton } from "@/components/ui/input-group";
import { Input } from "@/components/ui/input";
import { formatINR } from "@/lib/utils/currency";
import type { CartLineLike, ProductLike } from "@/lib/commerce/merchandising";

type DiscountResult = {
  coupon?: {
    code: string;
    discountCategory: string;
  };
  discountAmount: number;
  shippingDiscountAmount: number;
  subtotal: number;
  total: number;
  message?: string;
};

type CheckoutSummaryProps = {
  productName: string;
  cartLines: CartLineLike[];
  products: ProductLike[];
};

async function calculateDiscount(
  cartLines: CartLineLike[],
  products: ProductLike[],
  code?: string
) {
  const response = await fetch("/api/checkout/discounts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cartLines, products, code }),
  });
  const payload = await response.json().catch(() => null);
  return payload?.data as DiscountResult | undefined;
}

const CheckoutSummary = ({ productName, cartLines, products }: CheckoutSummaryProps) => {
  const [code, setCode] = useState("");
  const [discount, setDiscount] = useState<DiscountResult | null>(null);
  const [message, setMessage] = useState("");
  const [isApplying, setIsApplying] = useState(false);

  const subtotal = useMemo(
    () => cartLines.reduce((sum, line) => sum + line.price * line.quantity, 0),
    [cartLines]
  );
  const total = discount?.total ?? subtotal;
  const discountAmount = discount?.discountAmount ?? 0;
  const appliedCode = discount?.coupon?.code;

  useEffect(() => {
    let cancelled = false;

    const applyAutomaticDiscount = async () => {
      const result = await calculateDiscount(cartLines, products);
      if (cancelled) return;
      setDiscount(result ?? null);
      setMessage(
        result?.coupon
          ? `${result.coupon.code} applied automatically.`
          : ""
      );
    };

    void applyAutomaticDiscount();

    return () => {
      cancelled = true;
    };
  }, [cartLines, products]);

  const handleApplyCode = async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode) {
      setMessage("Enter a coupon code.");
      return;
    }

    setIsApplying(true);
    try {
      const result = await calculateDiscount(cartLines, products, trimmedCode);
      setDiscount(result ?? null);
      setMessage(
        result?.coupon
          ? `${result.coupon.code} applied.`
          : result?.message || "Coupon code is invalid or not applicable to this cart."
      );
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div>
      <ul className="divide-y divide-default-300 pb-8">
        <li className="text-xs pb-3">
          <div className="flex justify-between">
            <p>Product</p>
            <p>Total</p>
          </div>
        </li>
        <li className="text-sm text-default-600 py-2">
          <div className="flex justify-between gap-3 pb-1">
            <p>
              {productName}
              <span className="text-default-800 font-medium px-2">x</span>
              <span className="text-default-800 font-medium">
                {cartLines[0]?.quantity ?? 0}
              </span>
            </p>
            <p className="text-default-800 font-medium">{formatINR(subtotal)}</p>
          </div>
        </li>

        {discountAmount > 0 && (
          <li className="text-xs py-2">
            <div className="flex justify-between gap-3">
              <p className="text-default-900 font-medium">
                Discount{appliedCode ? ` (${appliedCode})` : ""}
              </p>
              <p className="text-success font-medium">-{formatINR(discountAmount)}</p>
            </div>
          </li>
        )}

        <li className="text-xs py-2">
          <div className="flex justify-between gap-3">
            <p className="text-default-900 font-medium">Total</p>
            <p className="text-default-800 font-medium">{formatINR(total)}</p>
          </div>
        </li>
      </ul>

      <InputGroup>
        <Input
          type="text"
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleApplyCode();
            }
          }}
          placeholder="Have coupon code? Apply here"
        />
        <InputGroupButton>
          <Button size="md" type="button" disabled={isApplying} onClick={() => void handleApplyCode()}>
            {isApplying ? "Applying" : "Apply"}
          </Button>
        </InputGroupButton>
      </InputGroup>

      {message && <p className="mt-2 text-xs text-default-500">{message}</p>}
    </div>
  );
};

export default CheckoutSummary;
