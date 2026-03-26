import { useState } from "react";
import { useTenant } from "./hooks/useTenant";
import { useSession } from "./hooks/useSession";
import { CartProvider } from "./store/cartStore";
import { Header } from "./components/layout/Header";
import { SiteFooter } from "./components/layout/SiteFooter";
import { HeroSection } from "./components/layout/HeroSection";
import { AdvantagesSection } from "./components/layout/AdvantagesSection";
import { MastersSection } from "./components/masters/MastersSection";
import { CatalogSection } from "./components/catalog/CatalogSection";
import { CartDrawer } from "./components/cart/CartDrawer";
import { CheckoutForm } from "./components/checkout/CheckoutForm";
import { PortfolioSection } from "./components/portfolio/PortfolioSection";
import { ReviewsSection } from "./components/reviews/ReviewsSection";
import { AnimateIn } from "./components/common/AnimateIn";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { ToastProvider } from "./components/common/Toast";
import { siteText } from "./utils/siteContent";

type View = "home" | "checkout";

function AppInner() {
  const { tenant, loading, error } = useTenant();
  const { track } = useSession(tenant?.id);
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

            <AdvantagesSection tenant={tenant} />

            <AnimateIn className="py-10 sm:py-16">
              <ErrorBoundary>
                <MastersSection tenantId={tenant.id} />
              </ErrorBoundary>
            </AnimateIn>

            <AnimateIn className="py-10 sm:py-16">
              <ErrorBoundary>
                <CatalogSection
                  tenantId={tenant.id}
                  title={siteText(tenant, "section_catalog", "Наши Услуги")}
                  subtitle={siteText(
                    tenant,
                    "section_catalog_subtitle",
                    "Выберите необходимые процедуры и забронируйте удобное для вас время онлайн.",
                  )}
                />
              </ErrorBoundary>
            </AnimateIn>

            <AnimateIn className="py-10 sm:py-16" delay={100}>
              <ErrorBoundary>
                <PortfolioSection
                  tenantId={tenant.id}
                  title={siteText(tenant, "section_portfolio", "Портфолио")}
                  subtitle={siteText(
                    tenant,
                    "portfolio_subtitle",
                    "Вдохновляйтесь нашими работами. Идеальный результат — наша визитная карточка.",
                  )}
                />
              </ErrorBoundary>
            </AnimateIn>

            <AnimateIn className="py-16" delay={200}>
              <ErrorBoundary>
                <ReviewsSection tenantId={tenant.id} title={siteText(tenant, "section_reviews", "Отзывы")} />
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

      <SiteFooter tenant={tenant} />
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
