import { Toaster, toast } from "sonner";

export { toast };

export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: "rgba(15, 23, 42, 0.92)",
          border: "1px solid rgba(255, 255, 255, 0.12)",
          color: "var(--color-text, #f8fafc)",
          boxShadow: "0 16px 48px -8px rgba(0, 0, 0, 0.45)",
          backdropFilter: "blur(12px)",
        },
      }}
      richColors
      theme="dark"
    />
  );
}
