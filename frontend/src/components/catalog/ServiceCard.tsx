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
    <div className="service-card-poca group flex min-w-0 flex-col overflow-hidden rounded-[2rem] border border-brand-50 bg-base">
      <div className="relative h-48 w-full shrink-0 overflow-hidden bg-brand-100 md:h-56">
        {service.photo_url ? (
          <img
            src={service.photo_url}
            alt={service.name}
            className="h-full w-full object-cover transition-transform duration-700 md:group-hover:scale-105"
            loading="lazy"
          />
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
        <span className="absolute top-4 left-4 rounded-md bg-white/90 px-3 py-1 text-[10px] font-semibold tracking-wider text-ink uppercase shadow-sm backdrop-blur">
          {categoryName}
        </span>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-white p-5 md:p-6">
        <h3
          className="font-serif line-clamp-3 text-xl font-semibold leading-snug text-ink md:text-2xl"
          style={{ overflowWrap: "anywhere" }}
        >
          {service.name}
        </h3>

        <div className="mt-2 mb-4 flex w-fit items-center gap-2 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-500 md:mb-6">
          <Clock size={14} className="shrink-0" strokeWidth={2} />
          {formatDuration(service.duration_minutes)}
        </div>

        <div className="mt-auto flex items-center justify-between border-t border-brand-50 pt-4">
          <span className="text-lg font-bold tabular-nums text-ink md:text-xl">{formatPrice(service.price)}</span>
          <button
            type="button"
            onClick={handleAdd}
            title={inCart ? "Ещё" : "Добавить в корзину"}
            aria-label={inCart ? "Добавить ещё" : "Добавить в корзину"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-brand-100 bg-base text-ink transition-colors duration-300 hover:bg-brand-500 hover:text-white active:scale-95 md:h-12 md:w-12"
            style={
              added
                ? { background: "var(--tenant-primary, #c08973)", color: "#fff" }
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
