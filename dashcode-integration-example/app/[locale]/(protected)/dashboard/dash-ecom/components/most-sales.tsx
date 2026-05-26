"use client";

import IndiaClaimedMap from "@/components/maps/india-claimed-map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatInrAmount, useIndiaStateSales } from "@/hooks/use-india-state-sales";
import { getIndiaStateSalesFill } from "@/lib/analytics/india-state-sales";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useState } from "react";

const MostSales = () => {
  const [filterMap, setFilterMap] = useState("india");
  const { data: stateSales, error, isLoading } = useIndiaStateSales();
  const t = useTranslations("EcommerceDashboard");

  return (
    <Card>
      <CardHeader className="flex flex-row items-center">
        <CardTitle className="flex-1">{t("most_sales_map_title")}</CardTitle>
        <div className="border border-default-200 dark:border-default-300 rounded p-1 flex items-center bg-background">
          <span
            className={cn(
              "flex-1 text-sm font-normal px-3 py-1 transition-all duration-150 rounded cursor-pointer",
              {
                "bg-default-900 text-primary-foreground": filterMap === "india",
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
                "bg-default-900 text-primary-foreground": filterMap === "states",
              }
            )}
            onClick={() => setFilterMap("states")}
          >
            States
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <IndiaClaimedMap
          states={stateSales.states}
          maxStateRevenue={stateSales.maxStateRevenue}
          className="dashcode-app-vmap h-[280px] w-full"
        />
        <ul className="bg-default-50 rounded p-4 min-w-[184px] mt-8 flex justify-between flex-wrap items-center text-center">
          {isLoading ? (
            <li className="text-sm text-default-600">Loading state sales...</li>
          ) : error ? (
            <li className="text-sm text-destructive">{error}</li>
          ) : stateSales.topStates.length ? (
            stateSales.topStates.map((item) => {
              const fill = getIndiaStateSalesFill(item.total, stateSales.maxStateRevenue);

              return (
                <li
                  key={item.code}
                  className="text-sm text-default-600"
                  title={`${item.orderCount} orders, ${item.percentage}% of sales`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-flex h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor: fill,
                        boxShadow: `0 0 0 4px ${fill}33`,
                      }}
                    />
                    <span>{item.name}</span>
                  </div>
                  <div className="block mt-1">{formatInrAmount(item.total, true)}</div>
                </li>
              );
            })
          ) : (
            <li className="text-sm text-default-600">No state sales yet</li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
};

export default MostSales;
