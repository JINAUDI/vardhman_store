"use client";

import type { AnalyticsEvent, AnalyticsEventName } from "@/lib/analytics/types";

const SESSION_KEY = "radios_admin_analytics_session";
const FLUSH_INTERVAL = 2500;
const MAX_BATCH_SIZE = 10;

class AnalyticsTracker {
  private queue: AnalyticsEvent[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isFlushing = false;
  private retryCount = 0;
  private hasBoundUnload = false;

  track(event: AnalyticsEventName, metadata: Record<string, unknown> = {}) {
    if (typeof window === "undefined") return;

    this.bindUnloadHandlers();

    this.queue.push({
      event,
      userId: this.resolveUserId(metadata),
      sessionId: this.getSessionId(),
      timestamp: Date.now(),
      metadata,
    });

    if (this.queue.length >= MAX_BATCH_SIZE) {
      void this.flush();
      return;
    }

    this.scheduleFlush();
  }

  async flush() {
    if (this.isFlushing || this.queue.length === 0 || typeof window === "undefined") {
      return;
    }

    this.isFlushing = true;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    const batch = this.queue.splice(0, MAX_BATCH_SIZE);

    try {
      const response = await fetch("/api/analytics", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ events: batch }),
        keepalive: true,
      });

      if (!response.ok) {
        throw new Error(`Analytics flush failed with status ${response.status}`);
      }

      this.retryCount = 0;
    } catch {
      this.queue = [...batch, ...this.queue];
      this.retryCount = Math.min(this.retryCount + 1, 5);
      this.scheduleFlush(FLUSH_INTERVAL * this.retryCount);
    } finally {
      this.isFlushing = false;
      if (this.queue.length > 0 && !this.flushTimer) {
        this.scheduleFlush();
      }
    }
  }

  private scheduleFlush(delay = FLUSH_INTERVAL) {
    if (this.flushTimer) return;

    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      void this.flush();
    }, delay);
  }

  private getSessionId() {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;

    const nextSessionId = `sess_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 10)}`;
    window.localStorage.setItem(SESSION_KEY, nextSessionId);
    return nextSessionId;
  }

  private resolveUserId(metadata: Record<string, unknown>) {
    const directUserId = metadata.userId;
    if (typeof directUserId === "string" && directUserId.length > 0) {
      return directUserId;
    }

    try {
      const storedAuth = window.localStorage.getItem("ecom_auth_user");
      if (!storedAuth) return "anonymous";
      const parsed = JSON.parse(storedAuth) as { id?: string };
      return parsed.id || "anonymous";
    } catch {
      return "anonymous";
    }
  }

  private bindUnloadHandlers() {
    if (this.hasBoundUnload) return;

    const flushOnExit = () => {
      if (this.queue.length === 0) return;
      const batch = this.queue.splice(0, this.queue.length);
      const payload = JSON.stringify({ events: batch });
      const blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon("/api/analytics", blob);
    };

    window.addEventListener("pagehide", flushOnExit);
    window.addEventListener("beforeunload", flushOnExit);
    this.hasBoundUnload = true;
  }
}

const tracker = new AnalyticsTracker();

export function track(
  event: AnalyticsEventName,
  payload: Record<string, unknown> = {}
) {
  tracker.track(event, payload);
}

export function flushAnalyticsQueue() {
  return tracker.flush();
}
