import React from "react";
import { Button } from "@/components/ui/button";
import { Link } from '@/i18n/routing';
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import PaymentCard from "./payment-card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { getProducts } from "../../data";
import CheckoutSummary from "./checkout-summary";

const page = async () => {
  const products = await getProducts();
  const primaryProduct = products[0];
  const cartLines = primaryProduct
    ? [{ productId: primaryProduct.id, quantity: 2, price: primaryProduct.price }]
    : [];
  const discountProducts = products.map((product) => ({
    id: product.id,
    name: product.name,
    price: product.price,
    category: product.category,
    sku: product.sku,
    stock: product.stock,
    tags: [],
  }));

  return (
    <div className="card  rounded-sm p-5">
      <div className="grid grid-cols-12 gap-5">
        <div className="lg:col-span-7 col-span-12">
          <h3 className="text-default-900  font-medium  text-base  pb-3">
            Select a Payment Option
          </h3>
          <Card className="card border border-solid border-default-400  rounded-sm p-5">
            <div className="space-x-5 rtl:space-x-reverse">
              <PaymentCard />
            </div>
          </Card>
          <div className="flex items-center mt-3 space-x-2 rtl:space-x-reverse">
            <div className="text-base text-default-500 flex items-center">
              <Checkbox />
              <Label className="ps-2">
                <span>I agree to the</span>
                <span className="text-default-900 font-medium ps-2">
                  terms and conditions, Return Policy & Privacy Policy
                </span>
              </Label>
            </div>
          </div>
        </div>
        <div className="lg:col-span-5 col-span-12">
          <h3 className="text-default-900  font-medium  text-base  pb-3">
            Summary
          </h3>
          <div className="card border border-solid border-default-400 rounded-sm p-4">
            <CheckoutSummary
              productName={primaryProduct?.name || "Cart item"}
              cartLines={cartLines}
              products={discountProducts}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 md:mt-16 md:pb-14">
        <div className="flex-1">
          <Button asChild variant="outline">
            <Link href="/ecommerce/frontend">
              <Icon icon="ion:arrow-back-outline" className="me-1" />
              Add New Product
            </Link>
          </Button>
        </div>
        <div className="flex-none">
          <Button asChild disabled>
            <Link href="/ecommerce/frontend/checkout/delivery-info">
              Go Back
            </Link>
          </Button>
        </div>
        <div className="flex-none">
          <Button asChild>
            <Link href="/ecommerce/frontend/checkout/confirmation">Submit</Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default page;
