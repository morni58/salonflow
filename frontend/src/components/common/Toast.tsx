import { Toaster, toast } from "sonner";

export { toast };

/** Короткие тосты снизу справа (выше плавающей корзины), не перекрывают центр экрана. */
export function ToastProvider() {
  return (
    <Toaster
      position="bottom-right"
      className="!bottom-[5.25rem] !right-4 sm:!bottom-28 !z-[400]"
      duration={2200}
      toastOptions={{
        duration: 2200,
        style: {
          background: "rgba(255, 255, 255, 0.97)",
          border: "1px solid var(--color-border-muted, rgba(53, 64, 56, 0.12))",
          color: "var(--color-text, #36312d)",
          boxShadow: "var(--shadow-soft-md, 0 8px 32px -6px rgba(30, 55, 42, 0.1))",
          backdropFilter: "blur(12px)",
          fontSize: "14px",
          padding: "14px 16px",
        },
      }}
      richColors
      closeButton
    />
  );
}
