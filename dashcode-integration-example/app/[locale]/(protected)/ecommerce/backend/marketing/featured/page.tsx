"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useAtom } from "jotai";
import { productsAtom } from "@/lib/store/ecommerce-store";
import { toggleFeatured } from "@/lib/store/actions";
import { Star } from "lucide-react";
import { formatINR } from "@/lib/utils/currency";

const FeaturedPage = () => {
  const [products, setProducts] = useAtom(productsAtom);
  const featured = products.filter((p) => p.featured);
  const notFeatured = products.filter((p) => !p.featured).slice(0, 20);

  const handleToggle = (id: string) => {
    setProducts((prev) => toggleFeatured(prev, id));
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold text-default-900">Featured Products</h2>
        <p className="text-sm text-default-500 mt-1">Select products to feature on the storefront</p>
      </div>

      {/* Featured */}
      <div>
        <h3 className="text-sm font-medium text-default-700 mb-3">Currently Featured ({featured.length})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {featured.map((product) => (
            <Card key={product.id} className="group hover:shadow-md transition-all border-primary/20 bg-primary/[0.02]">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded bg-default-100 flex items-center justify-center shrink-0">
                    <img src={product.images[0]} alt={product.name} className="h-9 w-9 object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-default-800 truncate">{product.name}</h4>
                    <p className="text-xs text-default-400">{formatINR(product.price, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <button className="cursor-pointer shrink-0" onClick={() => handleToggle(product.id)}>
                    <Star className="h-5 w-5 fill-warning text-warning" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Available */}
      <div>
        <h3 className="text-sm font-medium text-default-700 mb-3">Available Products</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {notFeatured.map((product) => (
            <Card key={product.id} className="group hover:shadow-md transition-all">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 rounded bg-default-100 flex items-center justify-center shrink-0">
                    <img src={product.images[0]} alt={product.name} className="h-9 w-9 object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-default-800 truncate">{product.name}</h4>
                    <p className="text-xs text-default-400">{formatINR(product.price, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                  </div>
                  <button className="cursor-pointer shrink-0" onClick={() => handleToggle(product.id)}>
                    <Star className="h-5 w-5 text-default-300 hover:text-warning transition-colors" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeaturedPage;
