"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { customersAtom } from "@/lib/store/ecommerce-store";
import type { Customer as StoreCustomer } from "@/lib/store/types";
import { formatINR } from "@/lib/utils/currency";
import { useAtomValue } from "jotai";
import { Users } from "lucide-react";

const styles = [
  { bg: "before:bg-info/30", barColor: "info" },
  { bg: "before:bg-warning/30", barColor: "warning" },
  { bg: "before:bg-success/30", barColor: "success" },
] as const;

function initials(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "C"
  );
}

function getActivityScore(customer: StoreCustomer) {
  return Math.min(100, Math.max(0, Math.round((customer.totalOrders || 0) * 10)));
}

const CustomerList = ({ item, index }: { item: StoreCustomer; index: number }) => {
  const value = getActivityScore(item);
  const style = styles[index % styles.length];

  return (
    <div className="relative p-4 rounded md:flex items-center md:space-x-10 md:space-y-0 space-y-3 rtl:space-x-reverse">
      <div className="h-10 w-10 rounded-full relative">
        <Avatar className="h-10 w-10">
          <AvatarImage src={item.avatar} alt={item.name} />
          <AvatarFallback>{initials(item.name)}</AvatarFallback>
        </Avatar>
        <span className="h-4 w-4 absolute right-0 bottom-0 rounded-full bg-[#FFC155] border border-white flex flex-col items-center justify-center text-white text-[10px] font-medium">
          {index + 4}
        </span>
      </div>
      <h4 className="text-sm text-default-600 font-semibold">{item.name}</h4>
      <div className="inline-block text-center bg-default-900 text-default-100 px-2.5 py-1.5 text-xs font-medium rounded-full min-w-[60px]">
        {item.totalOrders}
      </div>
      <div className="flex-1">
        <div className="flex justify-between text-sm font-normal mb-3">
          <span>Activity</span>
          <span className="font-normal">{value}%</span>
        </div>
        <Progress value={value} color={style.barColor} size="sm" />
      </div>
    </div>
  );
};

const CustomerCard = ({ item, index }: { item: StoreCustomer; index: number }) => {
  const value = getActivityScore(item);
  const style = styles[index % styles.length];

  return (
    <div
      className={`relative z-1 text-center p-4 rounded before:w-full before:h-[calc(100%-60px)] before:absolute before:left-0 before:top-[60px] before:rounded before:z-[-1] ${style.bg}`}
    >
      <div className="h-[70px] w-[70px] rounded-full mx-auto mb-4 relative">
        <Avatar className="h-[70px] w-[70px]">
          <AvatarImage src={item.avatar} alt={item.name} />
          <AvatarFallback>{initials(item.name)}</AvatarFallback>
        </Avatar>
        <span className="h-[27px] w-[27px] absolute right-0 bottom-0 rounded-full bg-[#FFC155] border border-white flex flex-col items-center justify-center text-white text-xs font-medium">
          {index + 1}
        </span>
      </div>
      <h4 className="text-sm text-default-600 font-semibold mb-4">{item.name}</h4>
      <div className="inline-block bg-default-900 text-default-100 px-2.5 py-1.5 text-xs font-medium rounded-full min-w-[60px]">
        {formatINR(item.totalSpend)}
      </div>
      <div>
        <div className="flex justify-between text-sm font-normal mb-3 mt-4">
          <span>Activity</span>
          <span className="font-normal">{value}%</span>
        </div>
        <Progress value={value} color={style.barColor} size="sm" />
      </div>
    </div>
  );
};

const Customer = () => {
  const customers = useAtomValue(customersAtom);
  const rankedCustomers = [...customers]
    .sort((a, b) => b.totalSpend - a.totalSpend || b.totalOrders - a.totalOrders)
    .slice(0, 6);

  if (rankedCustomers.length === 0) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center rounded-md border border-dashed border-default-300 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-default-100">
          <Users className="h-5 w-5 text-default-500" />
        </div>
        <h4 className="text-sm font-semibold text-default-900">No real customers yet</h4>
        <p className="mt-1 max-w-[280px] text-sm text-default-500">
          Customers will appear here after orders or customer accounts sync from Supabase.
        </p>
      </div>
    );
  }

  return (
    <div className="pb-2">
      <div className="grid md:grid-cols-3 grid-cols-1 gap-5">
        {rankedCustomers.slice(0, 3).map((item, i) => (
          <CustomerCard item={item} index={i} key={item.id} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-5 mt-5">
        {rankedCustomers.slice(3, 6).map((item, i) => (
          <CustomerList item={item} index={i} key={item.id} />
        ))}
      </div>
    </div>
  );
};

export default Customer;
