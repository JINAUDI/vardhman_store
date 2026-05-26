import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  analyticsEventNames,
  type AnalyticsEventName,
} from "@/lib/analytics/types";
import {
  ANALYTICS_COLLECTION,
  appendAnalyticsBatch,
  getFunnelMetrics,
  listAnalyticsEvents,
} from "@/lib/server/analytics-data";

const analyticsEventSchema = z.object({
  event: z.enum(analyticsEventNames as unknown as [AnalyticsEventName, ...AnalyticsEventName[]]),
  userId: z.string(),
  sessionId: z.string(),
  timestamp: z.number(),
  metadata: z.record(z.unknown()),
});

const analyticsBatchSchema = z.object({
  events: z.array(analyticsEventSchema).min(1),
});

export async function GET() {
  try {
    const [events, funnel] = await Promise.all([
      listAnalyticsEvents(),
      getFunnelMetrics(),
    ]);

    return NextResponse.json({
      status: "success",
      collection: ANALYTICS_COLLECTION,
      data: {
        events,
        funnel,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: "Unable to load analytics events",
        data: error,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const payload = analyticsBatchSchema.parse(body);
    const created = await appendAnalyticsBatch(payload);

    return NextResponse.json({
      status: "success",
      message: "Analytics events stored successfully",
      collection: ANALYTICS_COLLECTION,
      data: created,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "fail",
        message: "Unable to store analytics events",
        data: error,
      },
      { status: 400 }
    );
  }
}
