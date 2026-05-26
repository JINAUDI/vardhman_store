"use client";
import { redirect } from "@/components/navigation";
const Backend = () => {
  redirect({ href: '/ecommerce/backend/add-product', locale: 'en' })
  return null;
};

export default Backend;
