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
  pending:   { label: "Ожидает",      color: "bg-amber-100 text-amber-800",   icon: <AlertCircle size={18} className="shrink-0" aria-hidden /> },
  waiting:   { label: "В очереди",    color: "bg-orange-100 text-orange-800", icon: <Hourglass size={18} className="shrink-0" aria-hidden /> },
  confirmed: { label: "Подтверждено", color: "bg-green-100 text-green-800",   icon: <CheckCircle size={18} className="shrink-0" aria-hidden /> },
  completed: { label: "Завершено",    color: "bg-gray-100 text-gray-600",     icon: <CheckCircle size={18} className="shrink-0" aria-hidden /> },
  cancelled: { label: "Отменено",     color: "bg-red-100 text-red-700",       icon: <XCircle size={18} className="shrink-0" aria-hidden /> },
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
    "w-full rounded-2xl border border-black/10 bg-white px-5 py-5 text-lg outline-none transition-all focus:border-black/30 focus:shadow-[0_0_0_4px_rgba(0,0,0,0.06)] sm:text-xl";

  return (
    <div
      className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="relative flex w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:max-w-2xl sm:rounded-2xl lg:max-w-3xl"
        style={{ maxHeight: "94vh" }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-center justify-between border-b px-6 py-6 sm:px-8 sm:py-7"
          style={{ borderColor: "rgba(0,0,0,0.06)" }}
        >
          <div className="flex items-center gap-4">
            <ClipboardList size={32} className="shrink-0" style={{ color: "var(--color-primary)" }} aria-hidden />
            <div>
              <h2 className="font-serif text-3xl font-semibold text-ink sm:text-4xl">Мои записи</h2>
              {step === "list" && bookings.length > 0 && (
                <p className="mt-1 text-base text-ink-muted">Обновляется каждые 30 сек</p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/5 transition-colors hover:bg-black/10 sm:h-14 sm:w-14"
            aria-label="Закрыть"
          >
            <X size={22} />
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[min(78vh,820px)] flex-1 overflow-y-auto px-6 py-7 sm:px-8 sm:py-8">
          {step === "form" ? (
            <div className="space-y-6 sm:space-y-7">
              <p className="text-lg leading-relaxed text-ink-muted sm:text-xl">
                Введите контакт, который вы указали при записи — найдём все ваши заявки.
              </p>

              {/* Contact type selector — 2×2 grid */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                {CONTACTS.map((c) => (
                  <button
                    key={c.type}
                    type="button"
                    onClick={() => { setContactType(c.type); setContactValue(""); }}
                    className={cn(
                      "min-h-[68px] rounded-2xl border text-lg font-bold transition-all active:scale-[0.97] sm:min-h-[76px] sm:text-xl",
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
                className="flex h-[68px] w-full items-center justify-center gap-3 rounded-2xl text-lg font-bold transition-all disabled:opacity-40 active:scale-[0.97] sm:h-[76px] sm:text-xl"
                style={{ background: "#1c1917", color: "#fff" }}
              >
                {loading ? (
                  <span className="h-7 w-7 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : (
                  <>
                    <Search size={22} strokeWidth={2} aria-hidden />
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
                className="mb-6 flex items-center gap-2 text-base font-medium opacity-55 transition-opacity hover:opacity-100 sm:text-lg"
                style={{ color: "var(--color-text)" }}
              >
                ← Изменить контакт
              </button>

              {bookings.length === 0 ? (
                <div className="flex flex-col items-center gap-5 py-16 text-center sm:py-20">
                  <CalendarDays size={64} className="opacity-20" style={{ color: "var(--color-text)" }} aria-hidden />
                  <p className="text-2xl font-semibold text-ink">Записей не найдено</p>
                  <p className="max-w-md text-lg leading-relaxed text-ink-muted">
                    Убедитесь, что вы указали тот же контакт, что использовали при записи.
                  </p>
                </div>
              ) : (
                <div className="space-y-5 sm:space-y-6">
                  {bookings.map((b) => {
                    const status = STATUS_MAP[b.status] ?? STATUS_MAP.pending;
                    const canCancel = CANCELLABLE.includes(b.status);
                    const isCancelConfirm = cancelConfirm === b.id;
                    const isPast = new Date(b.datetime_iso) < new Date();

                    return (
                      <div
                        key={b.id}
                        className={cn(
                          "rounded-2xl border p-6 transition-all sm:p-7",
                          b.status === "cancelled" ? "opacity-50" : "",
                          b.status === "completed" ? "opacity-70" : ""
                        )}
                        style={{ borderColor: "rgba(0,0,0,0.09)", background: b.status === "confirmed" ? "rgba(0,0,0,0.015)" : undefined }}
                      >
                        {/* Status + date row */}
                        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                          <span className={cn("inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-base font-bold sm:text-lg", status.color)}>
                            {status.icon}
                            {status.label}
                          </span>
                          <div className="shrink-0 text-right">
                            <p className="text-lg font-bold sm:text-xl" style={{ color: "var(--color-text)" }}>{b.datetime_display}</p>
                            {isPast && b.status !== "cancelled" && (
                              <p className="mt-0.5 text-sm opacity-40" style={{ color: "var(--color-text)" }}>прошло</p>
                            )}
                          </div>
                        </div>

                        {/* Services */}
                        <div className="mb-4 flex flex-wrap gap-2">
                          {b.service_names.map((svc, i) => (
                            <span
                              key={i}
                              className="rounded-xl border px-4 py-2 text-base font-medium sm:text-lg"
                              style={{ borderColor: "rgba(0,0,0,0.10)", color: "var(--color-text)" }}
                            >
                              {svc}
                            </span>
                          ))}
                        </div>

                        {/* Details row */}
                        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
                          <span className="flex items-center gap-2 text-base opacity-55 sm:text-lg" style={{ color: "var(--color-text)" }}>
                            <Clock size={18} aria-hidden />
                            {formatDuration(b.total_duration_minutes)}
                          </span>
                          <span className="text-2xl font-bold tabular-nums sm:text-3xl" style={{ color: "var(--color-primary)" }}>
                            {formatPrice(b.total_price)}
                          </span>
                          {b.master_name && (
                            <span className="flex items-center gap-1.5 text-base opacity-55 sm:text-lg" style={{ color: "var(--color-text)" }}>
                              <ChevronRight size={18} aria-hidden />
                              {b.master_name}
                            </span>
                          )}
                        </div>

                        {/* Booking code */}
                        {b.booking_code && (
                          <p className="mb-4 font-mono text-sm opacity-35 sm:text-base" style={{ color: "var(--color-text)" }}>{b.booking_code}</p>
                        )}

                        {/* Cancel */}
                        {canCancel && !isCancelConfirm && (
                          <button
                            type="button"
                            onClick={() => setCancelConfirm(b.id)}
                            className="flex min-h-[48px] items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-5 text-base font-semibold text-red-600 transition-colors hover:bg-red-100 sm:text-lg"
                          >
                            <Trash2 size={18} aria-hidden />
                            Отменить запись
                          </button>
                        )}

                        {isCancelConfirm && (
                          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 sm:p-6">
                            <p className="mb-4 text-lg font-semibold text-red-800 sm:text-xl">Отменить эту запись?</p>
                            <div className="flex flex-col gap-3 sm:flex-row">
                              <button
                                type="button"
                                disabled={cancelling}
                                onClick={() => handleCancel(b.id)}
                                className="h-14 flex-1 rounded-2xl bg-red-500 text-base font-bold text-white transition-opacity disabled:opacity-50 sm:text-lg"
                              >
                                {cancelling ? "..." : "Да, отменить"}
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancelConfirm(null)}
                                className="h-14 flex-1 rounded-2xl bg-black/8 text-base font-semibold sm:text-lg"
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
