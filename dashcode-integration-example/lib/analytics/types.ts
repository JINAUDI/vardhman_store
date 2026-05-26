export const analyticsEventNames = [
  "page_view",
  "product_view",
  "add_to_cart",
  "checkout",
  "sale",
  "product_edit_open",
  "product_updated",
  "product_deleted",
  "product_duplicated",
  "product_visibility_toggled",
  "product_view_store",
  "product_filter_applied",
  "product_sort_applied",
  "product_search",
  "low_stock_filter_used",
  "bulk_delete",
  "bulk_export",
  "add_product_clicked",
] as const;

export type AnalyticsEventName = (typeof analyticsEventNames)[number];

export type AnalyticsEvent = {
  event: AnalyticsEventName;
  userId: string;
  sessionId: string;
  timestamp: number;
  metadata: Record<string, unknown>;
};

export type AnalyticsBatchPayload = {
  events: AnalyticsEvent[];
};

export type FunnelStepMetric = {
  step: AnalyticsEventName;
  count: number;
  conversionRate: number;
  dropoffRate: number;
};
