import { useState, useEffect } from "react";
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

  // Инициализация вида из URL (для поддержки кнопки "назад" браузера)
  const [view, setView] = useState<View>(() =>
    window.location.pathname.startsWith("/checkout") ? "checkout" : "home"
  );
  const [cartOpen, setCartOpen] = useState(false);

  // Слушаем popstate — нажатие кнопки "назад" в браузере
  useEffect(() => {
    const handler = (e: PopStateEvent) => {
      const state = e.state as { view?: View } | null;
      setView(state?.view === "checkout" ? "checkout" : "home");
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  /** Навигация с обновлением URL */
  const navigate = (to: View) => {
    setView(to);
    history.pushState({ view: to }, "", to === "checkout" ? "/checkout" : "/");
    if (to === "home") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Обновляем мета-теги под тенанта
  useEffect(() => {
    if (!tenant) return;
    const siteName = tenant.name;
    document.title = `${siteName} — Онлайн-запись`;

    const metaDesc = document.querySelector('meta[name="description"]');
    const desc = (tenant.site_content?.meta_description as string | undefined)
      || `Онлайн-запись в ${siteName}. Выбирайте услуги и бронируйте удобное время.`;
    if (metaDesc) metaDesc.setAttribute("content", desc);

    const ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) ogTitle.setAttribute("content", `${siteName} — Онлайн-запись`);

    const ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) ogDesc.setAttribute("content", desc);

    const ogSite = document.querySelector('meta[property="og:site_name"]');
    if (ogSite) ogSite.setAttribute("content", siteName);

    if (tenant.logo_url) {
      const ogImg = document.querySelector('meta[property="og:image"]');
      if (ogImg) ogImg.setAttribute("content", tenant.logo_url);
    }

    const twTitle = document.querySelector('meta[name="twitter:title"]');
    if (twTitle) twTitle.setAttribute("content", `${siteName} — Онлайн-запись`);

    const themeColor = document.querySelector('meta[name="theme-color"]');
    if (themeColor) themeColor.setAttribute("content", tenant.color_bg || "#faf9f7");
  }, [tenant]);

  /** Клик по навигации хедера: если не на главной — сначала переключаем вид, потом скроллим */
  const handleNavClick = (sectionId: string) => {
    if (view !== "home") {
      navigate("home");
      // Небольшая задержка, чтобы React успел отрендерить секции
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    } else {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

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
          className="btn-primary-soft mt-2 rounded-lg bg-brand-500 px-8 py-4 text-sm font-semibold text-white shadow-soft"
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
        onGoHome={() => navigate("home")}
        onOpenCart={() => {
          setCartOpen(true);
          track("cart_open");
        }}
        onNavClick={handleNavClick}
      />

      <main className="mx-auto w-full min-w-0 max-w-[var(--layout-max)] overflow-x-hidden px-4 pt-16 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 md:pt-20 lg:px-8">
        {view === "home" && (
          <>
            <HeroSection tenant={tenant} />

            <AnimateIn className="py-6 sm:py-10">
              <ErrorBoundary>
                <CatalogSection
                  tenantId={tenant.id}
                  title={siteText(tenant, "section_catalog", "Наши услуги")}
                  subtitle={siteText(
                    tenant,
                    "section_catalog_subtitle",
                    'Выберите процедуры и удобное время. Цены указаны «от», точная стоимость зависит от мастера.',
                  )}
                />
              </ErrorBoundary>
            </AnimateIn>

            <AnimateIn className="py-6 sm:py-10" delay={50}>
              <ErrorBoundary>
                <MastersSection tenantId={tenant.id} onNavClick={handleNavClick} />
              </ErrorBoundary>
            </AnimateIn>

            <AdvantagesSection tenant={tenant} />

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
                tenant={tenant}
                onBack={() => navigate("home")}
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
          navigate("checkout");
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
