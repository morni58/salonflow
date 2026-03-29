import { useState, useEffect, useRef, useCallback } from "react";
import { lookupMyBookings } from "../api/client";
import type { BookingStatus } from "../types";

const CONTACT_KEY = "salonflow_booking_contact";

export interface BookingContact {
  tenantId: string;
  type: string;
  value: string;
  savedAt: number;
}

export interface StatusNotification {
  uid: string; // unique per notification event
  bookingId: string;
  bookingCode: string;
  newStatus: BookingStatus;
  serviceNames: string[];
}

export function saveBookingContact(tenantId: string, type: string, value: string) {
  try {
    localStorage.setItem(
      CONTACT_KEY,
      JSON.stringify({ tenantId, type, value, savedAt: Date.now() } satisfies BookingContact)
    );
  } catch {
    // localStorage unavailable
  }
}

function loadContact(): BookingContact | null {
  try {
    const raw = localStorage.getItem(CONTACT_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as BookingContact;
    // Expire after 14 days
    if (Date.now() - data.savedAt > 14 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem(CONTACT_KEY);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

export function useBookingPoller() {
  const [notifications, setNotifications] = useState<StatusNotification[]>([]);
  const [hasContact, setHasContact] = useState(false);
  const prevStatuses = useRef<Record<string, BookingStatus>>({});
  const seeded = useRef(false);

  const poll = useCallback(async (isInit = false) => {
    const contact = loadContact();
    if (!contact) { setHasContact(false); return; }
    setHasContact(true);
    try {
      const bookings = await lookupMyBookings(contact.tenantId, contact.type, contact.value);
      if (isInit) {
        // Seed known statuses — no notifications on first load
        bookings.forEach((b) => { prevStatuses.current[b.id] = b.status; });
        seeded.current = true;
        return;
      }
      if (!seeded.current) return;
      const newNotifs: StatusNotification[] = [];
      bookings.forEach((b) => {
        const prev = prevStatuses.current[b.id];
        if (prev && prev !== b.status) {
          newNotifs.push({
            uid: `${b.id}-${b.status}-${Date.now()}`,
            bookingId: b.id,
            bookingCode: b.booking_code,
            newStatus: b.status,
            serviceNames: b.service_names,
          });
        }
        prevStatuses.current[b.id] = b.status;
      });
      if (newNotifs.length > 0) {
        setNotifications((prev) => [...prev, ...newNotifs]);
      }
    } catch {
      // silent — network errors shouldn't break the UI
    }
  }, []);

  useEffect(() => {
    if (loadContact()) setHasContact(true);
    poll(true); // seed on mount

    const interval = setInterval(() => {
      if (document.visibilityState === "visible") poll(false);
    }, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === "visible") poll(false);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [poll]);

  const dismiss = (uid: string) => setNotifications((prev) => prev.filter((n) => n.uid !== uid));

  return { notifications, hasContact, dismiss };
}
