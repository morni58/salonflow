import { X, Minus, Plus, Trash2, ShoppingBag, ImageIcon } from "lucide-react";
import { useCart } from "../../store/cartStore";
import { formatPrice, formatDuration } from "../../utils";
import { useEffect, useState } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  onCheckout: () => void;
}

export function CartDrawer({ open, onClose, onCheckout }: Props) {
  const [confirmClear, setConfirmClear] = useState(false);

  // Блокируем скролл без position:fixed (не скачет страница)
  useEffect(() => {
    const html = document.documentElement;
    if (open) {
      const prevOverflow = html.style.overflow;
      html.style.overflow = "hidden";
      return () => { html.style.overflow = prevOverflow; };
    }
  }, [open]);

  // Закрыть подтверждение очистки при закрытии дровера
  useEffect(() => { if (!open) setConfirmClear(false); }, [open]);

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
        className="fixed top-0 right-0 z-[200] flex h-[100dvh] max-h-[100dvh] w-full max-w-md flex-col bg-white shadow-2xl transition-transform duration-500 ease-in-out"
        style={{
          transform: open ? "translateX(0)" : "translateX(100%)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        aria-hidden={!open}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 md:px-6 md:py-5"
          style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", background: "var(--color-bg, #faf9f7)" }}
        >
          <div>
            <h2 className="font-serif text-xl font-bold text-ink">Ваша запись</h2>
            <p className="text-[9px] font-bold uppercase tracking-widest opacity-40 mt-0.5">
              {items.length === 0 ? "Корзина пуста" : `${items.length} услуг`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-9 h-9 rounded-xl border border-black/8 bg-white text-ink/50 hover:text-ink transition-colors"
            aria-label="Закрыть"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto p-4 md:p-6">
          {items.length === 0 ? (
            <div className="step-slide-up flex flex-1 flex-col items-center justify-center gap-3 text-center">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-2xl"
                style={{ background: "var(--color-primary-muted)" }}
              >
                <ShoppingBag className="h-9 w-9" strokeWidth={1.5} style={{ color: "var(--color-primary)" }} aria-hidden />
              </div>
              <p className="font-serif text-lg font-bold text-ink">Список пуст</p>
              <p className="max-w-[200px] text-sm text-ink-muted opacity-70">Добавьте услуги из каталога, чтобы записаться</p>
            </div>
          ) : (
            <div className="step-slide-up flex flex-col gap-2">
              {items.map((item) => (
                <div
                  key={item.service.id}
                  className="flex flex-col gap-3 rounded-2xl p-4"
                  style={{ background: "#f8f7f5", border: "1px solid rgba(0,0,0,0.05)" }}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {/* Миниатюра товара */}
                    <div className="shrink-0 h-16 w-16 rounded-xl overflow-hidden" style={{ background: "var(--color-placeholder-surface)" }}>
                      {item.service.photo_url ? (
                        <img
                          src={item.service.photo_url}
                          alt={item.service.name}
                          className="h-full w-full object-cover"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <ImageIcon size={20} className="opacity-25" style={{ color: "var(--color-primary)" }} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3
                        className="font-serif text-sm font-bold leading-snug text-ink md:text-base"
                        style={{ overflowWrap: "anywhere" }}
                      >
                        {item.service.name}
                      </h3>
                      <p className="mt-1 text-[9px] font-bold uppercase tracking-widest opacity-35">
                        {formatDuration(item.service.duration_minutes)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.service.id)}
                      className="shrink-0 flex items-center justify-center w-7 h-7 rounded-lg text-ink/30 transition-colors hover:bg-red-50 hover:text-red-400"
                      aria-label="Удалить"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 rounded-xl border border-black/8 bg-white p-0.5">
                      <button
                        type="button"
                        onClick={() => setQuantity(item.service.id, item.quantity - 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-ink/50 transition-colors hover:bg-black/5 hover:text-ink"
                      >
                        <Minus size={12} />
                      </button>
                      <span className="min-w-[1.75rem] text-center text-sm font-bold text-ink">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => setQuantity(item.service.id, item.quantity + 1)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-ink/50 transition-colors hover:bg-black/5 hover:text-ink"
                      >
                        <Plus size={12} />
                      </button>
                    </div>
                    <span
                      className="font-serif italic text-lg font-bold tabular-nums"
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
          <div
            className="p-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:p-6"
            style={{ borderTop: "1px solid rgba(0,0,0,0.06)", background: "var(--color-bg, #faf9f7)" }}
          >
            <div className="mb-4 flex items-center justify-between md:mb-5">
              <div>
                <span className="text-[9px] font-bold uppercase tracking-widest opacity-35 block">Итого</span>
                <span
                  className="font-serif italic text-2xl font-bold"
                  style={{ color: "var(--color-primary)" }}
                >
                  {formatPrice(totalPrice)}
                </span>
              </div>
              <p className="text-xs text-ink-muted opacity-60">{formatDuration(totalDuration)}</p>
            </div>

            <div className="mb-3 flex items-center justify-end gap-3">
              {confirmClear ? (
                <>
                  <span className="text-xs text-ink-muted opacity-70">Точно очистить?</span>
                  <button
                    type="button"
                    onClick={() => { clearCart(); setConfirmClear(false); }}
                    className="text-xs font-semibold text-red-500 transition-colors hover:text-red-600"
                  >
                    Да, очистить
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="text-xs font-medium text-ink-muted transition-colors hover:text-ink"
                  >
                    Отмена
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  className="text-xs font-medium text-red-400/70 transition-colors hover:text-red-500"
                >
                  Очистить всё
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onCheckout();
              }}
              className="btn-ink w-full justify-center"
            >
              Оформить запись
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </>
  );
}
