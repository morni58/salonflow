import { Toaster, toast } from "sonner";

export { toast };

export function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      toastOptions={{
        style: {
          background: "rgba(255, 255, 255, 0.97)",
          border: "1px solid var(--color-border-muted, rgba(53, 64, 56, 0.12))",
          color: "var(--color-text, #36312d)",
          boxShadow: "var(--shadow-soft-md, 0 8px 32px -6px rgba(30, 55, 42, 0.1))",
          backdropFilter: "blur(12px)",
        },
      }}
      richColors
    />
  );
}
