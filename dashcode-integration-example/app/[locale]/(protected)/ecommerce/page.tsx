"use client";
import { redirect } from "@/components/navigation";
const Backend = () => {
  redirect({ href: '/ecommerce/frontend', locale: 'en' })
  return null;
};

export default Backend;
