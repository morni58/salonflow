import { Clock, Check, ImageIcon } from "lucide-react";
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
    toast.success(`${service.name} добавлено`);
    setTimeout(() => setAdded(false), 800);
  };

  return (
    <div
      className="hover-lift group flex flex-col overflow-hidden rounded-[30px] border border-black/5 bg-white cursor-pointer"
      style={{ padding: "8px" }}
      onClick={() => onView?.(service)}
      role={onView ? "button" : undefined}
      tabIndex={onView ? 0 : undefined}
      onKeyDown={onView ? (e) => { if (e.key === "Enter" || e.key === " ") onView(service); } : undefined}
      aria-label={onView ? `Подробнее: ${service.name}` : undefined}
    >
      {/* Image */}
      <div
        className="relative w-full shrink-0 overflow-hidden rounded-[24px] aspect-square"
        style={{ background: "var(--color-placeholder-surface)" }}
      >
        {service.photo_url ? (
          <img
            src={service.photo_url}
            alt={service.name}
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageIcon className="opacity-20" size={40} style={{ color: "var(--color-primary)" }} aria-hidden />
          </div>
        )}
        {/* Category badge — прямые скруглённые углы, жирный шрифт */}
        <span className="absolute top-3 left-3 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-sm" style={{ letterSpacing: "0.01em" }}>
          {categoryName}
        </span>
        {/* In-cart indicator */}
        {inCart && (
          <span className="absolute top-3 right-3 flex items-center gap-1 rounded-lg bg-ink text-white text-xs font-bold px-2.5 py-1.5">
            <Check size={10} strokeWidth={3} />
            {cartItem && cartItem.quantity > 1 ? `×${cartItem.quantity}` : "В записи"}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col px-5 pb-5 pt-4">
        {/* Name */}
        <h3
          className="text-xl font-bold leading-snug text-ink mb-1"
          style={{ overflowWrap: "anywhere" }}
        >
          {service.name}
        </h3>
        {/* Price — крупный, стабильный, без italic */}
        <div className="mb-2">
          <span
            className="text-lg font-bold tabular-nums"
            style={{ color: "var(--color-primary)" }}
          >
            {formatPrice(service.price)}
          </span>
        </div>

        {/* Description */}
        {service.description ? (
          <p className="text-xs text-ink-muted opacity-50 line-clamp-2 mb-4" style={{ lineHeight: 1.5 }}>
            {service.description}
          </p>
        ) : (
          <div className="mb-4" />
        )}

        {/* Duration badge */}
        <div className="mb-5 flex items-center gap-1.5 text-xs font-medium w-fit rounded-lg px-3 py-1.5" style={{ background: "var(--color-primary-muted)", color: "var(--color-primary)" }}>
          <Clock size={13} strokeWidth={2} className="shrink-0" aria-hidden />
          {formatDuration(service.duration_minutes)}
        </div>

        {/* Add button — крупнее, прямоугольный */}
        <button
          type="button"
          onClick={handleAdd}
          aria-label={inCart ? "Добавить ещё" : "Добавить в запись"}
          className={[
            "mt-auto w-full py-4 rounded-xl text-sm font-semibold transition-all duration-200 active:scale-[0.97]",
            added || inCart
              ? "bg-ink text-white"
              : "bg-black/5 text-ink hover:bg-black hover:text-white",
          ].join(" ")}
        >
          {added ? "Добавлено ✓" : inCart ? "Добавить ещё" : "Добавить в запись"}
        </button>
      </div>
    </div>
  );
}
