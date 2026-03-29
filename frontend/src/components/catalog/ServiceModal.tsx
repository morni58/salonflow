import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Clock, Check, Plus, ImageIcon } from "lucide-react";
import type { Service } from "../../types";
import { formatPrice, formatDuration } from "../../utils";
import { lockBodyScroll } from "../../utils/bodyScrollLock";
import { useCart } from "../../store/cartStore";
import { toast } from "../common/Toast";
import { MediaFrame } from "../common/MediaFrame";

interface Props {
  service: Service;
  categoryName: string;
  onClose: () => void;
}

const TOAST_ADD = { duration: 2000 };

export function ServiceModal({ service, categoryName, onClose }: Props) {
  const { addItem, items } = useCart();
  const inCart = items.some((i) => i.service.id === service.id);

  useEffect(() => {
    const unlock = lockBodyScroll();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      unlock();
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const handleAdd = () => {
    addItem(service);
    toast.success(`${service.name} добавлено в корзину`, TOAST_ADD);
    onClose();
  };

  const renderDescription = (text: string) => {
    const lines = text.split(/\n+/).filter((l) => l.trim());
    return lines.map((line, i) => {
      const trimmed = line.trim();
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

  return createPortal(
    <>
      {/* Центрирование в видимой области окна — всегда по центру экрана, не обрезается секцией */}
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4"
        role="presentation"
      >
        <div
          className="absolute inset-0 cursor-default bg-black/60 animate-fade-in"
          onClick={onClose}
          role="presentation"
        />

        <div
          role="dialog"
          aria-modal
          aria-label={service.name}
          className="relative z-[301] flex w-full max-w-[min(100%,480px)] max-h-[min(92dvh,880px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl animate-fade-in"
          style={{
            boxShadow: "0 24px 80px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.08)",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-xl bg-black/[0.06] text-ink-muted transition-colors hover:bg-black/10"
            aria-label="Закрыть"
          >
            <X size={20} strokeWidth={2} />
          </button>

          {service.photo_url ? (
            <div
              className="relative min-h-[120px] w-full shrink-0 overflow-hidden rounded-t-2xl"
              style={{ background: "var(--color-placeholder-surface)" }}
            >
              <MediaFrame
                src={service.photo_url}
                alt={service.name}
                className="w-full justify-center py-1"
                imgClassName="max-h-[min(40vh,260px)] w-auto max-w-full object-contain"
                loading="eager"
              />
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/20 to-transparent" />
              <span
                className="absolute left-3 top-3 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-sm"
                style={{ letterSpacing: "0.01em" }}
              >
                {categoryName}
              </span>
            </div>
          ) : (
            <div
              className="relative flex h-[120px] shrink-0 items-center justify-center rounded-t-2xl"
              style={{ background: "var(--color-placeholder-surface)" }}
            >
              <ImageIcon size={44} className="opacity-20" style={{ color: "var(--color-primary)" }} aria-hidden />
              <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-ink shadow-sm">
                {categoryName}
              </span>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-2 pt-5">
            <h2
              className="mb-3 pr-10 font-serif text-[clamp(1.25rem,4vw,1.75rem)] font-semibold leading-snug text-ink"
            >
              {service.name}
            </h2>

            <div className="mb-4 flex flex-wrap items-center gap-4">
              <span className="text-2xl font-bold tabular-nums" style={{ color: "var(--color-primary)" }}>
                {formatPrice(service.price)}
              </span>
              <div className="h-4 w-px bg-[var(--color-border-muted)]" />
              <div className="flex items-center gap-2 text-sm text-ink-muted">
                <Clock size={16} strokeWidth={2} className="shrink-0 text-[var(--color-primary)]" />
                {formatDuration(service.duration_minutes)}
              </div>
            </div>

            {service.description && (
              <div
                className="mb-4 flex flex-col gap-1.5 rounded-xl border border-[var(--color-border-soft)] bg-[var(--color-bg)] px-4 py-3"
              >
                {renderDescription(service.description)}
              </div>
            )}

            <button
              type="button"
              onClick={handleAdd}
              className="mb-2 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-xl py-4 text-base font-bold text-white transition-transform active:scale-[0.98]"
              style={{
                background: inCart ? "#1c1917" : "var(--color-primary)",
                boxShadow: "0 6px 20px color-mix(in srgb, var(--color-primary) 30%, transparent)",
              }}
            >
              {inCart ? (
                <>
                  <Check size={22} strokeWidth={2.5} />
                  Добавить ещё
                </>
              ) : (
                <>
                  <Plus size={22} strokeWidth={2.5} />
                  Добавить в запись
                </>
              )}
            </button>

            <div className="h-[max(12px,env(safe-area-inset-bottom))]" />
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}
