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
        className="fixed inset-0 z-[55] bg-ink-dark/40 backdrop-blur-sm transition-opacity duration-300"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
        aria-hidden={!open}
      />

      <div
        className="fixed top-0 right-0 z-[60] flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-500 ease-in-out"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        aria-hidden={!open}
      >
        <div
          className="flex items-center justify-between border-b border-brand-100 px-5 py-4 md:px-6 md:py-5"
          style={{ background: "var(--color-bg)" }}
        >
          <h2 className="font-serif flex items-center gap-2 text-xl font-semibold text-ink-dark md:text-2xl">
            <ShoppingBag
              className="h-5 w-5 text-brand-500 md:h-6 md:w-6"
              style={{ color: "var(--color-primary)" }}
              strokeWidth={2}
            />
            Ваша запись
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-full p-2 text-ink-light transition-colors hover:bg-brand-50 hover:text-brand-500 active:scale-95"
            aria-label="Закрыть"
          >
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4 md:gap-4 md:p-6">
          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center text-ink-light opacity-60">
              <ShoppingBag className="mb-3 h-14 w-14 text-brand-200 md:mb-4 md:h-16 md:w-16" strokeWidth={1.5} aria-hidden />
              <p className="text-sm md:text-base">Список услуг пуст</p>
            </div>
          ) : (
            items.map((item) => (
              <div
                key={item.service.id}
                className="flex flex-col rounded-xl border border-brand-50 bg-white p-3 shadow-sm md:p-4"
              >
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0 flex-1 pr-1">
                    <h3
                      className="font-serif text-sm font-semibold leading-snug text-ink-dark md:text-base"
                      style={{ overflowWrap: "anywhere" }}
                    >
                      {item.service.name}
                    </h3>
                    <p className="mt-1 text-sm text-ink-light opacity-80">{formatDuration(item.service.duration_minutes)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.service.id)}
                    className="rounded-lg p-2 text-ink-light transition-colors hover:bg-red-50 hover:text-red-500"
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
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-100 transition-colors hover:bg-brand-50"
                    >
                      <Minus size={14} />
                    </button>
                    <span className="w-8 text-center font-medium text-ink-dark">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(item.service.id, item.quantity + 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl border border-brand-100 transition-colors hover:bg-brand-50"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                  <span className="font-semibold tabular-nums text-brand-600" style={{ color: "var(--color-primary)" }}>
                    {formatPrice(item.service.price * item.quantity)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <div
            className="border-t border-brand-100 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6"
            style={{ background: "var(--color-bg)" }}
          >
            <div className="mb-4 flex items-center justify-between md:mb-6">
              <span className="text-sm font-medium text-ink-light md:text-base">Итого:</span>
              <span className="font-serif text-xl font-bold text-brand-600 md:text-2xl" style={{ color: "var(--color-primary)" }}>
                {formatPrice(totalPrice)}
              </span>
            </div>
            <p className="mb-4 text-center text-xs text-ink-light opacity-70">{formatDuration(totalDuration)}</p>
            <div className="mb-3 flex justify-end">
              <button type="button" onClick={clearCart} className="text-sm text-red-400/90 transition-colors hover:text-red-500">
                Очистить
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onCheckout();
              }}
              className="btn-primary-soft w-full rounded-xl py-3.5 text-center text-sm font-medium tracking-wide shadow-lg transition-colors active:scale-[0.98] md:py-4"
              style={{
                background: "var(--color-primary)",
                color: "var(--color-primary-foreground)",
                boxShadow: "0 10px 40px color-mix(in srgb, var(--color-primary) 30%, transparent)",
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
