import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inventory Management",
};

const InventoryLayout = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

export default InventoryLayout;
