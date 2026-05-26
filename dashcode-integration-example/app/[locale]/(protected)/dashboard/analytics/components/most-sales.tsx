"use client";

import IndiaClaimedMap from "@/components/maps/india-claimed-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInrAmount, useIndiaStateSales } from "@/hooks/use-india-state-sales";
import { getIndiaStateSalesFill } from "@/lib/analytics/india-state-sales";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useState } from "react";

function getGrowthLabel(value: number | null) {
  if (value === null) return "New";
  return `${value >= 0 ? "+" : ""}${Math.round(value)}%`;
}

const MostSales = () => {
  const [filterMap, setFilterMap] = useState("india");
  const { data: stateSales, error, isLoading } = useIndiaStateSales();
  const t = useTranslations("AnalyticsDashboard");
  const topStatesRevenue = stateSales.topStates.reduce((sum, state) => sum + state.total, 0);
  const totalRevenue = filterMap === "states" ? topStatesRevenue : stateSales.totalRevenue;
  const growthLabel = getGrowthLabel(stateSales.monthGrowthPercent);
  const hasOrders = stateSales.orderCount > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center">
        <CardTitle className="flex-1"> {t("most_sales_map_title")}</CardTitle>
        <div className="border border-default-200 dark:border-default-300 rounded p-1 flex items-center bg-background">
          <span
            className={cn(
              "flex-1 text-sm font-normal px-3 py-1 transition-all duration-150 rounded cursor-pointer",
              {
                "bg-default-900 text-primary-foreground dark:bg-default-300 dark:text-foreground ":
                  filterMap === "india",
              }
            )}
            onClick={() => setFilterMap("india")}
          >
            India
          </span>
          <span
            className={cn(
              "flex-1 text-sm font-normal px-3 py-1 transition-all duration-150 rounded cursor-pointer",
              {
                "bg-default-900 text-primary-foreground dark:bg-default-300 dark:text-foreground ":
                  filterMap === "states",
              }
            )}
            onClick={() => setFilterMap("states")}
          >
            States
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="md:flex items-center">
          <div className="flex-none">
            <h4 className="text-default-600 text-sm font-normal mb-1.5">
              {filterMap === "states" ? "Top states revenue" : t("total_earning_map_desc")}
            </h4>
            <div className="text-lg font-medium mb-1.5 text-default-900">
              {isLoading ? "Loading..." : formatInrAmount(totalRevenue)}
            </div>
            <div className="text-xs font-light">
              {hasOrders ? (
                <>
                  <span
                    className={cn(
                      stateSales.monthGrowthPercent !== null && stateSales.monthGrowthPercent < 0
                        ? "text-destructive"
                        : "text-primary"
                    )}
                  >
                    {growthLabel}
                  </span>{" "}
                  {t("total_earning_map_desc_2")}
                </>
              ) : (
                "No paid orders yet"
              )}
            </div>
            <ul className="bg-default-50 rounded p-4 min-w-[184px] space-y-5 mt-4">
              {isLoading ? (
                <li className="text-xs text-default-600">Loading state sales...</li>
              ) : error ? (
                <li className="text-xs text-destructive">{error}</li>
              ) : stateSales.topStates.length ? (
                stateSales.topStates.map((item) => {
                  const fill = getIndiaStateSalesFill(item.total, stateSales.maxStateRevenue);

                  return (
                    <li
                      key={item.code}
                      className="flex justify-between text-xs text-default-600"
                      title={`${item.orderCount} orders, ${item.percentage}% of sales`}
                    >
                      <span className="flex gap-2 items-center">
                        <span
                          className="inline-flex h-1.5 w-1.5 rounded-full"
                          style={{
                            backgroundColor: fill,
                            boxShadow: `0 0 0 4px ${fill}33`,
                          }}
                        />
                        <span>{item.name}</span>
                      </span>
                      <span>{formatInrAmount(item.total, true)}</span>
                    </li>
                  );
                })
              ) : (
                <li className="text-xs text-default-600">No state sales yet</li>
              )}
            </ul>
          </div>
          <div className="flex-1">
            <IndiaClaimedMap
              states={stateSales.states}
              maxStateRevenue={stateSales.maxStateRevenue}
              className="dashcode-app-vmap min-h-[320px]"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MostSales;
