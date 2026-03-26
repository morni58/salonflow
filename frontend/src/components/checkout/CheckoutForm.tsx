import { useState, useEffect } from "react";
import {
  Send,
  Calendar,
  Clock,
  User,
  ArrowLeft,
  CheckCircle,
  MessageCircle,
  UserRound,
} from "lucide-react";
import { toast } from "../common/Toast";
import type { ContactType, MasterPublic } from "../../types";
import { useCart } from "../../store/cartStore";
import { fetchSlots, createBooking, fetchMasters } from "../../api/client";
import { formatPrice, formatDuration, cn } from "../../utils";

const PREFILL_MASTER_KEY = "salonflow_prefill_master";

interface Props {
  tenantId: string;
  onBack: () => void;
  onTrackCheckout: () => void;
}

const CONTACTS: { type: ContactType; label: string; icon: string; placeholder: string }[] = [
  { type: "telegram", label: "Telegram", icon: "✈️", placeholder: "@username" },
  { type: "whatsapp", label: "WhatsApp", icon: "💬", placeholder: "+7 707 123 4567" },
  { type: "instagram", label: "Instagram", icon: "📸", placeholder: "@username" },
  { type: "phone", label: "Телефон", icon: "📞", placeholder: "+7 707 123 4567" },
];

const inputClass =
  "min-w-0 w-full max-w-full rounded-3xl border border-transparent bg-white px-5 py-3.5 text-sm outline-none shadow-soft transition-colors";
const cardBorder = { borderColor: "transparent" };

