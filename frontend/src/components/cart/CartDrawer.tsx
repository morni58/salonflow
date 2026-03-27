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
        className="fixed inset-0 z-[200] bg-ink-dark/40 backdrop-blur-sm transition-opacity duration-300"
        style={{
          opacity: open ? 1 : 0,
          pointerEvents: open ? "auto" : "none",
        }}
        onClick={onClose}
        aria-hidden={!open}
      />

      <div
        className="fixed top-0 right-0 z-[200] flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col bg-surface shadow-2xl transition-transform duration-500 ease-in-out"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-brand-100 bg-base px-5 py-4 md:px-6 md:py-5">
          <h2 className="font-serif flex items-center gap-2 text-xl font-semibold text-ink md:text-2xl">
            <ShoppingBag className="h-5 w-5 text-brand-500 md:h-6 md:w-6" strokeWidth={2} />
            Ваша запись
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="-mr-2 rounded-lg p-2 text-ink-muted transition-colors hover:bg-brand-50 hover:text-brand-500 active:scale-95"
            aria-label="Закрыть"
          >
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
          {items.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl"
                style={{ background: "var(--color-primary-muted)" }}
              >
                <ShoppingBag className="h-9 w-9" strokeWidth={1.5} style={{ color: "var(--color-primary)" }} aria-hidden />
              </div>
              <p className="font-serif text-lg font-semibold text-ink">Список пуст</p>
              <p className="max-w-[200px] text-sm text-ink-muted opacity-70">Добавьте услуги из каталога, чтобы записаться</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <div
                  key={item.service.id}
                  className="flex flex-col gap-3 rounded-xl border border-brand-50 bg-white p-3"
                >
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 pr-1">
                      <h3
                        className="font-serif text-sm font-semibold leading-snug text-ink md:text-base"
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {item.service.name}
                      </h3>
                      <p className="mt-1 text-xs text-ink-muted">{formatDuration(item.service.duration_minutes)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.service.id)}
                      className="shrink-0 rounded-lg p-1.5 text-ink-muted transition-colors hover:bg-red-50 hover:text-red-500"
                      aria-label="Удалить"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 rounded-lg border border-brand-100 bg-brand-50/50 p-0.5">
                      <button
                        type="button"
                        onClick={() => setQuantity(item.service.id, item.quantity - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-white hover:text-ink"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="min-w-[1.75rem] text-center text-sm font-semibold text-ink">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.service.id, item.quantity + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-white hover:text-ink"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                    <span
                      className="font-bold tabular-nums"
                      style={{ color: "var(--color-primary)" }}
                    >
                      {formatPrice(item.service.price * item.quantity)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-brand-100 bg-base p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6">
            <div className="mb-4 flex items-center justify-between md:mb-6">
              <span className="text-sm font-medium text-ink-light md:text-base">Итого:</span>
              <span className="font-serif text-xl font-bold text-brand-600 md:text-2xl">{formatPrice(totalPrice)}</span>
            </div>
            <p className="mb-4 text-center text-xs text-ink-light opacity-70">{formatDuration(totalDuration)}</p>
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm("Очистить всю корзину?")) clearCart();
                }}
                className="text-sm text-red-400/90 transition-colors hover:text-red-500"
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-px active:scale-[0.97] min-h-[44px]"
              style={{ background: "var(--color-primary)", boxShadow: "0 4px 16px rgba(192,137,115,0.35)" }}
            >
              Оформить запись
            </button>
          </div>
        )}
      </div>
    </>
  );
}
