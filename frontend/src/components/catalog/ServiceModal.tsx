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
    // Блокируем скролл без position:fixed (не скачет страница)
    const html = document.documentElement;
    const prevOverflow = html.style.overflow;
    html.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      html.style.overflow = prevOverflow;
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[300] bg-black/60 animate-fade-in"
        onClick={onClose}
        aria-hidden
      />

      {/* Диалог — всегда по центру экрана, на любом устройстве */}
      <div
        role="dialog"
        aria-modal
        aria-label={service.name}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 301,
          width: "min(calc(100vw - 2rem), 480px)",
          maxHeight: "min(88dvh, 88vh)",
          display: "flex",
          flexDirection: "column",
          background: "#fff",
          borderRadius: "16px",
          boxShadow: "0 24px 80px rgba(0,0,0,0.22), 0 4px 16px rgba(0,0,0,0.08)",
          animation: "modalPop 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards",
        }}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          style={{
            position: "absolute",
            top: "12px",
            right: "12px",
            zIndex: 10,
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "rgba(0,0,0,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--color-ink-muted)",
            transition: "background 0.15s",
            flexShrink: 0,
          }}
          aria-label="Закрыть"
          onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.1)")}
          onMouseLeave={e => (e.currentTarget.style.background = "rgba(0,0,0,0.06)")}
        >
          <X size={18} />
        </button>

        {/* Image */}
        {service.photo_url ? (
          <div
            style={{
              position: "relative",
              flexShrink: 0,
              overflow: "hidden",
              borderRadius: "16px 16px 0 0",
              background: "var(--color-placeholder-surface)",
            }}
          >
            <img
              src={service.photo_url}
              alt={service.name}
              style={{ width: "100%", display: "block", maxHeight: "260px", objectFit: "cover" }}
            />
            <div style={{ position: "absolute", inset: "0 0 0 0", bottom: 0, height: "48px", background: "linear-gradient(to top, rgba(0,0,0,0.18), transparent)", pointerEvents: "none" }} />
            <span
              style={{
                position: "absolute",
                top: "12px",
                left: "12px",
                borderRadius: "8px",
                background: "#fff",
                padding: "5px 10px",
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--color-ink)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
                letterSpacing: "0.01em",
              }}
            >
              {categoryName}
            </span>
          </div>
        ) : (
          <div
            style={{
              height: "120px",
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "16px 16px 0 0",
              background: "var(--color-placeholder-surface)",
              position: "relative",
            }}
          >
            <ImageIcon size={40} style={{ opacity: 0.2, color: "var(--color-primary)" }} aria-hidden />
            <span
              style={{
                position: "absolute",
                top: "12px",
                left: "12px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.92)",
                padding: "4px 10px",
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--color-ink)",
                boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
              }}
            >
              {categoryName}
            </span>
          </div>
        )}

        {/* Scrollable content */}
        <div style={{ overflowY: "auto", overscrollBehavior: "contain", padding: "20px 20px 8px" }}>
          <h2 style={{ fontFamily: "var(--font-serif)", fontSize: "clamp(1.3rem, 4vw, 1.75rem)", fontWeight: 600, lineHeight: 1.25, color: "var(--color-ink)", paddingRight: "2rem", marginBottom: "12px" }}>
            {service.name}
          </h2>

          {/* Price + Duration */}
          <div style={{ display: "flex", alignItems: "center", gap: "16px", marginBottom: "16px" }}>
            <span style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--color-primary)", fontVariantNumeric: "tabular-nums" }}>
              {formatPrice(service.price)}
            </span>
            <div style={{ width: "1px", height: "16px", background: "var(--color-border-muted)" }} />
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: "var(--color-ink-muted)" }}>
              <Clock size={14} strokeWidth={2} style={{ color: "var(--color-primary)", flexShrink: 0 }} />
              {formatDuration(service.duration_minutes)}
            </div>
          </div>

          {/* Description */}
          {service.description && (
            <div style={{ borderRadius: "10px", border: "1px solid var(--color-border-soft)", background: "var(--color-bg)", padding: "12px 14px", display: "flex", flexDirection: "column", gap: "6px", marginBottom: "16px" }}>
              {renderDescription(service.description)}
            </div>
          )}

          {/* CTA */}
          <button
            type="button"
            onClick={handleAdd}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              borderRadius: "10px",
              padding: "15px 0",
              fontSize: "15px",
              fontWeight: 700,
              color: "#fff",
              background: inCart ? "#1c1917" : "var(--color-primary)",
              boxShadow: "0 6px 20px color-mix(in srgb, var(--color-primary) 30%, transparent)",
              transition: "transform 0.15s, background 0.2s",
              marginBottom: "4px",
            }}
            onMouseDown={e => (e.currentTarget.style.transform = "scale(0.98)")}
            onMouseUp={e => (e.currentTarget.style.transform = "scale(1)")}
            onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")}
          >
            {inCart ? (
              <>
                <Check size={19} strokeWidth={2.5} />
                Добавить ещё
              </>
            ) : (
              <>
                <Plus size={19} strokeWidth={2.5} />
                Добавить в запись
              </>
            )}
          </button>

          {/* Safe area iOS */}
          <div style={{ height: "max(12px, env(safe-area-inset-bottom, 12px))" }} />
        </div>
      </div>

      <style>{`
        @keyframes modalPop {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.88); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
      `}</style>
    </>
  );
}