export function CheckoutForm({ tenantId, onBack, onTrackCheckout }: Props) {
  const { items, totalPrice, totalDuration, clearCart } = useCart();

  const [masters, setMasters] = useState<MasterPublic[]>([]);
  const [requiresMaster, setRequiresMaster] = useState(false);
  const [selectedMasterId, setSelectedMasterId] = useState<string>("");

  const [name, setName] = useState("");
  const [contactType, setContactType] = useState<ContactType>("telegram");
  const [contactValue, setContactValue] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const dates = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });

  useEffect(() => {
    fetchMasters(tenantId)
      .then((res) => {
        setMasters(res.masters);
        setRequiresMaster(res.requires_master);
        try {
          const pre = sessionStorage.getItem(PREFILL_MASTER_KEY);
          if (pre && res.masters.some((x) => x.id === pre)) {
            setSelectedMasterId(pre);
          }
          sessionStorage.removeItem(PREFILL_MASTER_KEY);
        } catch {
          /* ignore */
        }
      })
      .catch(() => {})
      .finally(() => {});
  }, [tenantId]);

  useEffect(() => {
    if (!selectedDate) return;
    if (requiresMaster && !selectedMasterId) {
      setSlots([]);
      return;
    }
    setSlotsLoading(true);
    setSelectedTime("");
    fetchSlots(tenantId, selectedDate, requiresMaster ? selectedMasterId : null)
      .then((res) => setSlots(res.slots ?? []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [selectedDate, tenantId, selectedMasterId, requiresMaster]);

  const masterOk = !requiresMaster || !!selectedMasterId;
  const canSubmit =
    masterOk && name.trim() && contactValue.trim() && selectedDate && selectedTime;

  const handleSubmit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);

    try {
      await createBooking({
        tenant_id: tenantId,
        name: name.trim(),
        contact_type: contactType,
        contact_value: contactValue.trim(),
        service_ids: items.map((i) => i.service.id),
        preferred_datetime: `${selectedDate}T${selectedTime}:00`,
        master_id: requiresMaster ? selectedMasterId : undefined,
      });
      onTrackCheckout();
      setSuccess(true);
      clearCart();
    } catch {
      toast.error("Ошибка при отправке. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <div
          className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl shadow-soft"
          style={{ background: "var(--color-primary-muted)" }}
        >
          <CheckCircle size={40} style={{ color: "var(--color-primary)" }} />
        </div>
        <h2 className="font-serif text-3xl font-semibold text-ink-dark">Заявка отправлена!</h2>
        <p className="mt-3 max-w-sm opacity-65" style={{ color: "var(--color-text)" }}>
          Мы свяжемся с вами через выбранный мессенджер для подтверждения и оплаты.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="btn-primary-soft mt-8 rounded-full px-10 py-3.5 font-semibold shadow-soft"
          style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
        >
          На главную
        </button>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-lg">
      <button
        type="button"
        onClick={onBack}
        className="mb-6 flex items-center gap-2 text-sm opacity-65 transition-opacity hover:opacity-100"
        style={{ color: "var(--color-text)" }}
      >
        <ArrowLeft size={16} /> Назад к услугам
      </button>

      <h2 className="font-serif mb-6 text-3xl font-semibold text-ink-dark">Оформление записи</h2>

      <div className="mb-6 max-w-full overflow-hidden rounded-3xl border border-transparent bg-white p-5 shadow-soft">
        <p
          className="line-clamp-4 text-sm leading-relaxed opacity-55"
          style={{ color: "var(--color-text)", overflowWrap: "anywhere" }}
        >
          {items.map((i) => i.service.name).join(", ")}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span style={{ color: "var(--color-text)", opacity: 0.75 }}>{formatDuration(totalDuration)}</span>
          <span className="text-xl font-semibold tabular-nums tracking-tight" style={{ color: "var(--color-accent)" }}>
            {formatPrice(totalPrice)}
          </span>
        </div>
      </div>

      {requiresMaster && masters.length > 0 && (
        <div className="mb-6">
          <label className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-text)" }}>
            <UserRound size={16} /> Мастер
          </label>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
            {masters.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setSelectedMasterId(m.id);
                  setSelectedDate("");
                  setSelectedTime("");
                }}
                className={cn(
                  "flex w-[7.5rem] shrink-0 flex-col items-center gap-2 rounded-3xl border border-transparent p-3 text-center shadow-soft transition-all sm:w-28",
                  selectedMasterId === m.id ? "shadow-soft" : "bg-white hover:brightness-[0.995]"
                )}
                style={
                  selectedMasterId === m.id
                    ? {
                        background: "var(--color-primary)",
                        borderColor: "transparent",
                        color: "var(--color-primary-foreground)",
                      }
                    : { color: "var(--color-text)", borderColor: "var(--color-border-muted)" }
                }
              >
                <div
                  className="h-14 w-14 overflow-hidden rounded-2xl ring-1 ring-black/5"
                  style={{ background: "var(--color-placeholder-surface)" }}
                >
                  {m.photo_url ? (
                    <img src={m.photo_url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <UserRound className="h-7 w-7 opacity-35" />
                    </div>
                  )}
                </div>
                <span className="line-clamp-2 text-xs font-medium leading-tight">{m.display_name}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs opacity-55" style={{ color: "var(--color-text)" }}>
            Слоты показываются по графику выбранного мастера.
          </p>
        </div>
      )}

      <div className="mb-5">
        <label className="mb-2 flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-text)" }}>
          <User size={16} /> Ваше имя
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Как к вам обращаться?"
          className={inputClass}
          style={{ ...cardBorder, color: "var(--color-text)" }}
        />
      </div>

      <div className="mb-5">
        <label className="mb-2 flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-text)" }}>
          <MessageCircle size={16} /> Как с вами связаться?
        </label>
        <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {CONTACTS.map((c) => (
            <button
              key={c.type}
              type="button"
              onClick={() => {
                setContactType(c.type);
                setContactValue("");
              }}
              className={cn(
                "rounded-3xl border border-transparent py-3.5 text-center text-sm shadow-soft transition-all",
                contactType === c.type ? "shadow-soft" : "bg-white hover:brightness-[0.99]"
              )}
              style={
                contactType === c.type
                  ? {
                      background: "var(--color-primary)",
                      borderColor: "transparent",
                      color: "var(--color-primary-foreground)",
                    }
                  : { color: "var(--color-text)", borderColor: "var(--color-border-muted)" }
              }
            >
              <span className="text-lg">{c.icon}</span>
              <p className="mt-0.5 text-xs opacity-80">{c.label}</p>
            </button>
          ))}
        </div>
        <input
          type="text"
          value={contactValue}
          onChange={(e) => setContactValue(e.target.value)}
          placeholder={CONTACTS.find((c) => c.type === contactType)?.placeholder}
          className={inputClass}
          style={{ ...cardBorder, color: "var(--color-text)" }}
        />
      </div>

      <div className="mb-5">
        <label className="mb-2 flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-text)" }}>
          <Calendar size={16} /> Дата
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
          {dates.map((d) => {
            const dt = new Date(d + "T00:00:00");
            const day = dt.getDate();
            const weekday = dt.toLocaleDateString("ru", { weekday: "short" });
            const month = dt.toLocaleDateString("ru", { month: "short" });
            return (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDate(d)}
                disabled={requiresMaster && !selectedMasterId}
                className={cn(
                  "flex shrink-0 flex-col items-center rounded-3xl border border-transparent px-4 py-4 shadow-soft transition-all",
                  selectedDate === d ? "shadow-soft" : "bg-white hover:brightness-[0.995]",
                  requiresMaster && !selectedMasterId ? "pointer-events-none opacity-40" : ""
                )}
                style={
                  selectedDate === d
                    ? {
                        background: "var(--color-primary)",
                        borderColor: "transparent",
                        color: "var(--color-primary-foreground)",
                      }
                    : { color: "var(--color-text)", borderColor: "var(--color-border-muted)" }
                }
              >
                <span className="text-xs opacity-70">{weekday}</span>
                <span className="text-lg font-semibold">{day}</span>
                <span className="text-xs opacity-70">{month}</span>
              </button>
            );
          })}
        </div>
      </div>

      {selectedDate && masterOk && (
        <div className="mb-6">
          <label className="mb-2 flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-text)" }}>
            <Clock size={16} /> Время
          </label>
          {slotsLoading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-3xl bg-brand-100" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <p className="text-sm opacity-50" style={{ color: "var(--color-text)" }}>
              Нет доступных слотов на эту дату
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedTime(slot)}
                  className={cn(
                    "rounded-3xl border border-transparent py-3.5 text-sm font-medium shadow-soft transition-all",
                    selectedTime === slot ? "shadow-soft" : "bg-white hover:brightness-[0.99]"
                  )}
                  style={
                    selectedTime === slot
                      ? {
                          background: "var(--color-primary)",
                          borderColor: "transparent",
                          color: "var(--color-primary-foreground)",
                        }
                      : { color: "var(--color-text)", borderColor: "var(--color-border-muted)" }
                  }
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={!canSubmit || submitting}
        className="btn-primary-soft flex w-full items-center justify-center gap-2 rounded-full py-5 text-sm font-semibold shadow-soft disabled:opacity-45"
        style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
      >
        <Send size={18} />
        {submitting ? "Отправка..." : "Отправить заявку"}
      </button>
    </section>
  );
}
