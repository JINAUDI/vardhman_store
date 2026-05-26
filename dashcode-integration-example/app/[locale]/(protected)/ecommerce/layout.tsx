import { Metadata } from "next";
import EcommerceSupabaseSync from "@/components/ecommarce/ecommerce-supabase-sync";

export const metadata: Metadata = {
  title: "Dashcode Next Js",
  description: "Dashcode is a popular dashboard template.",
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <EcommerceSupabaseSync />
      {children}
    </>
  );
};

export default Layout;
