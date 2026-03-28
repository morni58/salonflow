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
  const [floatVisible, setFloatVisible] = useState(false);

  // Floating CTA on scroll
  useEffect(() => {
    const onScroll = () => {
      const show = window.scrollY > 500;
      setFloatVisible(show);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      {/* Хедер скрываем на checkout — он мешает форме */}
      {view !== "checkout" && (
        <Header
          tenant={tenant}
          onGoHome={() => navigate("home")}
          onOpenCart={() => {
            setCartOpen(true);
            track("cart_open");
          }}
          onNavClick={handleNavClick}
        />
      )}

      <main className={`mx-auto w-full min-w-0 max-w-[var(--layout-max)] px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 lg:px-8 ${view === "checkout" ? "pt-6 sm:pt-8" : "pt-24 md:pt-28"}`}>
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

      <SiteFooter tenant={tenant} onNavClick={handleNavClick} />

      {/* Floating mobile CTA */}
      {view === "home" && (
        <div
          className="pointer-events-none fixed bottom-0 left-0 right-0 z-[150] flex justify-center px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] transition-all duration-500 sm:hidden"
          style={{ opacity: floatVisible && !cartOpen ? 1 : 0, transform: floatVisible && !cartOpen ? "translateY(0)" : "translateY(120%)" }}
        >
          <button
            type="button"
            className="pointer-events-auto inline-flex items-center gap-2.5 rounded-2xl px-10 py-4 text-sm font-semibold text-white shadow-2xl transition-all duration-300 active:scale-[0.97]"
            style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 75%, #7a3520) 100%)", boxShadow: "0 12px 36px rgba(192,137,115,0.55)" }}
            onClick={() => { document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
          >
            Записаться
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}
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
