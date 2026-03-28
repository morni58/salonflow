import { useState, useEffect, useRef } from "react";
import {
  Send,
  Calendar,
  Clock,
  User,
  ArrowLeft,
  CheckCircle,
  MessageCircle,
  UserRound,
  AlertTriangle,
  ShoppingBag,
} from "lucide-react";
import { toast } from "../common/Toast";
import type { ContactType, MasterPublic, Tenant } from "../../types";
import { useCart } from "../../store/cartStore";
import { fetchSlots, createBooking, fetchMasters } from "../../api/client";
import { formatPrice, formatDuration, cn } from "../../utils";

const PREFILL_MASTER_KEY = "salonflow_prefill_master";

interface Props {
  tenantId: string;
  tenant: Tenant;
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
  "min-w-0 w-full max-w-full rounded-lg border border-brand-100 bg-white px-4 py-3.5 text-sm outline-none shadow-sm transition-all focus:border-brand-400 focus:shadow-[0_0_0_3px_var(--color-primary-20)]";

/** Проверить закрыт ли день по расписанию тенанта (без обращения к API) */
function isDateClosed(dateStr: string, tenant: Tenant): boolean {
  const d = new Date(dateStr + "T00:00:00");
  const jsDay = d.getDay(); // 0=Вс, 1=Пн … 6=Сб
  const weekday = jsDay === 0 ? 6 : jsDay - 1; // Python weekday: 0=Пн, 6=Вс

  const workingDays: number[] = Array.isArray(tenant.working_days)
    ? tenant.working_days
    : [0, 1, 2, 3, 4, 5, 6];

  const mode = tenant.schedule_mode ?? "weekdays";

  if (mode === "every_n_days" && tenant.every_n_days_anchor) {
    const n = Math.max(1, tenant.every_n_days ?? 1);
    const anchor = new Date(tenant.every_n_days_anchor + "T00:00:00");
    const delta = Math.floor((d.getTime() - anchor.getTime()) / 86_400_000);
    if (delta < 0) return !workingDays.includes(weekday);
    return delta % n !== 0;
  }

  return !workingDays.includes(weekday);
}

/** Валидация контакта по типу */
function validateContact(type: ContactType, value: string): string | null {
  const v = value.trim();
  if (!v) return "Введите контакт";
  if (type === "telegram" || type === "instagram") {
    if (!v.startsWith("@")) return `Введите никнейм в формате @username`;
    if (v.length < 3) return "Слишком короткий никнейм";
  }
  if (type === "phone" || type === "whatsapp") {
    const digits = v.replace(/\D/g, "");
    if (digits.length < 10) return "Введите номер телефона (минимум 10 цифр)";
  }
  return null;
}

interface SuccessInfo {
  date: string;
  time: string;
  duration: number;
  name: string;
  contactType: ContactType;
  contactValue: string;
  services: string;
  total: number;
}

export function CheckoutForm({ tenantId, tenant, onBack, onTrackCheckout }: Props) {
  const { items, totalPrice, totalDuration, clearCart } = useCart();

  const [masters, setMasters] = useState<MasterPublic[]>([]);
  const [requiresMaster, setRequiresMaster] = useState(false);
  const [mastersLoading, setMastersLoading] = useState(true);
  const [selectedMasterId, setSelectedMasterId] = useState<string>("");

  const [name, setName] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [contactType, setContactType] = useState<ContactType>("telegram");
  const [contactValue, setContactValue] = useState("");
  const [contactError, setContactError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [slotAlternate, setSlotAlternate] = useState<{ id: string; name: string } | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState<SuccessInfo | null>(null);

  // AbortController для предотвращения гонки при смене даты/мастера
  const slotAbortRef = useRef<AbortController | null>(null);

  const dates = Array.from({ length: 60 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  });

  useEffect(() => {
    setMastersLoading(true);
    fetchMasters(tenantId)
      .then((res) => {
        setMasters(res.masters);
        setRequiresMaster(res.requires_master);
        try {
          const pre = sessionStorage.getItem(PREFILL_MASTER_KEY);
          if (pre && res.masters.some((x) => x.id === pre)) {
            setSelectedMasterId(pre);
          } else if (res.requires_master && res.masters.length > 0) {
            setSelectedMasterId(res.masters[0].id);
          }
          sessionStorage.removeItem(PREFILL_MASTER_KEY);
        } catch {
          if (res.requires_master && res.masters.length > 0) {
            setSelectedMasterId(res.masters[0].id);
          }
        }
      })
      .catch(() => {
        toast.error(
          "Не удалось загрузить мастеров. Проверьте сеть и обновите страницу."
        );
      })
      .finally(() => setMastersLoading(false));
  }, [tenantId]);

  useEffect(() => {
    if (!selectedDate) return;
    if (mastersLoading) return;
    if (requiresMaster && !selectedMasterId) {
      setSlots([]);
      return;
    }

    // Отменяем предыдущий запрос
    slotAbortRef.current?.abort();
    const ctrl = new AbortController();
    slotAbortRef.current = ctrl;

    setSlotsLoading(true);
    setSelectedTime("");
    setSlots([]);

    fetchSlots(
      tenantId,
      selectedDate,
      requiresMaster ? selectedMasterId : null,
      totalDuration > 0 ? totalDuration : null
    )
      .then((res) => {
        if (ctrl.signal.aborted) return;
        setSlots(res.slots ?? []);
        if (res.alternate_master_id && res.alternate_master_name) {
          setSlotAlternate({ id: res.alternate_master_id, name: res.alternate_master_name });
        } else {
          setSlotAlternate(null);
        }
      })
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        setSlots([]);
        setSlotAlternate(null);
        const msg = err instanceof Error ? err.message : "Не удалось загрузить слоты";
        toast.error(msg);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setSlotsLoading(false);
      });

    return () => ctrl.abort();
  }, [
    selectedDate,
    tenantId,
    selectedMasterId,
    requiresMaster,
    totalDuration,
    mastersLoading,
  ]);

