import { useState, useEffect, useCallback } from "react";
import type { AnalyticsEvent } from "../types";
import { trackEvent } from "../api/client";

function generateId(): string {
  return crypto.randomUUID();
}

export function useSession(tenantId: string | undefined) {
  const [sessionId] = useState(() => generateId());

  const track = useCallback(
    (event: AnalyticsEvent) => {
      if (!tenantId) return;
      trackEvent(tenantId, event, sessionId).catch(() => {});
    },
    [tenantId, sessionId]
  );

  // Track visit on mount
  useEffect(() => {
    track("visit");
  }, [track]);

  return { sessionId, track };
}
