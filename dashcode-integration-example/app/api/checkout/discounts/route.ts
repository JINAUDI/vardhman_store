import { NextRequest, NextResponse } from "next/server";
import { getCheckoutDiscount } from "@/lib/commerce/checkout-discounts";
import type { CartLineLike, ProductLike } from "@/lib/commerce/merchandising";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      cartLines?: CartLineLike[];
      products?: ProductLike[];
      code?: string;
    };

    const cartLines = Array.isArray(body.cartLines) ? body.cartLines : [];
    const products = Array.isArray(body.products) ? body.products : [];
    const discount = await getCheckoutDiscount(cartLines, products, body.code);

    return NextResponse.json(
      {
        status: discount.message ? "fail" : "success",
        message: discount.message || "Discount calculated",
        data: discount,
      },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: "Unable to calculate checkout discount.",
        data: error instanceof Error ? error.message : error,
      },
      { status: 400, headers: CORS_HEADERS }
    );
  }
}
