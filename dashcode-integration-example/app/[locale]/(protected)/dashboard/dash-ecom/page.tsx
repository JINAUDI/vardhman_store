"use client";

import { StatusBlock } from "@/components/blocks/status-block";
import { WelcomeBlock } from "@/components/blocks/welcome-block";
import { AlertTriangle, Box, DollarSign, ShoppingCart, TrendingUp, Users, ArrowUpRight, ArrowDownRight } from "lucide-react";
import Image from "next/image";
import RevinueBarChart from "@/components/revenue-bar-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardDropdown from "@/components/dashboard-dropdown";
import OrdersBlock from "@/components/blocks/orders-block";
import EarningBlock from "@/components/blocks/earning-block";
import Customer from "./components/customer";
import RecentOrderTable from "./components/recent-order-table";
import VisitorsReportChart from "./components/visitors-report";
import VisitorsChart from "./components/visitors-chart";
import MostSales from "./components/most-sales";
import LiveOrderDashboard from "./components/live-order-dashboard";
import { products } from "./components/data";
import Product from "./components/product";
import { Link } from "@/i18n/routing";
import { useAtomValue } from "jotai";
import {
  totalRevenueAtom,
  pendingOrdersCountAtom,
  lowStockCountAtom,
  totalCustomersAtom,
  ordersAtom,
  productsAtom,
} from "@/lib/store/ecommerce-store";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Icon } from "@/components/ui/icon";
import { formatINR } from "@/lib/utils/currency";

