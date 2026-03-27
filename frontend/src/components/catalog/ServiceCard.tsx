import { Clock, Plus, Check, ImageIcon } from "lucide-react";
import type { Service } from "../../types";
import { formatPrice, formatDuration } from "../../utils";
import { useCart } from "../../store/cartStore";
import { toast } from "../common/Toast";
import { useState } from "react";

interface Props {
  service: Service;
  categoryName: string;
  onView?: (service: Service) => void;
}

export function ServiceCard({ service, categoryName: _categoryName, onView }: Props) {
  const { addItem, items } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = items.some((i) => i.service.id === service.id);
  const cartItem = items.find((i) => i.service.id === service.id);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem(service);
    setAdded(true);
    toast.success(`${service.name} добавлено`);
    setTimeout(() => setAdded(false), 800);
  };

  return (
    <div
      className="group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-float cursor-pointer"
      onClick={() => onView?.(service)}
      role={onView ? "button" : undefined}
      tabIndex={onView ? 0 : undefined}
      onKeyDown={onView ? (e) => { if (e.key === "Enter" || e.key === " ") onView(service); } : undefined}
      aria-label={onView ? `Подробнее: ${service.name}` : undefined}
    >
      {/* Image */}
      <div className="relative w-full shrink-0 overflow-hidden bg-brand-50" style={{ aspectRatio: "4/3" }}>
        {service.photo_url ? (
          <img
            src={service.photo_url}
            alt={service.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" style={{ background: "var(--color-placeholder-surface)" }}>
            <ImageIcon className="opacity-20" size={32} style={{ color: "var(--color-primary)" }} aria-hidden />
          </div>
        )}
        {/* In-cart indicator */}
        {inCart && (
          <span
            className="absolute right-2 top-2 flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-bold text-white"
            style={{ background: "var(--color-primary)" }}
          >
            <Check size={9} strokeWidth={3} />
            {cartItem && cartItem.quantity > 1 ? `×${cartItem.quantity}` : "Добавлено"}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col p-3 sm:p-4">
        <h3
          className="font-serif line-clamp-2 text-base font-semibold leading-snug text-ink sm:text-lg"
          style={{ overflowWrap: "anywhere" }}
        >
          {service.name}
        </h3>

        {service.description && (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {service.description}
          </p>
        )}

        {/* Duration */}
        <div className="mt-2 flex items-center gap-1 text-xs text-ink-muted">
          <Clock size={11} strokeWidth={2} className="shrink-0" style={{ color: "var(--color-primary)" }} />
          {formatDuration(service.duration_minutes)}
        </div>

        {/* Price + CTA */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-brand-50 pt-3">
          <span
            className="text-lg font-bold tabular-nums leading-none sm:text-xl"
            style={{ color: "var(--color-primary)" }}
          >
            {formatPrice(service.price)}
          </span>

          <button
            type="button"
            onClick={handleAdd}
            aria-label={inCart ? "Добавить ещё" : "Добавить в запись"}
            className={[
              "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.97] sm:px-4 sm:text-sm",
              added || inCart
                ? "text-white"
                : "hover:opacity-90",
            ].join(" ")}
            style={
              added || inCart
                ? { background: "var(--color-primary)", color: "#fff" }
                : { background: "var(--color-primary-muted)", color: "var(--color-primary)" }
            }
          >
            {added ? (
              <Check size={14} strokeWidth={2.5} />
            ) : (
              <Plus size={14} strokeWidth={2.5} />
            )}
            <span className="hidden sm:inline">{added ? "Добавлено" : inCart ? "Ещё раз" : "Добавить"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
