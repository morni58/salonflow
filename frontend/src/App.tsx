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
            style={{ borderTopColor: "var(--tenant-primary, #c39077)" }}
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
        <p className="animate-pulse text-sm text-ink-light">Загрузка...</p>
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
        <p className="font-serif text-lg font-semibold text-ink-dark opacity-80">Салон не найден</p>
        <p className="max-w-sm text-center text-sm text-ink-light opacity-50">
          {error || "Проверьте адрес и попробуйте снова"}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="btn-primary-soft mt-2 rounded-full bg-brand-500 px-8 py-4 text-sm font-semibold text-white shadow-soft"
        >
          Обновить страницу
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full min-w-0 overflow-x-hidden bg-base">
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
        className="border-t border-brand-100 bg-surface py-10 md:py-12"
        style={{ paddingBottom: "max(2rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-4 text-center sm:px-6 md:flex-row md:text-left lg:px-8">
          <div className="flex items-center gap-2">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 font-serif text-sm font-bold italic text-brand-600"
              aria-hidden
            >
              {tenant.name.trim().charAt(0).toUpperCase() || "•"}
            </div>
            <span className="font-serif text-lg font-semibold tracking-wide text-ink-dark md:text-xl">{tenant.name}</span>
          </div>
          <p className="text-sm text-ink-light">
            © {new Date().getFullYear()} {tenant.name}. Все права защищены.
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-200 text-ink-light transition-colors hover:border-brand-500 hover:text-brand-500"
              aria-label="Twitter"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
              </svg>
            </a>
            <a
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-brand-200 text-ink-light transition-colors hover:border-brand-500 hover:text-brand-500"
              aria-label="Instagram"
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm3.98-10.822a1.424 1.424 0 100 2.848 1.424 1.424 0 000-2.848z" />
              </svg>
            </a>
            <span className="text-xs text-ink-light/70">SalonFlow</span>
          </div>
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
