import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Search, Clock, CheckCircle, XCircle, AlertCircle,
  Hourglass, CalendarDays, ChevronRight, Trash2,
} from "lucide-react";
import type { MyBooking, BookingStatus, ContactType } from "../../types";
import { lookupMyBookings, cancelMyBooking } from "../../api/client";
import { toast } from "../common/Toast";
import { formatPrice, formatDuration, cn } from "../../utils";

const CONTACTS: { type: ContactType; label: string; placeholder: string }[] = [
  { type: "telegram",  label: "Telegram",  placeholder: "@username" },
  { type: "whatsapp",  label: "WhatsApp",  placeholder: "+7 707 123 4567" },
  { type: "instagram", label: "Instagram", placeholder: "@username" },
  { type: "phone",     label: "Телефон",   placeholder: "+7 707 123 4567" },
];

const STATUS_MAP: Record<BookingStatus, { label: string; color: string; icon: React.ReactNode }> = {
  pending:   { label: "Ожидает",       color: "bg-amber-100 text-amber-800",  icon: <AlertCircle size={13} /> },
  waiting:   { label: "В очереди",     color: "bg-orange-100 text-orange-800", icon: <Hourglass size={13} /> },
  confirmed: { label: "Подтверждено",  color: "bg-green-100 text-green-800",  icon: <CheckCircle size={13} /> },
  completed: { label: "Завершено",     color: "bg-gray-100 text-gray-600",    icon: <CheckCircle size={13} /> },
  cancelled: { label: "Отменено",      color: "bg-red-100 text-red-700",      icon: <XCircle size={13} /> },
};

const CANCELLABLE: BookingStatus[] = ["pending", "waiting", "confirmed"];

interface Props {
  tenantId: string;
  onClose: () => void;
}

