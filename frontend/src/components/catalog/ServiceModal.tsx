import { useEffect } from "react";
import { X, Clock, Check, Plus, ImageIcon } from "lucide-react";
import type { Service } from "../../types";
import { formatPrice, formatDuration } from "../../utils";
import { useCart } from "../../store/cartStore";
import { toast } from "../common/Toast";

interface Props {
  service: Service;
  categoryName: string;
  onClose: () => void;
}

export function ServiceModal({ service, categoryName, onClose }: Props) {
  const { addItem, items } = useCart();
  const inCart = items.some((i) => i.service.id === service.id);

  useEffect(() => {
    // iOS-совместимая блокировка скролла: body фиксируем, запоминаем позицию
    const scrollY = window.scrollY;
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY); // возвращаем на то же место
      document.removeEventListener("keydown", onKey);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = () => {
    addItem(service);
    toast.success(`${service.name} добавлено в корзину`);
    onClose();
  };

  /** Рендерим описание с поддержкой переносов строк */
  const renderDescription = (text: string) => {
    const lines = text.split(/\n+/).filter((l) => l.trim());
    return lines.map((line, i) => {
      const trimmed = line.trim();
      // Маркированный список: строки начинающиеся с -, •, *
      if (/^[-•*]\s/.test(trimmed)) {
        return (
          <li key={i} className="ml-4 list-disc text-sm leading-relaxed text-ink-muted">
            {trimmed.replace(/^[-•*]\s/, "")}
          </li>
        );
      }
      return (
        <p key={i} className="text-sm leading-relaxed text-ink-muted">
          {trimmed}
        </p>
      );
    });
  };

  return (
    <>
      {/* Backdrop — без blur, чтобы контент модалки был четко виден */}
      <div
        className="fixed inset-0 z-[300] bg-black/60 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/*
        Mobile: bottom sheet снизу вверх, max-height 92dvh
        Desktop (sm+): centered dialog, max-width lg
      */}
      <div
        role="dialog"
        aria-modal
        aria-label={service.name}
        className="
          fixed inset-x-0 bottom-0 z-[301]
          flex max-h-[92dvh] flex-col
          rounded-t-[32px] bg-white shadow-2xl
          animate-modal
          sm:inset-auto sm:bottom-auto
          sm:left-1/2 sm:top-1/2
          sm:-translate-x-1/2 sm:-translate-y-1/2
          sm:max-h-[88vh] sm:w-full sm:max-w-lg
          sm:rounded-[28px]
        "
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/5 text-ink-muted transition-colors hover:bg-black/10 hover:text-ink"
          aria-label="Закрыть"
        >
          <X size={18} />
        </button>

        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="h-1 w-10 rounded-full" style={{ background: "var(--color-border-muted)" }} aria-hidden />
        </div>

        {/* Image */}
        {service.photo_url ? (
          <div
            className="relative shrink-0 overflow-hidden mx-4 mt-2 rounded-2xl sm:mx-0 sm:mt-0 sm:rounded-t-[28px] sm:rounded-b-none"
            style={{ background: "var(--color-placeholder-surface)" }}
          >
            <img
              src={service.photo_url}
              alt={service.name}
              className="w-full object-cover"
              style={{ maxHeight: "clamp(200px, 42vh, 340px)", display: "block" }}
            />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />
            <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-ink shadow-sm backdrop-blur-sm">
              {categoryName}
            </span>
          </div>
        ) : (
          <div
            className="flex h-36 shrink-0 items-center justify-center rounded-t-[28px] relative"
            style={{ background: "var(--color-placeholder-surface)" }}
          >
            <ImageIcon size={48} className="opacity-20" style={{ color: "var(--color-primary)" }} aria-hidden />
            <span className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-ink shadow-sm">
              {categoryName}
            </span>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex flex-col gap-4 overflow-y-auto overscroll-contain p-5 sm:p-6">
          {/* Title */}
          <h2 className="font-serif text-2xl font-semibold leading-snug text-ink sm:text-3xl pr-8">
            {service.name}
          </h2>

          {/* Price + Duration */}
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--color-primary)" }}>
              {formatPrice(service.price)}
            </span>
            <div className="h-4 w-px" style={{ background: "var(--color-border-muted)" }} />
            <div className="flex items-center gap-1.5 text-sm text-ink-muted">
              <Clock size={15} strokeWidth={2} style={{ color: "var(--color-primary)" }} className="shrink-0" />
              {formatDuration(service.duration_minutes)}
            </div>
          </div>

          {/* Description — красивое форматирование (поддержка \n и списков) */}
          {service.description && (
            <div className="rounded-2xl border p-4 space-y-1.5" style={{ borderColor: "var(--color-border-soft)", background: "var(--color-bg)" }}>
              {renderDescription(service.description)}
            </div>
          )}

          {/* CTA */}
          <button
            type="button"
            onClick={handleAdd}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-base font-bold text-white shadow-lg transition-all duration-200 active:scale-[0.98]"
            style={{ background: inCart ? "#1c1917" : "var(--color-primary)", boxShadow: "0 8px 24px color-mix(in srgb, var(--color-primary) 35%, transparent)" }}
          >
            {inCart ? (
              <>
                <Check size={20} strokeWidth={2.5} />
                Добавить ещё
              </>
            ) : (
              <>
                <Plus size={20} strokeWidth={2.5} />
                Добавить в запись
              </>
            )}
          </button>
        </div>

        {/* Safe area bottom padding (iOS) */}
        <div className="shrink-0 sm:hidden" style={{ height: "env(safe-area-inset-bottom, 12px)" }} />
      </div>
    </>
  );
}
