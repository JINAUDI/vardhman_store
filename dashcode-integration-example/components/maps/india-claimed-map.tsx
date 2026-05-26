"use client";

import { cn } from "@/lib/utils";
import { INDIA_CLAIMED_SVG_MAP } from "./india-claimed-map-data";
import {
  getIndiaStateSalesFill,
  type IndiaStateSalesItem,
} from "@/lib/analytics/india-state-sales";

type IndiaClaimedMapProps = {
  states?: IndiaStateSalesItem[];
  maxStateRevenue?: number;
  className?: string;
};

const indiaClaimedSvgMarkup = INDIA_CLAIMED_SVG_MAP.replace(
  /^<\?xml[^>]*\?>/,
  ""
).replace(
  "<svg",
  '<svg viewBox="0 0 611.85999 695.70178" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false"'
);

const IndiaClaimedMap = ({
  states = [],
  maxStateRevenue = 0,
  className,
}: IndiaClaimedMapProps) => {
  const stateFillRules = states
    .filter((state) => state.total > 0)
    .map(
      (state) => `
        .india-claimed-map #${state.code} {
          fill: ${getIndiaStateSalesFill(state.total, maxStateRevenue)} !important;
        }
      `
    )
    .join("\n");

  return (
    <div
      aria-label="India sales map"
      className={cn("india-claimed-map h-full w-full", className)}
      role="img"
    >
      <div
        className="h-full w-full"
        dangerouslySetInnerHTML={{ __html: indiaClaimedSvgMarkup }}
      />
      <style jsx>{`
        .india-claimed-map :global(svg) {
          display: block;
          height: 100%;
          overflow: visible;
          width: 100%;
        }

        .india-claimed-map :global(path) {
          fill: #6794dc !important;
          stroke: hsl(var(--card)) !important;
          stroke-width: 0.8;
          transition: fill 150ms ease;
          vector-effect: non-scaling-stroke;
        }

        .india-claimed-map :global(path:hover) {
          fill: hsl(var(--primary)) !important;
        }
      `}</style>
      <style>{stateFillRules}</style>
    </div>
  );
};

export default IndiaClaimedMap;
