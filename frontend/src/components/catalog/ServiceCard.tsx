import { Clock, Plus, Check, ImageIcon } from "lucide-react";
import type { Service } from "../../types";
import { formatPrice, formatDuration } from "../../utils";
import { useCart } from "../../store/cartStore";
import { toast } from "../common/Toast";
import { useState } from "react";

export function ServiceCard({ service, categoryName }: { service: Service; categoryName: string }) {
  const { addItem, items } = useCart();
  const [added, setAdded] = useState(false);
  const inCart = items.some((i) => i.service.id === service.id);

  const handleAdd = () => {
    addItem(service);
    setAdded(true);
    toast.success(`${service.name} добавлено в корзину`);
    setTimeout(() => setAdded(false), 650);
  };

  return (
    <div className="service-card-glass group flex min-w-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/[0.05] shadow-soft backdrop-blur-xl md:rounded-3xl">
      <div className="relative h-48 w-full shrink-0 overflow-hidden md:h-56">
        {service.photo_url ? (
          <>
            <img
              src={service.photo_url}
              alt={service.name}
              className="h-full w-full object-cover transition-transform duration-700 md:group-hover:scale-105"
              loading="lazy"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-80" />
          </>
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center"
            style={{ background: "var(--color-placeholder-surface)" }}
          >
            <ImageIcon className="opacity-40" size={40} style={{ color: "var(--color-primary)" }} aria-hidden />
            <span className="text-xs opacity-50" style={{ color: "var(--color-text)" }}>
              Фото появится позже
            </span>
          </div>
        )}
        <span className="absolute top-4 left-4 rounded-full border border-white/15 bg-black/35 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur-md md:text-xs">
          {categoryName}
        </span>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-5 md:p-6">
        <h3
          className="line-clamp-3 text-lg font-bold leading-snug md:text-xl"
          style={{ color: "var(--color-text)", overflowWrap: "anywhere" }}
        >
          {service.name}
        </h3>

        <div className="mt-2 mb-5 flex items-center gap-2 text-xs opacity-75 md:mb-6 md:text-sm" style={{ color: "var(--color-text)" }}>
          <Clock size={16} className="shrink-0" style={{ color: "var(--color-accent)" }} />
          {formatDuration(service.duration_minutes)}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-white/10 pt-4">
          <span className="text-lg font-bold tabular-nums md:text-xl" style={{ color: "var(--color-accent)" }}>
            {formatPrice(service.price)}
          </span>
          <button
            type="button"
            onClick={handleAdd}
            title={inCart ? "Ещё" : "Добавить в корзину"}
            aria-label={inCart ? "Добавить ещё" : "Добавить в корзину"}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 transition-all duration-300 active:scale-95 md:h-12 md:w-12"
            style={
              added
                ? { background: "#22c55e", color: "#ffffff", borderColor: "transparent" }
                : {
                    background: "color-mix(in srgb, var(--color-primary) 25%, transparent)",
                    color: "var(--color-text)",
                  }
            }
          >
            {added ? (
              <Check size={20} className="animate-[bounceIn_0.4s_ease]" strokeWidth={2.5} />
            ) : (
              <Plus size={20} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
