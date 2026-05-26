import type { StorefrontProduct } from "@/lib/supabase/products";
import {
  getVisibleStorefrontProductById,
  getVisibleStorefrontProducts,
} from "@/lib/supabase/products";

export type product = StorefrontProduct;

export const getProducts = async () => {
  return getVisibleStorefrontProducts();
};

export const getProductById = async (id: string) => {
  return getVisibleStorefrontProductById(id);
};

export const categories = [
  { label: "All", value: "all", count: "9724" },
  { label: "Men", value: "men", count: "1312" },
  { label: "Women", value: "women", count: "3752" },
  { label: "Child", value: "child", count: "985" },
  { label: "Baby", value: "baby", count: "745" },
  { label: "Footwear", value: "footwear", count: "1280" },
  { label: "Furniture", value: "furniture", count: "820" },
  { label: "Mobile", value: "mobile", count: "2460" },
];
export type category = (typeof categories)[number];

export const brands = [
  { label: "Apple", value: "apple", count: "9724" },
  { label: "Apex", value: "apex", count: "1312" },
  { label: "Easy", value: "easy", count: "3752" },
  { label: "Pixel", value: "pixel", count: "985" },
  { label: "Samsung", value: "samsung", count: "2460" },
];
export type brand = (typeof brands)[number];

export const prices = [
  {
    label: "Rs 0 - Rs 199",
    value: {
      min: 0,
      max: 199,
    },
    count: "9724",
  },
  {
    label: "Rs 200 - Rs 449",
    value: {
      min: 200,
      max: 499,
    },
    count: "1312",
  },
  {
    label: "Rs 450 - Rs 599",
    value: {
      min: 450,
      max: 599,
    },
    count: "3752",
  },
  {
    label: "Rs 600 - Rs 799",
    value: {
      min: 600,
      max: 799,
    },
    count: "985",
  },
  {
    label: "Rs 800 & Above",
    value: {
      min: 800,
      max: 1000,
    },
    count: "745",
  },
];
export type price = (typeof prices)[number];

export const ratings = [
  { name: 5, value: 5, count: "9724" },
  { name: 4, value: 4, count: "1312" },
  { name: 3, value: 3, count: "3752" },
  { name: 2, value: 2, count: "985" },
  { name: 1, value: 1, count: "2460" },
];
export type rating = (typeof ratings)[number];

export const selectOptions = [
  {
    value: "option1",
    label: "Option 1",
  },
  {
    value: "option2",
    label: "Option 2",
  },
  {
    value: "option3",
    label: "Option 3",
  },
];
export type selectOption = (typeof selectOptions)[number];

export const selectCategories = [
  {
    value: "option1",
    label: "Top Rated",
  },
  {
    value: "option2",
    label: "Option 2",
  },
  {
    value: "option3",
    label: "Option 3",
  },
];
export type selectCategory = (typeof selectCategories)[number];

export const payments = [
  {
    img: "/images/e-commerce/cart-icon/bkash.png",
    value: "bkash",
  },
  {
    img: "/images/e-commerce/cart-icon/fatoorah.png",
    value: "fatoorah",
  },
  {
    img: "/images/e-commerce/cart-icon/iyzco.png",
    value: "instamojo",
  },
  {
    img: "/images/e-commerce/cart-icon/iyzco.png",
    value: "iyzco",
  },
  {
    img: "/images/e-commerce/cart-icon/nagad.png",
    value: "nagad",
  },
  {
    img: "/images/e-commerce/cart-icon/ngenious.png",
    value: "ngenious",
  },
  {
    img: "/images/e-commerce/cart-icon/payfast.png",
    value: "payfast",
  },
  {
    img: "/images/e-commerce/cart-icon/payku.png",
    value: "payku",
  },
  {
    img: "/images/e-commerce/cart-icon/paypal.png",
    value: "paypal",
  },
  {
    img: "/images/e-commerce/cart-icon/paytm.png",
    value: "paytm",
  },
  {
    img: "/images/e-commerce/cart-icon/razorpay.png",
    value: "razorpay",
  },
  {
    img: "/images/e-commerce/cart-icon/ssl.png",
    value: "ssl",
  },
  {
    img: "/images/e-commerce/cart-icon/stripe.png",
    value: "stripe",
  },
  {
    img: "/images/e-commerce/cart-icon/truck.png",
    value: "truck",
  },
  {
    img: "/images/e-commerce/cart-icon/vougepay.png",
    value: "vougepay",
  },
];
export type payment = (typeof payments)[number];

export type EcommerceNav = {
  label: string;
  href: string;
  active: boolean;
  icon: string;
};

export function getEcommerceNav(pathname: string): EcommerceNav[] {
  return [
    {
      label: "grid view",
      href: "/ecommerce/frontend",
      icon: "heroicons:view-columns",
      active: pathname === "/ecommerce/frontend",
    },
    {
      label: "list view",
      href: "/ecommerce/frontend/list",
      icon: "heroicons:list-bullet",
      active: pathname === "/ecommerce/frontend/list",
    },
  ];
}