  const masterOk = !requiresMaster || !!selectedMasterId;
  const mastersUnavailable = requiresMaster && !mastersLoading && masters.length === 0;

  const validateName = (v: string) => {
    if (!v.trim()) return "Введите ваше имя";
    if (v.trim().length < 2) return "Имя слишком короткое";
    return null;
  };

  const canSubmit =
    !mastersUnavailable &&
    masterOk &&
    name.trim().length >= 2 &&
    !validateContact(contactType, contactValue) &&
    selectedDate &&
    selectedTime;

  const handleSubmit = async () => {
    // Показываем ошибки при попытке отправить
    const nErr = validateName(name);
    const cErr = validateContact(contactType, contactValue);
    setNameError(nErr);
    setContactError(cErr);
    if (nErr || cErr || !canSubmit || submitting) return;

    setSubmitting(true);
    try {
      const preferredDatetime = new Date(`${selectedDate}T${selectedTime}:00`).toISOString();
      await createBooking({
        tenant_id: tenantId,
        name: name.trim(),
        contact_type: contactType,
        contact_value: contactValue.trim(),
        service_ids: items.flatMap((i) => Array(i.quantity).fill(i.service.id)),
        preferred_datetime: preferredDatetime,
        master_id: requiresMaster ? selectedMasterId : undefined,
      });
      onTrackCheckout();
      setSuccessInfo({
        date: selectedDate,
        time: selectedTime,
        duration: totalDuration,
        name: name.trim(),
        contactType,
        contactValue: contactValue.trim(),
        services: items.map((i) => i.quantity > 1 ? `${i.service.name} ×${i.quantity}` : i.service.name).join(", "),
        total: totalPrice,
      });
      clearCart();
    } catch (e: unknown) {
      const detail = e instanceof Error ? e.message : "";
      toast.error(detail ? `Не удалось отправить: ${detail}` : "Ошибка при отправке. Попробуйте ещё раз.");
    } finally {
      setSubmitting(false);
    }
  };

