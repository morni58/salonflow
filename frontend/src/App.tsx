import { useState, useEffect } from "react";
import { ShoppingBag, ClipboardList, X, Bell } from "lucide-react";
import { useBookingPoller } from "./hooks/useBookingPoller";
import type { StatusNotification } from "./hooks/useBookingPoller";
import { useTenant } from "./hooks/useTenant";
import { useSession } from "./hooks/useSession";
import { CartProvider, useCart } from "./store/cartStore";
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
import { ContactSection } from "./components/layout/ContactSection";
import { MyBookingsModal } from "./components/my-bookings/MyBookingsModal";
import { AnimateIn } from "./components/common/AnimateIn";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { ToastProvider } from "./components/common/Toast";
import { siteText } from "./utils/siteContent";

type View = "home" | "checkout";

const STATUS_LABELS: Record<string, { text: string; emoji: string }> = {
  pending:   { text: "Ожидает подтверждения", emoji: "⏳" },
  waiting:   { text: "В очереди",             emoji: "🕐" },
  confirmed: { text: "Подтверждено!",          emoji: "✅" },
  completed: { text: "Завершено",              emoji: "🏁" },
  cancelled: { text: "Отменено",               emoji: "❌" },
};

function StatusNotifCard({ notif, onDismiss, onOpen }: {
  notif: StatusNotification;
  onDismiss: () => void;
  onOpen: () => void;
}) {
  const s = STATUS_LABELS[notif.newStatus] ?? { text: notif.newStatus, emoji: "🔔" };
  return (
    <div
      className="pointer-events-auto flex w-full max-w-md flex-col gap-2 rounded-2xl border bg-white p-5 shadow-2xl animate-slide-in-left sm:max-w-lg"
      style={{ borderColor: "rgba(0,0,0,0.07)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Bell size={18} style={{ color: "var(--color-primary)" }} aria-hidden />
          <p className="text-[11px] font-bold uppercase tracking-widest opacity-50" style={{ color: "var(--color-text)" }}>
            Статус записи
          </p>
        </div>
        <button type="button" onClick={onDismiss} className="flex h-9 w-9 items-center justify-center rounded-xl bg-black/5 hover:bg-black/10 transition-colors shrink-0" aria-label="Закрыть">
          <X size={16} />
        </button>
      </div>
      <p className="text-lg font-semibold leading-snug sm:text-xl" style={{ color: "var(--color-text)" }}>
        {s.emoji} {s.text}
      </p>
      {notif.bookingCode && (
        <p className="font-mono text-sm opacity-50" style={{ color: "var(--color-text)" }}>{notif.bookingCode}</p>
      )}
      {notif.serviceNames.length > 0 && (
        <p className="text-sm leading-relaxed opacity-70 sm:text-base" style={{ color: "var(--color-text)" }}>{notif.serviceNames.join(", ")}</p>
      )}
      <button
        type="button"
        onClick={() => { onOpen(); onDismiss(); }}
        className="mt-1 h-12 w-full rounded-xl text-sm font-bold text-white transition-all active:scale-[0.97] sm:h-14 sm:text-base"
        style={{ background: "var(--color-primary)" }}
      >
        Посмотреть запись
      </button>
    </div>
  );
}

/** Плавающая кнопка корзины (снизу справа) — появляется когда в корзине есть товары */
function CartFab({ onOpen, cartOpen }: { onOpen: () => void; cartOpen: boolean }) {
  const { itemCount } = useCart();
  const visible = itemCount > 0 && !cartOpen;

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Открыть корзину, ${itemCount} товаров`}
      className="fixed z-[150] transition-all duration-300 active:scale-[0.94] focus-visible:outline-none"
      style={{
        bottom: "max(1.5rem, env(safe-area-inset-bottom, 1.5rem))",
        right: "1.25rem",
        opacity: visible ? 1 : 0,
        transform: visible ? "scale(1) translateY(0)" : "scale(0.7) translateY(20px)",
        pointerEvents: visible ? "auto" : "none",
        background: "#1c1917",
        color: "#fff",
        borderRadius: "16px",
        padding: "16px 22px",
        minHeight: "56px",
        display: "flex",
        alignItems: "center",
        gap: "10px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.22), 0 2px 8px rgba(0,0,0,0.12)",
        fontWeight: 700,
        fontSize: "15px",
      }}
    >
      <ShoppingBag size={26} strokeWidth={2} aria-hidden />
      <span>{itemCount}</span>
    </button>
  );
}

function AppInner() {
  const { tenant, loading, error } = useTenant();
  const { track } = useSession(tenant?.id);
  const { notifications, dismiss } = useBookingPoller();

  // Инициализация вида из URL (для поддержки кнопки "назад" браузера)
  const [view, setView] = useState<View>(() =>
    window.location.pathname.startsWith("/checkout") ? "checkout" : "home"
  );
  const [cartOpen, setCartOpen] = useState(false);
  const [myBookingsOpen, setMyBookingsOpen] = useState(false);
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
          onMyBookings={() => setMyBookingsOpen(true)}
        />
      )}

      <main
        className={`mx-auto w-full min-w-0 max-w-[var(--layout-max)] px-4 sm:px-6 lg:px-8 ${
          view === "checkout"
            ? "pb-[max(1rem,env(safe-area-inset-bottom))] pt-6 sm:pt-8"
            : "pb-28 pt-24 md:pt-28 lg:pb-[max(1rem,env(safe-area-inset-bottom))]"
        }`}
      >
        {view === "home" && (
          <>
            <HeroSection tenant={tenant} />

            {/* Мобильная / планшет: крупная кнопка сразу под hero (не только в бургере и FAB) */}
            <div className="mb-8 mt-1 lg:hidden">
              <button
                type="button"
                onClick={() => setMyBookingsOpen(true)}
                className="flex w-full items-center justify-center gap-3 rounded-2xl py-4 text-lg font-bold shadow-lg transition-all active:scale-[0.99] sm:py-5 sm:text-xl"
                style={{
                  background: "var(--color-primary)",
                  color: "#fff",
                  boxShadow: "0 10px 36px color-mix(in srgb, var(--color-primary) 45%, transparent)",
                }}
                aria-label="Мои записи"
              >
                <ClipboardList size={26} strokeWidth={2} aria-hidden />
                Мои записи
              </button>
              <p className="mt-2 text-center text-sm text-ink-muted">
                Найти записи по контакту, отменить при необходимости
              </p>
            </div>

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

            <AnimateIn className="py-4" delay={100}>
              <ErrorBoundary>
                <ContactSection tenant={tenant} />
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

      {myBookingsOpen && tenant && (
        <MyBookingsModal
          tenantId={tenant.id}
          onClose={() => setMyBookingsOpen(false)}
        />
      )}

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
            className="pointer-events-auto inline-flex items-center gap-2.5 rounded-lg px-10 py-4 text-sm font-semibold text-white shadow-2xl transition-all duration-300 active:scale-[0.97]"
            style={{ background: "linear-gradient(135deg, var(--color-primary) 0%, color-mix(in srgb, var(--color-primary) 75%, #7a3520) 100%)", boxShadow: "0 12px 36px rgba(192,137,115,0.55)" }}
            onClick={() => { document.getElementById("catalog")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}
          >
            Записаться
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      )}

      {/* Уведомления о смене статуса — слева снизу (все экраны) */}
      {view === "home" && notifications.length > 0 && (
        <div
          className="pointer-events-none fixed z-[152] flex max-w-[min(100vw-2rem,22rem)] flex-col gap-2"
          style={{ bottom: "max(6.5rem, env(safe-area-inset-bottom, 1.5rem))", left: "1rem" }}
        >
          {notifications.map((n) => (
            <StatusNotifCard
              key={n.uid}
              notif={n}
              onDismiss={() => dismiss(n.uid)}
              onOpen={() => setMyBookingsOpen(true)}
            />
          ))}
        </div>
      )}

      {/* Floating «Мои записи» — только до lg; на ПК кнопка в шапке у логотипа */}
      {view === "home" && (
        <button
          type="button"
          onClick={() => setMyBookingsOpen(true)}
          className="pointer-events-auto fixed z-[150] flex items-center gap-3 rounded-2xl font-bold shadow-xl transition-all active:scale-[0.94] hover:brightness-110 lg:hidden"
          style={{
            bottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))",
            left: "max(1rem, env(safe-area-inset-left, 1rem))",
            background: "var(--color-primary)",
            color: "#fff",
            boxShadow: "0 10px 32px rgba(0,0,0,0.28), 0 2px 10px rgba(0,0,0,0.18)",
            minHeight: "72px",
            padding: "0 28px",
            fontSize: "17px",
          }}
          aria-label="Мои записи"
        >
          <ClipboardList size={28} strokeWidth={2} aria-hidden />
          <span>Мои записи</span>
          {notifications.length > 0 && (
            <span
              className="flex h-7 min-w-[1.75rem] items-center justify-center rounded-full px-1.5 text-xs font-bold"
              style={{ background: "#fff", color: "var(--color-primary)" }}
            >
              {notifications.length}
            </span>
          )}
        </button>
      )}

      {/* Floating cart FAB — bottom-right when cart has items */}
      <CartFab onOpen={() => { setCartOpen(true); track("cart_open"); }} cartOpen={cartOpen} />
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
