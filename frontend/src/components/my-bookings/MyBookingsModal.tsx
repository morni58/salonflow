import { useState, useEffect, useRef, useCallback } from "react";
import {
  X, Search, Clock, CheckCircle, XCircle, AlertCircle,
  Hourglass, CalendarDays, ChevronRight, Trash2, ClipboardList,
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
  pending:   { label: "Ожидает",      color: "bg-amber-100 text-amber-800",   icon: <AlertCircle size={13} /> },
  waiting:   { label: "В очереди",    color: "bg-orange-100 text-orange-800", icon: <Hourglass size={13} /> },
  confirmed: { label: "Подтверждено", color: "bg-green-100 text-green-800",   icon: <CheckCircle size={13} /> },
  completed: { label: "Завершено",    color: "bg-gray-100 text-gray-600",     icon: <CheckCircle size={13} /> },
  cancelled: { label: "Отменено",     color: "bg-red-100 text-red-700",       icon: <XCircle size={13} /> },
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

  const prevStatusesRef = useRef<Record<string, BookingStatus>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Always keep ref in sync with current state — fixes the empty-ref bug
  const contactRef = useRef({ type: contactType, value: contactValue });
  useEffect(() => {
    contactRef.current = { type: contactType, value: contactValue };
  }, [contactType, contactValue]);

  const doLookup = useCallback(async (silent = false) => {
    const { type, value } = contactRef.current;
    if (!value.trim()) return;
    if (!silent) setLoading(true);
    try {
      const result = await lookupMyBookings(tenantId, type, value.trim());
      setBookings(result);

      if (Object.keys(prevStatusesRef.current).length > 0) {
        result.forEach((b) => {
          const prev = prevStatusesRef.current[b.id];
          if (prev && prev !== b.status) {
            const info = STATUS_MAP[b.status];
            toast.success(`Запись обновлена: ${info.label}`, { duration: 5000 });
          }
        });
      }

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

  // Polling every 30s while on list view
  useEffect(() => {
    if (step !== "list") return;
    pollRef.current = setInterval(() => doLookup(true), 30_000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [step, doLookup]);

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

  const inputClass =
    "w-full rounded-xl border border-black/10 bg-white px-4 py-4 text-base outline-none transition-all focus:border-black/30 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]";

  return (
    <div
      className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative w-full sm:max-w-xl bg-white sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col overflow-hidden"
        style={{ maxHeight: "92vh" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b shrink-0"
          style={{ borderColor: "rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center gap-3">
            <ClipboardList size={24} style={{ color: "var(--color-primary)" }} />
            <div>
              <h2 className="font-serif text-2xl font-semibold text-ink">Мои записи</h2>
              {step === "list" && bookings.length > 0 && (
                <p className="text-sm text-ink-muted mt-0.5">Обновляется каждые 30 сек</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-black/5 hover:bg-black/10 transition-colors"
            aria-label="Закрыть"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-6">
          {step === "form" ? (
            <div className="space-y-5">
              <p className="text-base text-ink-muted leading-relaxed">
                Введите контакт, который вы указали при записи — найдём все ваши заявки.
              </p>

              {/* Contact type selector — 2×2 grid */}
              <div className="grid grid-cols-2 gap-3">
                {CONTACTS.map((c) => (
                  <button
                    key={c.type}
                    type="button"
                    onClick={() => { setContactType(c.type); setContactValue(""); }}
                    className={cn(
                      "h-[60px] rounded-xl border text-base font-bold transition-all active:scale-[0.97]",
                      contactType === c.type
                        ? "border-transparent text-white shadow-sm"
                        : "bg-white border-black/10 hover:bg-black/4"
                    )}
                    style={
                      contactType === c.type
                        ? { background: "#1c1917" }
                        : { color: "var(--color-text)" }
                    }
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
                className={inputClass}
                style={{ color: "var(--color-text)" }}
                autoFocus
                autoComplete="off"
                inputMode={contactType === "phone" || contactType === "whatsapp" ? "tel" : "text"}
              />

              <button
                type="button"
                disabled={!contactValue.trim() || loading}
                onClick={() => doLookup()}
                className="flex h-[60px] w-full items-center justify-center gap-2.5 rounded-xl text-base font-bold transition-all disabled:opacity-40 active:scale-[0.97]"
                style={{ background: "#1c1917", color: "#fff" }}
              >
                {loading ? (
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <Search size={18} />
                    Найти записи
                  </>
                )}
              </button>
            </div>
          ) : (
            <div>
              {/* Back */}
              <button
                type="button"
                onClick={() => { setStep("form"); prevStatusesRef.current = {}; }}
                className="mb-5 flex items-center gap-1.5 text-sm font-medium opacity-55 hover:opacity-100 transition-opacity"
                style={{ color: "var(--color-text)" }}
              >
                ← Изменить контакт
              </button>

              {bookings.length === 0 ? (
                <div className="flex flex-col items-center py-14 text-center gap-4">
                  <CalendarDays size={52} className="opacity-20" style={{ color: "var(--color-text)" }} />
                  <p className="text-lg font-semibold text-ink">Записей не найдено</p>
                  <p className="text-sm text-ink-muted max-w-xs leading-relaxed">
                    Убедитесь, что вы указали тот же контакт, что использовали при записи.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {bookings.map((b) => {
                    const status = STATUS_MAP[b.status] ?? STATUS_MAP.pending;
                    const canCancel = CANCELLABLE.includes(b.status);
                    const isCancelConfirm = cancelConfirm === b.id;
                    const isPast = new Date(b.datetime_iso) < new Date();

                    return (
                      <div
                        key={b.id}
                        className={cn(
                          "rounded-2xl border p-5 transition-all",
                          b.status === "cancelled" ? "opacity-50" : "",
                          b.status === "completed" ? "opacity-70" : ""
                        )}
                        style={{ borderColor: "rgba(0,0,0,0.09)", background: b.status === "confirmed" ? "rgba(0,0,0,0.015)" : undefined }}
                      >
                        {/* Status + date row */}
                        <div className="flex items-start justify-between gap-3 mb-4">
                          <span className={cn("inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-bold", status.color)}>
                            {status.icon}
                            {status.label}
                          </span>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold" style={{ color: "var(--color-text)" }}>{b.datetime_display}</p>
                            {isPast && b.status !== "cancelled" && (
                              <p className="text-xs opacity-40 mt-0.5" style={{ color: "var(--color-text)" }}>прошло</p>
                            )}
                          </div>
                        </div>

                        {/* Services */}
                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {b.service_names.map((svc, i) => (
                            <span
                              key={i}
                              className="rounded-lg border px-3 py-1 text-sm font-medium"
                              style={{ borderColor: "rgba(0,0,0,0.10)", color: "var(--color-text)" }}
                            >
                              {svc}
                            </span>
                          ))}
                        </div>

                        {/* Details row */}
                        <div className="flex items-center gap-4 mb-4">
                          <span className="flex items-center gap-1.5 text-sm opacity-55" style={{ color: "var(--color-text)" }}>
                            <Clock size={14} />
                            {formatDuration(b.total_duration_minutes)}
                          </span>
                          <span className="text-lg font-bold tabular-nums" style={{ color: "var(--color-primary)" }}>
                            {formatPrice(b.total_price)}
                          </span>
                          {b.master_name && (
                            <span className="flex items-center gap-1 text-sm opacity-55" style={{ color: "var(--color-text)" }}>
                              <ChevronRight size={14} />
                              {b.master_name}
                            </span>
                          )}
                        </div>

                        {/* Booking code */}
                        {b.booking_code && (
                          <p className="font-mono text-xs opacity-35 mb-3" style={{ color: "var(--color-text)" }}>{b.booking_code}</p>
                        )}

                        {/* Cancel */}
                        {canCancel && !isCancelConfirm && (
                          <button
                            type="button"
                            onClick={() => setCancelConfirm(b.id)}
                            className="flex h-10 items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-500 hover:bg-red-100 transition-colors"
                          >
                            <Trash2 size={14} />
                            Отменить запись
                          </button>
                        )}

                        {isCancelConfirm && (
                          <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                            <p className="text-sm font-semibold text-red-800 mb-3">Отменить эту запись?</p>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                disabled={cancelling}
                                onClick={() => handleCancel(b.id)}
                                className="flex-1 h-12 rounded-xl bg-red-500 text-white text-sm font-bold transition-opacity disabled:opacity-50"
                              >
                                {cancelling ? "..." : "Да, отменить"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancelConfirm(null)}
                                className="flex-1 h-12 rounded-xl bg-black/8 text-sm font-semibold"
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
