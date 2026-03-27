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

export function ServiceCard({ service, categoryName, onView }: Props) {
  const { addItem, items } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = items.some((i) => i.service.id === service.id);
  const cartItem = items.find((i) => i.service.id === service.id);

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    addItem(service);
    setAdded(true);
    toast.success(`${service.name} добавлено в корзину`);
    setTimeout(() => setAdded(false), 700);
  };

  const handleCardClick = () => {
    if (onView) onView(service);
  };

  return (
    <div
      className="service-card-poca group flex min-w-0 flex-col overflow-hidden rounded-2xl sm:rounded-[2rem] border border-brand-100 bg-white shadow-soft transition-shadow duration-300 hover:shadow-float cursor-pointer"
      onClick={handleCardClick}
      role={onView ? "button" : undefined}
      tabIndex={onView ? 0 : undefined}
      onKeyDown={onView ? (e) => { if (e.key === "Enter" || e.key === " ") handleCardClick(); } : undefined}
      aria-label={onView ? `Подробнее: ${service.name}` : undefined}
    >
      {/* Image */}
      <div className="relative h-36 w-full shrink-0 overflow-hidden bg-brand-100 sm:h-52 md:h-60">
        {service.photo_url ? (
          <img
            src={service.photo_url}
            alt={service.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]"
            loading="lazy"
          />
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2"
            style={{ background: "var(--color-placeholder-surface)" }}
          >
            <ImageIcon className="opacity-25" size={36} style={{ color: "var(--color-primary)" }} aria-hidden />
          </div>
        )}

        {/* Gradient overlay bottom */}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/20 to-transparent" />

        {/* Category badge */}
        <span className="absolute top-2 left-2 rounded-md bg-white/92 px-2 py-0.5 text-[9px] font-semibold tracking-widest text-ink uppercase shadow-sm backdrop-blur-sm sm:top-3 sm:left-3 sm:px-2.5 sm:py-1 sm:text-[10px]">
          {categoryName}
        </span>

        {/* In-cart badge */}
        {inCart && (
          <span
            className="absolute top-2 right-2 flex items-center gap-0.5 rounded-md px-2 py-0.5 text-[9px] font-bold text-white shadow-sm sm:top-3 sm:right-3 sm:gap-1 sm:px-2.5 sm:py-1 sm:text-[10px]"
            style={{ background: "var(--color-primary)" }}
          >
            <Check size={9} strokeWidth={3} />
            {cartItem && cartItem.quantity > 1 ? `×${cartItem.quantity}` : "В записи"}
          </span>
        )}

        {/* Duration chip */}
        <div className="absolute bottom-2 left-2 flex items-center gap-1 rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-medium text-ink-muted shadow-sm backdrop-blur-sm sm:bottom-3 sm:left-3 sm:gap-1.5 sm:px-2.5 sm:py-1 sm:text-xs">
          <Clock size={10} strokeWidth={2} className="shrink-0 text-brand-500" />
          {formatDuration(service.duration_minutes)}
        </div>
      </div>

      {/* Content */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-3 sm:p-5 md:p-6">
        <h3
          className="font-serif line-clamp-2 text-base font-semibold leading-snug text-ink sm:text-xl sm:line-clamp-3 md:text-2xl"
          style={{ overflowWrap: "anywhere" }}
        >
          {service.name}
        </h3>

        {service.description && (
          <p className="mt-1 line-clamp-1 text-[11px] text-ink-muted sm:mt-1.5 sm:line-clamp-2 sm:text-xs">
            {service.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-3 border-t border-brand-50 sm:pt-5">
          <div>
            <p className="hidden text-[11px] font-medium uppercase tracking-wider text-ink-light opacity-70 sm:block">Стоимость</p>
            <span
              className="text-base font-bold tabular-nums tracking-tight sm:text-xl md:text-2xl"
              style={{ color: "var(--color-primary)" }}
            >
              {formatPrice(service.price)}
            </span>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            title={inCart ? "Добавить ещё" : "Добавить в корзину"}
            aria-label={inCart ? "Добавить ещё" : "Добавить в корзину"}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all duration-300 active:scale-95 sm:h-11 sm:w-11 md:h-12 md:w-12 sm:rounded-xl"
            style={
              added
                ? { background: "var(--color-primary)", color: "#fff", borderColor: "transparent" }
                : inCart
                ? { background: "var(--color-primary-muted)", color: "var(--color-primary)", borderColor: "var(--color-primary-20)" }
                : { background: "var(--color-bg)", color: "var(--color-text)", borderColor: "var(--color-border-muted)" }
            }
          >
            {added ? (
              <Check size={18} className="animate-[bounceIn_0.35s_ease]" strokeWidth={2.5} />
            ) : (
              <Plus size={18} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