  // Пустая корзина
  if (items.length === 0 && !successInfo) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl" style={{ background: "var(--color-primary-muted)" }}>
          <ShoppingBag size={36} strokeWidth={1.5} style={{ color: "var(--color-primary)" }} aria-hidden />
        </div>
        <p className="font-serif text-xl font-semibold text-ink">Корзина пуста</p>
        <p className="max-w-xs text-sm text-ink-muted opacity-70">Добавьте услуги из каталога, чтобы оформить запись</p>
        <button
          type="button"
          onClick={onBack}
          className="btn-ink mt-2"
        >
          <ArrowLeft size={16} /> К услугам
        </button>
      </div>
    );
  }

  if (successInfo) {
    const formattedDate = new Date(successInfo.date + "T00:00:00").toLocaleDateString("ru", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const contactLabel = CONTACTS.find((c) => c.type === successInfo.contactType)?.label ?? successInfo.contactType;
    return (
      <div className="step-slide-up flex min-h-[60vh] flex-col items-center justify-center text-center px-4">
        <div
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl shadow-soft animate-scale-in"
          style={{ background: "var(--color-primary-muted)" }}
        >
          <CheckCircle size={44} style={{ color: "var(--color-primary)" }} />
        </div>
        <h2 className="font-serif text-3xl font-semibold text-ink-dark animate-fade-up">Заявка отправлена!</h2>
        <p className="mt-3 max-w-sm opacity-65 animate-fade-up" style={{ color: "var(--color-text)", animationDelay: "60ms" }}>
          Мы свяжемся с вами через {contactLabel} для подтверждения.
        </p>

        <div className="mt-5 w-full max-w-sm space-y-2 text-left animate-fade-up" style={{ animationDelay: "100ms" }}>
          <div className="rounded-xl border border-brand-100 bg-brand-50 divide-y divide-brand-100 overflow-hidden">
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="shrink-0 text-base">👤</span>
              <div className="min-w-0">
                <p className="text-xs text-ink-muted">Имя</p>
                <p className="text-sm font-medium text-ink">{successInfo.name}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="shrink-0 text-base">📲</span>
              <div className="min-w-0">
                <p className="text-xs text-ink-muted">{contactLabel}</p>
                <p className="text-sm font-medium text-ink break-all">{successInfo.contactValue}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="shrink-0 text-base">📅</span>
              <div className="min-w-0">
                <p className="text-xs text-ink-muted">Дата и время</p>
                <p className="text-sm font-medium text-ink">{formattedDate} · {successInfo.time}</p>
              </div>
            </div>
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="shrink-0 text-base">💇</span>
              <div className="min-w-0">
                <p className="text-xs text-ink-muted">Услуги · {formatDuration(successInfo.duration)}</p>
                <p className="text-sm font-medium text-ink">{successInfo.services}</p>
              </div>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-xs text-ink-muted">Итого</p>
              <p className="text-base font-bold tabular-nums" style={{ color: "var(--color-primary)" }}>
                {formatPrice(successInfo.total)}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onBack}
          className="btn-primary-soft mt-6 rounded-lg px-10 py-3.5 font-semibold shadow-soft animate-fade-up"
          style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)", animationDelay: "180ms" }}
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

      <h2 className="font-serif mb-2 text-3xl font-semibold text-ink-dark">Оформление записи</h2>
      <p className="mb-6 text-sm text-ink-muted">Заполните форму — мы подтвердим запись в течение нескольких минут.</p>

      {/* Сводка услуг */}
      <div className="mb-6 max-w-full overflow-hidden rounded-lg border border-brand-100 bg-white p-5 shadow-soft">
        <p
          className="line-clamp-4 text-sm leading-relaxed opacity-55"
          style={{ color: "var(--color-text)", overflowWrap: "anywhere" }}
        >
          {items.map((i) => i.quantity > 1 ? `${i.service.name} ×${i.quantity}` : i.service.name).join(", ")}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm" style={{ color: "var(--color-text)", opacity: 0.75 }}>{formatDuration(totalDuration)}</span>
          <span className="text-xl font-semibold tabular-nums tracking-tight" style={{ color: "var(--color-primary)" }}>
            {formatPrice(totalPrice)}
          </span>
        </div>
      </div>

      {/* Ошибка: мастера требуются, но не настроены */}
      {mastersUnavailable && (
        <div className="mb-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3.5 text-sm text-amber-900">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-500" />
          <div>
            <strong className="block font-semibold">Запись временно недоступна онлайн</strong>
            <span className="opacity-80">Свяжитесь с нами напрямую — контакты в футере страницы.</span>
          </div>
        </div>
      )}

      {/* Выбор мастера */}
      {requiresMaster && masters.length > 0 && (
        <div className="mb-6">
          <label className="mb-3 flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-text)" }}>
            <UserRound size={16} /> Мастер
          </label>
          <div className="step-slide-up flex gap-3 overflow-x-auto pb-2 scrollbar-none">
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
                  "flex w-[7.5rem] shrink-0 flex-col items-center gap-2 rounded-lg border p-3 text-center shadow-sm transition-all sm:w-28",
                  selectedMasterId === m.id ? "shadow-soft scale-[1.03]" : "bg-white hover:brightness-[0.995]"
                )}
                style={
                  selectedMasterId === m.id
                    ? { background: "var(--color-primary)", borderColor: "transparent", color: "var(--color-primary-foreground)" }
                    : { color: "var(--color-text)", borderColor: "var(--color-border-muted)" }
                }
                aria-pressed={selectedMasterId === m.id}
              >
                <div
                  className="h-14 w-14 overflow-hidden rounded-lg ring-1 ring-black/5"
                  style={{ background: "var(--color-placeholder-surface)" }}
                >
                  {m.photo_url ? (
                    <img
                      src={m.photo_url}
                      alt={m.display_name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      onError={(e) => { e.currentTarget.style.display = "none"; }}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <UserRound className="h-7 w-7 opacity-35" aria-hidden />
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

      {/* Имя */}
      <div className="mb-5">
        <label className="mb-2 flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-text)" }}>
          <User size={16} /> Ваше имя
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); if (nameError) setNameError(validateName(e.target.value)); }}
          onBlur={() => setNameError(validateName(name))}
          placeholder="Как к вам обращаться?"
          className={cn(inputClass, nameError ? "border-red-300 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]" : "")}
          style={{ color: "var(--color-text)" }}
          autoComplete="name"
        />
        {nameError && <p className="mt-1.5 text-xs text-red-500">{nameError}</p>}
      </div>

      {/* Контакт */}
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
                setContactError(null);
              }}
              className={cn(
                "rounded-lg border border-black/5 py-3 text-center text-sm transition-all",
                contactType === c.type ? "bg-ink text-white border-transparent shadow-sm" : "bg-white hover:bg-black/5"
              )}
              style={contactType !== c.type ? { color: "var(--color-text)" } : undefined}
              aria-pressed={contactType === c.type}
            >
              <span className="text-lg">{c.icon}</span>
              <p className="mt-0.5 text-xs opacity-80">{c.label}</p>
            </button>
          ))}
        </div>
        <input
          type="text"
          value={contactValue}
          onChange={(e) => { setContactValue(e.target.value); if (contactError) setContactError(validateContact(contactType, e.target.value)); }}
          onBlur={() => setContactError(validateContact(contactType, contactValue))}
          placeholder={CONTACTS.find((c) => c.type === contactType)?.placeholder}
          className={cn(inputClass, contactError ? "border-red-300 focus:border-red-400 focus:shadow-[0_0_0_3px_rgba(239,68,68,0.15)]" : "")}
          style={{ color: "var(--color-text)" }}
          autoComplete={contactType === "phone" || contactType === "whatsapp" ? "tel" : "off"}
          inputMode={contactType === "phone" || contactType === "whatsapp" ? "tel" : "text"}
        />
        {contactError && <p className="mt-1.5 text-xs text-red-500">{contactError}</p>}
      </div>

      {/* Дата */}
      <div className="mb-5">
        <label className="mb-2 flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-text)" }}>
          <Calendar size={16} /> Дата
        </label>
        {requiresMaster && !selectedMasterId && masters.length > 0 && (
          <p className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
            Сначала выберите мастера выше — тогда откроются даты и время.
          </p>
        )}
        <div className="flex gap-1 overflow-x-auto rounded-lg border border-brand-200 bg-brand-50/90 p-1.5 pb-2 scrollbar-none">
          {dates.map((d, idx) => {
            const dt = new Date(d + "T00:00:00");
            const day = dt.getDate();
            const weekdayStr = dt.toLocaleDateString("ru", { weekday: "short" });
            const month = dt.toLocaleDateString("ru", { month: "short" });
            const isClosed = isDateClosed(d, tenant);
            const isToday = idx === 0;
            const isDisabled = isClosed || (requiresMaster && !selectedMasterId) || mastersUnavailable;
            const isSelected = selectedDate === d;
            return (
              <button
                key={d}
                type="button"
                onClick={() => !isDisabled && setSelectedDate(d)}
                disabled={isDisabled}
                className={cn(
                  "flex min-w-[4rem] shrink-0 flex-col items-center rounded-lg px-2.5 py-2.5 text-center transition-all duration-200",
                  isSelected ? "shadow-sm" : !isDisabled && "hover:bg-white",
                  isClosed && "cursor-not-allowed opacity-50",
                  requiresMaster && !selectedMasterId && !isClosed ? "pointer-events-none opacity-40" : ""
                )}
                style={
                  isSelected
                    ? { background: "var(--color-primary)", color: "var(--color-primary-foreground)" }
                    : { color: "var(--color-text)" }
                }
                aria-label={`${isToday ? "Сегодня" : weekdayStr}, ${day} ${month}${isClosed ? ", закрыто" : ""}`}
                aria-pressed={isSelected}
              >
                <span className={cn("text-[11px] font-medium", isSelected ? "opacity-80" : "opacity-50")}>
                  {isToday ? "сегодня" : weekdayStr}
                </span>
                <span className={cn("text-lg font-bold leading-tight", isClosed && "line-through decoration-brand-400")}>{day}</span>
                <span className={cn("text-[11px]", isSelected ? "opacity-75" : "opacity-45")}>{month}</span>
                {isToday && !isSelected && (
                  <span
                    className="mt-1 h-1 w-1 rounded-full"
                    style={{ background: "var(--color-primary)" }}
                    aria-hidden
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Время */}
      {selectedDate && masterOk && !mastersUnavailable && (
        <div className="mb-6">
          <label className="mb-2 flex items-center gap-2 text-sm font-medium" style={{ color: "var(--color-text)" }}>
            <Clock size={16} /> Время
          </label>
          {slotsLoading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-brand-100" />
              ))}
            </div>
          ) : slots.length === 0 ? (
            <div className="space-y-3">
              <p className="rounded-lg border border-brand-100 bg-brand-50 px-4 py-3 text-sm opacity-65" style={{ color: "var(--color-text)" }}>
                Нет свободного времени на эту дату ({formatDuration(totalDuration)}). Попробуйте другой день или мастера.
              </p>
              {slotAlternate && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMasterId(slotAlternate.id);
                    setSelectedTime("");
                  }}
                  className="w-full rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-left text-sm transition-colors hover:bg-brand-100"
                  style={{ color: "var(--color-text)" }}
                >
                  Показать слоты мастера: <b>{slotAlternate.name}</b>
                </button>
              )}
            </div>
          ) : (
            <div key={selectedDate} className="step-slide-up grid grid-cols-3 gap-2 sm:grid-cols-4">
              {slots.map((slot) => (
                <button
                  key={slot}
                  type="button"
                  onClick={() => setSelectedTime(slot)}
                  className={cn(
                    "rounded-lg border border-black/5 py-3 text-sm font-bold transition-all",
                    selectedTime === slot ? "shadow-soft scale-[1.03]" : "bg-white hover:bg-ink hover:text-white hover:border-transparent"
                  )}
                  style={
                    selectedTime === slot
                      ? { background: "var(--color-primary)", borderColor: "transparent", color: "var(--color-primary-foreground)" }
                      : { color: "var(--color-text)" }
                  }
                  aria-pressed={selectedTime === slot}
                >
                  {slot}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Кнопка отправки */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting}
        className="btn-primary-soft flex w-full items-center justify-center gap-2 rounded-lg py-4 text-sm font-semibold shadow-soft disabled:opacity-45 transition-opacity"
        style={{ background: "var(--color-primary)", color: "var(--color-primary-foreground)" }}
      >
        {submitting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            Отправка...
          </>
        ) : (
          <>
            <Send size={18} />
            Отправить заявку
          </>
        )}
      </button>
    </section>
  );
}
