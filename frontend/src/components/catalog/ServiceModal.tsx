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
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const handleAdd = () => {
    addItem(service);
    toast.success(`${service.name} добавлено в корзину`);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[300] bg-ink-dark/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/*
        Mobile: bottom sheet slides up from bottom, max-height 92dvh
        Desktop (sm+): centered dialog, max-width lg, max-height 88vh
      */}
      <div
        role="dialog"
        aria-modal
        aria-label={service.name}
        className="
          fixed inset-x-0 bottom-0 z-[301]
          flex max-h-[92dvh] flex-col
          rounded-t-3xl bg-surface shadow-2xl
          animate-modal
          sm:inset-auto sm:bottom-auto
          sm:left-1/2 sm:top-1/2
          sm:-translate-x-1/2 sm:-translate-y-1/2
          sm:max-h-[88vh] sm:w-full sm:max-w-lg
          sm:rounded-3xl
        "
      >
        {/* Close button — always visible */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 rounded-full bg-white/90 p-2 text-ink-muted shadow-sm backdrop-blur-sm transition-colors hover:text-brand-500"
          aria-label="Закрыть"
        >
          <X size={18} />
        </button>

        {/* Drag handle (mobile only) */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden shrink-0">
          <div className="h-1 w-10 rounded-full bg-brand-200" aria-hidden />
        </div>

        {/* Image — object-contain so full photo is visible, no cropping */}
        {service.photo_url ? (
          <div
            className="relative shrink-0 overflow-hidden rounded-t-2xl sm:rounded-t-3xl"
            style={{ background: "var(--color-placeholder-surface)" }}
          >
            <img
              src={service.photo_url}
              alt={service.name}
              className="w-full object-contain"
              style={{ maxHeight: "clamp(180px, 40vh, 320px)", display: "block" }}
            />
            <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />
            <span className="absolute top-3 left-3 rounded-md bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-ink shadow-sm backdrop-blur-sm">
              {categoryName}
            </span>
          </div>
        ) : (
          <div
            className="flex h-32 shrink-0 items-center justify-center rounded-t-2xl sm:h-40 sm:rounded-t-3xl"
            style={{ background: "var(--color-placeholder-surface)" }}
          >
            <ImageIcon size={44} className="opacity-20" style={{ color: "var(--color-primary)" }} aria-hidden />
            <span className="absolute top-3 left-3 rounded-md bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-ink shadow-sm backdrop-blur-sm">
              {categoryName}
            </span>
          </div>
        )}

        {/* Scrollable content */}
        <div className="flex flex-col gap-4 overflow-y-auto overscroll-contain p-5 sm:p-6">
          <div>
            <h2 className="font-serif text-2xl font-semibold leading-snug text-ink sm:text-3xl">
              {service.name}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-sm text-ink-muted">
              <Clock size={15} strokeWidth={2} className="text-brand-500 shrink-0" />
              {formatDuration(service.duration_minutes)}
            </div>
            <div className="h-4 w-px bg-brand-100" />
            <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--color-primary)" }}>
              {formatPrice(service.price)}
            </span>
          </div>

          {service.description && (
            <p className="text-sm leading-relaxed text-ink-muted">{service.description}</p>
          )}

          <button
            type="button"
            onClick={handleAdd}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-semibold text-white shadow-lg transition-all duration-300 active:scale-[0.98] btn-primary-soft"
            style={{ background: "var(--color-primary)", boxShadow: "0 8px 24px color-mix(in srgb, var(--color-primary) 35%, transparent)" }}
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