export function MyBookingsModal({ tenantId, onClose }: Props) {
  const [step, setStep] = useState<"form" | "list">("form");
  const [contactType, setContactType] = useState<ContactType>("telegram");
  const [contactValue, setContactValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState<MyBooking[]>([]);
  const [cancelConfirm, setCancelConfirm] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // For status-change notifications
  const prevStatusesRef = useRef<Record<string, BookingStatus>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contactRef = useRef({ type: contactType, value: contactValue });

  const doLookup = useCallback(async (silent = false) => {
    const { type, value } = contactRef.current;
    if (!value.trim()) return;
    if (!silent) setLoading(true);
    try {
      const result = await lookupMyBookings(tenantId, type, value.trim());
      setBookings(result);

      // Detect status changes (only after first load)
      if (Object.keys(prevStatusesRef.current).length > 0) {
        result.forEach((b) => {
          const prev = prevStatusesRef.current[b.id];
          if (prev && prev !== b.status) {
            const info = STATUS_MAP[b.status];
            toast.success(`Запись обновлена: ${info.label}`, { duration: 5000 });
          }
        });
      }

      // Update prev statuses
      const next: Record<string, BookingStatus> = {};
      result.forEach((b) => { next[b.id] = b.status; });
      prevStatusesRef.current = next;

      if (!silent) setStep("list");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Ошибка поиска";
      if (!silent) toast.error(msg);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tenantId]);

  // Start polling when in list view
  useEffect(() => {
    if (step !== "list") return;
    contactRef.current = { type: contactType, value: contactValue };
    pollRef.current = setInterval(() => doLookup(true), 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, contactType, contactValue, doLookup]);

  // Close on Escape
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const handleCancel = async (bookingId: string) => {
    setCancelling(true);
    try {
      await cancelMyBooking(tenantId, bookingId, contactType, contactValue.trim());
      toast.success("Запись отменена");
      setCancelConfirm(null);
      setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, status: "cancelled" } : b));
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Не удалось отменить");
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full sm:max-w-lg bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b shrink-0"
          style={{ borderColor: "var(--color-border-soft, rgba(0,0,0,0.06))" }}
        >
          <div>
            <h2 className="font-serif text-xl font-semibold text-ink">Мои записи</h2>
            {step === "list" && bookings.length > 0 && (
              <p className="text-xs text-ink-muted mt-0.5">Обновляется каждые 30 сек</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 hover:bg-black/10 transition-colors"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {step === "form" ? (
            <div className="space-y-4">
              <p className="text-sm text-ink-muted leading-relaxed">
                Введите контакт, который вы указали при записи — найдём все ваши заявки.
              </p>

              {/* Contact type selector */}
              <div className="grid grid-cols-4 gap-2">
                {CONTACTS.map((c) => (
                  <button
                    key={c.type}
                    type="button"
                    onClick={() => setContactType(c.type)}
                    className={cn(
                      "rounded-xl border py-2.5 text-xs font-medium transition-all",
                      contactType === c.type
                        ? "border-transparent text-white"
                        : "bg-white border-black/8 hover:bg-black/4"
                    )}
                    style={contactType === c.type ? { background: "var(--color-primary)" } : { color: "var(--color-text)" }}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <input
                type="text"
                value={contactValue}
                onChange={(e) => setContactValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && contactValue.trim()) doLookup(); }}
                placeholder={CONTACTS.find((c) => c.type === contactType)?.placeholder}
                className="w-full rounded-xl border border-black/10 bg-white px-4 py-3.5 text-sm outline-none transition-all focus:border-black/30 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]"
                style={{ color: "var(--color-text)" }}
                autoFocus
              />

              <button
                type="button"
                disabled={!contactValue.trim() || loading}
                onClick={() => doLookup()}
                className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all disabled:opacity-40"
                style={{ background: "var(--color-primary)", color: "#fff" }}
              >
                {loading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <Search size={16} />
                    Найти записи
                  </>
                )}
              </button>
            </div>
          ) : (
            <div>
              {/* Back + re-search */}
              <button
                type="button"
                onClick={() => { setStep("form"); prevStatusesRef.current = {}; }}
                className="mb-4 flex items-center gap-1.5 text-xs font-medium opacity-55 hover:opacity-100 transition-opacity"
                style={{ color: "var(--color-text)" }}
              >
                ← Изменить контакт
              </button>

              {bookings.length === 0 ? (
                <div className="flex flex-col items-center py-10 text-center gap-3">
                  <CalendarDays size={40} className="opacity-20" style={{ color: "var(--color-text)" }} />
                  <p className="font-medium text-ink">Записей не найдено</p>
                  <p className="text-sm text-ink-muted max-w-xs">
                    Убедитесь, что вы указали тот же контакт, что использовали при записи.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookings.map((b) => {
                    const status = STATUS_MAP[b.status] ?? STATUS_MAP.pending;
                    const canCancel = CANCELLABLE.includes(b.status);
                    const isCancelConfirm = cancelConfirm === b.id;
                    const isPast = new Date(b.datetime_iso) < new Date();

                    return (
                      <div
                        key={b.id}
                        className={cn(
                          "rounded-2xl border p-4 transition-all",
                          b.status === "cancelled" ? "opacity-55" : "",
                          b.status === "completed" ? "opacity-75" : ""
                        )}
                        style={{ borderColor: "var(--color-border-soft, rgba(0,0,0,0.07))" }}
                      >
                        {/* Top row: status + code + date */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold", status.color)}>
                              {status.icon}
                              {status.label}
                            </span>
                            {b.booking_code && (
                              <span className="text-[11px] font-mono font-bold opacity-45" style={{ color: "var(--color-text)" }}>
                                {b.booking_code}
                              </span>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>{b.datetime_display}</p>
                            {isPast && b.status !== "cancelled" && (
                              <p className="text-[10px] opacity-40 mt-0.5" style={{ color: "var(--color-text)" }}>прошло</p>
                            )}
                          </div>
                        </div>

                        {/* Services */}
                        <div className="flex flex-wrap gap-1 mb-2">
                          {b.service_names.map((svc, i) => (
                            <span
                              key={i}
                              className="rounded-md border px-2 py-0.5 text-xs"
                              style={{ borderColor: "rgba(0,0,0,0.08)", color: "var(--color-text)", opacity: 0.8 }}
                            >
                              {svc}
                            </span>
                          ))}
                        </div>

                        {/* Details row */}
                        <div className="flex items-center gap-3 text-xs opacity-55 mb-3" style={{ color: "var(--color-text)" }}>
                          <span className="flex items-center gap-1">
                            <Clock size={11} />
                            {formatDuration(b.total_duration_minutes)}
                          </span>
                          <span className="font-semibold" style={{ color: "var(--color-primary)", opacity: 1 }}>
                            {formatPrice(b.total_price)}
                          </span>
                          {b.master_name && (
                            <span className="flex items-center gap-1">
                              <ChevronRight size={11} />
                              {b.master_name}
                            </span>
                          )}
                        </div>

                        {/* Cancel button */}
                        {canCancel && !isCancelConfirm && (
                          <button
                            type="button"
                            onClick={() => setCancelConfirm(b.id)}
                            className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 transition-colors font-medium"
                          >
                            <Trash2 size={12} />
                            Отменить запись
                          </button>
                        )}

                        {/* Confirm cancel */}
                        {isCancelConfirm && (
                          <div className="mt-1 rounded-xl border border-red-100 bg-red-50 p-3">
                            <p className="text-xs text-red-800 font-medium mb-2">Отменить эту запись?</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={cancelling}
                                onClick={() => handleCancel(b.id)}
                                className="flex-1 h-8 rounded-lg bg-red-500 text-white text-xs font-semibold transition-opacity disabled:opacity-50"
                              >
                                {cancelling ? "..." : "Да, отменить"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancelConfirm(null)}
                                className="flex-1 h-8 rounded-lg bg-black/6 text-xs font-medium"
                                style={{ color: "var(--color-text)" }}
                              >
                                Нет
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