// ── Stat Card Component ──────────────────────────────────────
function StatCard({
  title,
  total,
  icon,
  iconBg,
  iconColor,
  href,
  comparison,
  comparisonType = "up",
  tooltipText,
  chartColor,
}: {
  title: string;
  total: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  href: string;
  comparison: string;
  comparisonType?: "up" | "down";
  tooltipText: string;
  chartColor: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href={href} className="block group">
            <Card className="transition-all duration-200 group-hover:shadow-lg group-hover:border-primary/20 cursor-pointer">
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="flex-none">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${iconBg}`}>
                      {icon}
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-default-600 text-sm font-medium">{title}</div>
                    <div className="text-default-900 text-xl font-semibold">{total}</div>
                    <div className="flex items-center gap-1 mt-1">
                      {comparisonType === "up" ? (
                        <ArrowUpRight className="h-3 w-3 text-success" />
                      ) : (
                        <ArrowDownRight className="h-3 w-3 text-destructive" />
                      )}
                      <span className={`text-xs font-medium ${comparisonType === "up" ? "text-success" : "text-destructive"}`}>
                        {comparison}
                      </span>
                      <span className="text-xs text-default-400">vs last month</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Low Stock Alert Card ──────────────────────────────────────
function LowStockCard({ count }: { count: number }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Link href="/ecommerce/backend/inventory" className="block group">
            <Card className={`transition-all duration-200 group-hover:shadow-lg cursor-pointer ${count > 0 ? "border-warning/30 bg-warning/[0.02]" : ""
              }`}>
              <CardContent className="p-4">
                <div className="flex gap-3">
                  <div className="flex-none">
                    <div className="h-12 w-12 rounded-full flex items-center justify-center bg-warning/10">
                      <AlertTriangle className="w-5 h-5 text-warning" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="text-default-600 text-sm font-medium">Low Stock Alerts</div>
                    <div className="text-default-900 text-xl font-semibold">{count}</div>
                    <div className="flex items-center gap-1 mt-1">
                      {count > 0 ? (
                        <>
                          <span className="text-xs text-warning font-medium">
                            {count} products need attention
                          </span>
                        </>
                      ) : (
                        <span className="text-xs text-success font-medium">All stock levels healthy</span>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">Products below their threshold. Click to manage inventory.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Main Dashboard Page ──────────────────────────────────────
const EcommercePage = () => {
  const totalRevenue = useAtomValue(totalRevenueAtom);
  const pendingOrders = useAtomValue(pendingOrdersCountAtom);
  const lowStockCount = useAtomValue(lowStockCountAtom);
  const totalCustomers = useAtomValue(totalCustomersAtom);
  const allOrders = useAtomValue(ordersAtom);
  const allProducts = useAtomValue(productsAtom);

  const totalOrdersCount = allOrders.length;
  const deliveredCount = allOrders.filter((o) => o.status === "delivered").length;

  return (
    <div className="space-y-5">
      {/* ── Welcome + Stat Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
        <WelcomeBlock>
          <div className="max-w-[180px] relative z-10">
            <h4 className="text-xl font-medium text-primary-foreground dark:text-default-900 mb-2">
              <span className="block font-normal">Good Morning 👋</span>
              <span className="block">Mr. Dianne Russell</span>
            </h4>
            <p className="text-sm text-primary-foreground dark:text-default-900 font-normal">
              Here&apos;s what&apos;s happening with your store today.
            </p>
          </div>
          <Image
            src="/images/all-img/widget-bg-2.png"
            width={400}
            height={150}
            priority
            alt="Welcome banner"
            className="absolute top-0 start-0 w-full h-full object-cover rounded-md"
          />
        </WelcomeBlock>

        <StatCard
          title="Total Revenue"
          total={formatINR(totalRevenue, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
          icon={<DollarSign className="w-5 h-5 text-success" />}
          iconBg="bg-success/10"
          iconColor="text-success"
          href="/ecommerce/backend/analytics"
          comparison="+12.5%"
          comparisonType="up"
          tooltipText="Total revenue from paid orders. Click to view analytics."
          chartColor="#22c55e"
        />

        <StatCard
          title="Total Orders"
          total={totalOrdersCount.toString()}
          icon={<ShoppingCart className="w-5 h-5 text-info" />}
          iconBg="bg-info/10"
          iconColor="text-info"
          href="/ecommerce/backend/order-list"
          comparison="+8.2%"
          comparisonType="up"
          tooltipText={`${pendingOrders} pending, ${deliveredCount} delivered. Click to manage orders.`}
          chartColor="#00EBFF"
        />

        <StatCard
          title="Customers"
          total={totalCustomers.toString()}
          icon={<Users className="w-5 h-5 text-primary" />}
          iconBg="bg-primary/10"
          iconColor="text-primary"
          href="/ecommerce/backend/customer-list"
          comparison="+5.3%"
          comparisonType="up"
          tooltipText="Total registered customers. Click to view customer list."
          chartColor="#2563eb"
        />

        <LowStockCard count={lowStockCount} />
      </div>

      <LiveOrderDashboard />

      {/* ── Revenue Chart + Statistics ── */}
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <Card>
            <CardContent className="pt-5">
              <RevinueBarChart height={420} />
            </CardContent>
          </Card>
        </div>
        <div className="col-span-12 lg:col-span-4">
          <Card>
            <CardHeader className="flex flex-row items-center gap-1">
              <CardTitle className="flex-1">Statistics</CardTitle>
              <DashboardDropdown />
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-5">
                <div className="col-span-2 md:col-span-1">
                  <OrdersBlock
                    title="Orders"
                    total={`${pendingOrders}`}
                    chartColor="#f1595c"
                    className="border-none shadow-none bg-default-50"
                  />
                </div>
                <div className="col-span-2 md:col-span-1">
                  <OrdersBlock
                    title="Profit"
                    total={formatINR(Math.round(totalRevenue * 0.22))}
                    chartColor="#4669fa"
                    chartType="line"
                    percentageContent={
                      <span className="text-primary">+2.5%</span>
                    }
                    className="border-none shadow-none bg-default-50 col-span-2 md:col-span-1"
                  />
                </div>
                <div className="col-span-2">
                  <EarningBlock
                    title="Earnings"
                    total={formatINR(Math.round(totalRevenue * 0.82), {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                    percentage="+08%"
                    className="col-span-2 border-none shadow-none bg-default-50"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Customers + Recent Orders ── */}
      <div className="grid lg:grid-cols-2 grid-cols-1 gap-5">
        <Card>
          <CardHeader className="flex flex-row items-center gap-1">
            <CardTitle className="flex-1">Customer</CardTitle>
            <DashboardDropdown />
          </CardHeader>
          <CardContent>
            <Customer />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-1">
            <CardTitle className="flex-1">
              Recent Orders
            </CardTitle>
            <DashboardDropdown />
          </CardHeader>
          <CardContent className="px-0">
            <RecentOrderTable />
          </CardContent>
        </Card>
      </div>

      {/* ── Visitors ── */}
      <div className="grid grid-cols-12 gap-5">
        <div className="lg:col-span-8 col-span-12">
          <Card>
            <CardHeader className="flex flex-row items-center gap-1">
              <CardTitle className="flex-1">Visitors Report</CardTitle>
              <DashboardDropdown />
            </CardHeader>
            <CardContent>
              <VisitorsReportChart height={350} />
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-4 col-span-12">
          <Card>
            <CardHeader className="flex flex-row items-center gap-1">
              <CardTitle className="flex-1">
                Visitors by Gender
              </CardTitle>
              <DashboardDropdown />
            </CardHeader>
            <CardContent>
              <VisitorsChart />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Sales + Products ── */}
      <div className="grid lg:grid-cols-2 grid-cols-1 gap-5">
        <MostSales />
        <Card>
          <CardHeader className="flex flex-row items-center gap-1">
            <CardTitle className="flex-1">
              Best Selling Products
            </CardTitle>
            <DashboardDropdown />
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 grid-cols-1 gap-5">
              {products.map((product, index) => (
                <Product key={index} product={product} />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EcommercePage;
