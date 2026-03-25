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
    setTimeout(() => setAdded(false), 600);
  };

  return (
    <div className="service-card-poca group flex min-w-0 flex-col overflow-hidden rounded-3xl bg-surface shadow-soft ring-1 ring-black/[0.04] md:rounded-[2rem]">
      <div className="relative h-48 w-full shrink-0 overflow-hidden md:h-56">
        {service.photo_url ? (
          <>
            <img
              src={service.photo_url}
              alt={service.name}
              className="h-full w-full object-cover transition-transform duration-700 md:group-hover:scale-110"
              loading="lazy"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 transition-opacity duration-300 md:group-hover:opacity-100" />
          </>
        ) : (
          <div
            className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center"
            style={{ background: "var(--color-placeholder-surface)" }}
          >
            <ImageIcon className="opacity-35" size={40} style={{ color: "var(--color-primary)" }} aria-hidden />
            <span className="text-xs opacity-50" style={{ color: "var(--color-text)" }}>
              Фото появится позже
            </span>
          </div>
        )}
        <span className="absolute top-4 left-4 rounded-full bg-white/90 px-3 py-1 text-[10px] font-semibold tracking-wide text-ink uppercase backdrop-blur md:text-xs">
          {categoryName}
        </span>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col p-5 md:p-6">
        <h3
          className="font-serif line-clamp-3 text-xl font-semibold leading-snug text-ink-dark md:text-2xl"
          style={{ overflowWrap: "anywhere" }}
        >
          {service.name}
        </h3>

        <div className="mt-2 mb-5 flex items-center gap-2 text-xs text-ink-light md:mb-6 md:text-sm">
          <Clock size={16} className="shrink-0 text-brand-500" />
          {formatDuration(service.duration_minutes)}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-brand-50 pt-4">
          <span className="text-lg font-semibold tabular-nums text-brand-600 md:text-xl">{formatPrice(service.price)}</span>
          <button
            type="button"
            onClick={handleAdd}
            title={inCart ? "Ещё" : "Добавить в корзину"}
            aria-label={inCart ? "Добавить ещё" : "Добавить в корзину"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-colors duration-300 hover:bg-brand-500 hover:text-white active:scale-95 md:h-12 md:w-12"
            style={
              added
                ? { background: "var(--tenant-primary, #c39077)", color: "#fff" }
                : undefined
            }
          >
            {added ? (
              <Check size={20} className="animate-[bounceIn_0.35s_ease]" strokeWidth={2.5} />
            ) : (
              <Plus size={20} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
