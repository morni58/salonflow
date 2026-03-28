import { useState, useEffect, useCallback } from "react";
import type { AnalyticsEvent } from "../types";
import { trackEvent } from "../api/client";

const SESSION_KEY = "salonflow_session_id";

function getOrCreateSessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    // sessionStorage недоступен (приватный режим и т.д.) — генерируем разовый
    return crypto.randomUUID();
  }
}

export function useSession(tenantId: string | undefined) {
  const [sessionId] = useState(() => getOrCreateSessionId());

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
