import { X, Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { useCart } from "../../store/cartStore";
import { formatPrice, formatDuration } from "../../utils";

interface Props {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export function CartDrawer({ open, onClose, onCheckout }: Props) {
  const { items, removeItem, setQuantity, totalPrice, totalDuration, clearCart } = useCart();

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-black/55 backdrop-blur-md transition-opacity duration-300"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
        aria-hidden={!open}
      />

      <div
        className="fixed top-0 right-0 z-[60] flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col border-l border-white/10 shadow-2xl transition-transform duration-500 ease-in-out"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          background: "var(--color-bg-elevated)",
        }}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 md:px-6 md:py-5">
          <h2 className="flex items-center gap-2 text-xl font-bold md:text-2xl" style={{ color: "var(--color-text)" }}>
            <ShoppingBag className="h-5 w-5 md:h-6 md:w-6" style={{ color: "var(--color-primary)" }} strokeWidth={2} />
            Ваша запись
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-full p-2 opacity-70 transition-colors hover:bg-white/10 hover:opacity-100"
            style={{ color: "var(--color-text)" }}
            aria-label="Закрыть"
          >
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 md:gap-4 md:p-6">
          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center opacity-50" style={{ color: "var(--color-text)" }}>
              <ShoppingBag className="mb-3 h-14 w-14 md:mb-4 md:h-16 md:w-16" strokeWidth={1.5} aria-hidden />
              <p className="text-sm md:text-base">Список услуг пуст</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.service.id} className="glass flex flex-col rounded-xl p-3 md:p-4">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 pr-1">
                    <h3
                      className="text-sm font-bold leading-snug md:text-base"
                      style={{ color: "var(--color-text)", overflowWrap: "anywhere" }}
                    >
                      {item.service.name}
                    </h3>
                    <p className="mt-1 text-sm opacity-70">{formatDuration(item.service.duration_minutes)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.service.id)}
                    className="rounded-lg p-2 opacity-60 transition-colors hover:bg-red-500/15 hover:text-red-400"
                    style={{ color: "var(--color-text)" }}
                    aria-label="Удалить"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQuantity(item.service.id, item.quantity - 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 transition-colors hover:bg-white/10"
                      style={{ color: "var(--color-text)" }}
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center font-semibold" style={{ color: "var(--color-text)" }}>
                      {item.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(item.service.id, item.quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/15 transition-colors hover:bg-white/10"
                      style={{ color: "var(--color-text)" }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="font-bold tabular-nums" style={{ color: "var(--color-accent)" }}>
                    {formatPrice(item.service.price * item.quantity)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div
            className="border-t border-white/10 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6"
            style={{ background: "var(--color-bg)" }}
          >
            <div className="mb-4 flex items-center justify-between md:mb-6">
              <span className="text-sm font-medium opacity-75 md:text-base" style={{ color: "var(--color-text)" }}>
                Итого:
              </span>
              <span className="text-xl font-bold md:text-2xl" style={{ color: "var(--color-accent)" }}>
                {formatPrice(totalPrice)}
              </span>
            </div>
            <p className="mb-4 text-center text-xs opacity-60" style={{ color: "var(--color-text)" }}>
              {formatDuration(totalDuration)}
            </p>
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={clearCart}
                className="text-sm text-red-400/90 transition-colors hover:text-red-400"
              >
                Очистить
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onCheckout();
              }}
              className="btn-primary-soft w-full rounded-xl py-3.5 text-center text-sm font-semibold tracking-wide shadow-lg transition-transform active:scale-[0.98] md:py-4"
              style={{
                background: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                boxShadow: "0 12px 40px color-mix(in srgb, var(--color-primary) 35%, transparent)",
              }}
            >
              Оформить запись
            </button>
          </div>
        )}
      </div>
    </>
  );
}
