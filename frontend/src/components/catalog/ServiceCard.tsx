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
      className="group flex flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white p-2 transition-all duration-300 hover:-translate-y-1 cursor-pointer"
      style={{ boxShadow: "none", transition: "transform 0.3s ease, box-shadow 0.3s ease" }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "0 12px 40px rgba(54,49,47,0.08)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
      onClick={() => onView?.(service)}
      role={onView ? "button" : undefined}
      tabIndex={onView ? 0 : undefined}
      onKeyDown={onView ? (e) => { if (e.key === "Enter" || e.key === " ") onView(service); } : undefined}
      aria-label={onView ? `Подробнее: ${service.name}` : undefined}
    >
      {/* Image container */}
      <div
        className="relative w-full shrink-0 overflow-hidden rounded-[22px]"
        style={{ aspectRatio: "4/3", background: "var(--color-placeholder-surface)" }}
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
            <ImageIcon className="opacity-20" size={32} style={{ color: "var(--color-primary)" }} aria-hidden />
          </div>
        )}
        {/* In-cart indicator */}
        {inCart && (
          <span className="absolute top-2 right-2 flex items-center gap-1 rounded-lg bg-ink text-white text-[8px] font-bold uppercase tracking-widest px-2 py-1">
            <Check size={8} strokeWidth={3} />
            {cartItem && cartItem.quantity > 1 ? `×${cartItem.quantity}` : "В записи"}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col px-4 pb-4 pt-3">
        <h3
          className="font-serif text-lg font-bold leading-snug text-ink line-clamp-2"
          style={{ overflowWrap: "anywhere" }}
        >
          {service.name}
        </h3>

        {/* Duration */}
        <div className="mt-1 flex items-center gap-1 text-[9px] font-bold uppercase tracking-widest opacity-35">
          <Clock size={10} strokeWidth={2} className="shrink-0" aria-hidden />
          {formatDuration(service.duration_minutes)}
        </div>

        {service.description && (
          <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-ink-muted">
            {service.description}
          </p>
        )}

        {/* Price + CTA */}
        <div className="mt-auto pt-4 flex items-center justify-between gap-2">
          <span
            className="font-serif italic text-xl"
            style={{ color: "var(--color-primary)" }}
          >
            {formatPrice(service.price)}
          </span>

          <button
            type="button"
            onClick={handleAdd}
            aria-label={inCart ? "Добавить ещё" : "Добавить в запись"}
            className={[
              "shrink-0 rounded-2xl px-4 py-2.5 text-[9px] md:text-[10px] font-bold uppercase tracking-widest transition-all duration-200 active:scale-95",
              added || inCart
                ? "bg-ink text-white"
                : "bg-black/5 text-ink/60 hover:bg-ink hover:text-white",
            ].join(" ")}
          >
            {added ? "Добавлено" : inCart ? "Ещё раз" : "Добавить"}
          </button>
        </div>
      </div>
    </div>
  );
}
