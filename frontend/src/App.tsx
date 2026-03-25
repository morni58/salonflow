import { useState } from "react";
import { useTenant } from "./hooks/useTenant";
import { useSession } from "./hooks/useSession";
import { CartProvider } from "./store/cartStore";
import { Header } from "./components/layout/Header";
import { HeroSection } from "./components/layout/HeroSection";
import { AdvantagesSection } from "./components/layout/AdvantagesSection";
import { CatalogSection } from "./components/catalog/CatalogSection";
import { CartDrawer } from "./components/cart/CartDrawer";
import { CheckoutForm } from "./components/checkout/CheckoutForm";
import { ChatWidget } from "./components/chat/ChatWidget";
import { PortfolioSection } from "./components/portfolio/PortfolioSection";
import { ReviewsSection } from "./components/reviews/ReviewsSection";
import { AnimateIn } from "./components/common/AnimateIn";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { ToastProvider } from "./components/common/Toast";

type View = "home" | "checkout";

function AppInner() {
  const { tenant, loading, error } = useTenant();
  const { sessionId, track } = useSession(tenant?.id);
  const [view, setView] = useState<View>("home");
  const [cartOpen, setCartOpen] = useState(false);

  if (loading) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4"
        style={{ background: "var(--color-bg, #faf8f5)" }}
      >
        <div className="relative h-12 w-12">
          <div
            className="absolute inset-0 animate-spin rounded-full border-2 border-transparent"
            style={{ borderTopColor: "var(--color-primary, #c39077)" }}
          />
          <div
            className="absolute inset-1 animate-spin rounded-full border-2 border-transparent"
            style={{
              borderTopColor: "var(--color-accent, #dfc6b9)",
              animationDirection: "reverse",
              animationDuration: "0.85s",
            }}
          />
        </div>
        <p className="animate-pulse text-sm opacity-45" style={{ color: "var(--color-text, #36312d)" }}>
          Загрузка...
        </p>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-4 px-5"
        style={{ background: "var(--color-bg, #faf8f5)" }}
      >
        <div className="text-5xl">🏪</div>
        <p className="font-serif text-lg font-semibold opacity-80" style={{ color: "var(--color-text, #36312d)" }}>
          Салон не найден
        </p>
        <p className="max-w-sm text-center text-sm opacity-50" style={{ color: "var(--color-text, #36312d)" }}>
          {error || "Проверьте адрес и попробуйте снова"}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-primary-soft mt-2 rounded-full px-8 py-4 text-sm font-semibold shadow-soft"
          style={{
            background: "var(--color-primary, #c39077)",
            color: "var(--color-primary-foreground, #ffffff)",
          }}
        >
          Обновить страницу
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden" style={{ background: "var(--color-bg)" }}>
      <Header
        tenant={tenant}
        onOpenCart={() => {
          setCartOpen(true);
          track("cart_open");
        }}
      />

      <main className="mx-auto w-full min-w-0 max-w-[var(--layout-max)] overflow-x-hidden px-4 pt-16 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 md:pt-20 lg:px-8">
        {view === "home" && (
          <>
            <HeroSection tenant={tenant} />

            <AdvantagesSection />

            <AnimateIn className="py-10 sm:py-16">
              <ErrorBoundary>
                <CatalogSection tenantId={tenant.id} />
              </ErrorBoundary>
            </AnimateIn>

            <AnimateIn className="py-10 sm:py-16" delay={100}>
              <ErrorBoundary>
                <PortfolioSection tenantId={tenant.id} />
              </ErrorBoundary>
            </AnimateIn>

            <AnimateIn className="py-16" delay={200}>
              <ErrorBoundary>
                <ReviewsSection tenantId={tenant.id} />
              </ErrorBoundary>
            </AnimateIn>
          </>
        )}

        {view === "checkout" && (
          <div className="py-8 sm:py-10">
            <ErrorBoundary>
              <CheckoutForm
                tenantId={tenant.id}
                onBack={() => setView("home")}
                onTrackCheckout={() => track("checkout")}
              />
            </ErrorBoundary>
          </div>
        )}
      </main>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        onCheckout={() => {
          setView("checkout");
          setCartOpen(false);
        }}
      />

      <ChatWidget tenantId={tenant.id} sessionId={sessionId} />

      <footer
        className="border-t border-brand-100 bg-white py-10 md:py-12"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row lg:px-8">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 font-serif text-sm font-bold italic text-brand-600"
              aria-hidden
            >
              {tenant.name.trim().charAt(0).toUpperCase() || "•"}
            </div>
            <span className="font-serif text-xl font-semibold text-ink-dark">{tenant.name}</span>
          </div>
          <p className="text-center text-sm text-ink-light">
            © {new Date().getFullYear()} {tenant.name}. Все права защищены.
          </p>
          <p className="text-xs text-ink-light/70">SalonFlow</p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CartProvider>
        <ToastProvider />
        <AppInner />
      </CartProvider>
    </ErrorBoundary>
  );
}
