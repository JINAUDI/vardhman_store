import path from "path";
import {
  analyticsEventNames,
  type AnalyticsBatchPayload,
  type AnalyticsEvent,
  type FunnelStepMetric,
} from "@/lib/analytics/types";
import { readJsonStore, writeJsonStore } from "@/lib/server/json-store";

const ANALYTICS_COLLECTION = "analytics_events";
const ANALYTICS_PATH = path.join(
  process.cwd(),
  "data",
  `${ANALYTICS_COLLECTION}.json`
);

const funnelSteps = analyticsEventNames.slice(0, 5);

type AnalyticsStorageAdapter = {
  append: (events: AnalyticsEvent[]) => Promise<AnalyticsEvent[]>;
  list: () => Promise<AnalyticsEvent[]>;
};

const fileAdapter: AnalyticsStorageAdapter = {
  async append(events) {
    const current = await readJsonStore<AnalyticsEvent[]>(ANALYTICS_PATH, []);
    const next = [...current, ...events];
    await writeJsonStore(ANALYTICS_PATH, next);
    return events;
  },
  async list() {
    return readJsonStore<AnalyticsEvent[]>(ANALYTICS_PATH, []);
  },
};

const adapter = fileAdapter;

export async function appendAnalyticsBatch(payload: AnalyticsBatchPayload) {
  return adapter.append(payload.events);
}

export async function listAnalyticsEvents() {
  return adapter.list();
}

export async function getFunnelMetrics(): Promise<FunnelStepMetric[]> {
  const events = await adapter.list();
  const firstStepCount =
    new Set(
      events
        .filter((event) => event.event === funnelSteps[0])
        .map((event) => event.sessionId)
    ).size || 1;

  return funnelSteps.map((step, index) => {
    const stepSessions = new Set(
      events
        .filter((event) => event.event === step)
        .map((event) => event.sessionId)
    );
    const count = stepSessions.size;
    const nextCount =
      index < funnelSteps.length - 1
        ? new Set(
            events
              .filter((event) => event.event === funnelSteps[index + 1])
              .map((event) => event.sessionId)
          ).size
        : count;

    return {
      step,
      count,
      conversionRate: Number(((count / firstStepCount) * 100).toFixed(2)),
      dropoffRate:
        index < funnelSteps.length - 1 && count > 0
          ? Number((((count - nextCount) / count) * 100).toFixed(2))
          : 0,
    };
  });
}

export { ANALYTICS_COLLECTION };
