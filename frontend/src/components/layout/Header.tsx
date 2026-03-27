import { useState, useEffect, useRef } from "react";
import { Menu, X, ShoppingBag, ArrowRight, Info, ImageIcon, MessageCircle, UserRound } from "lucide-react";
import type { Tenant } from "../../types";
import { useCart } from "../../store/cartStore";
import { siteText } from "../../utils/siteContent";

interface Props {
  tenant: Tenant;
  onOpenCart: () => void;
  onGoHome?: () => void;
  /** Навигация по разделам (работает и с checkout-страницы) */
  onNavClick?: (sectionId: string) => void;
}

function navLinks(tenant: Tenant) {
  return [
    { id: "catalog", label: siteText(tenant, "nav_catalog", "Услуги"), icon: ArrowRight },
    { id: "advantages", label: siteText(tenant, "nav_advantages", "О нас"), icon: Info },
    { id: "masters", label: siteText(tenant, "nav_masters", "Мастера"), icon: UserRound },
    { id: "portfolio", label: siteText(tenant, "nav_portfolio", "Портфолио"), icon: ImageIcon },
    { id: "reviews", label: siteText(tenant, "nav_reviews", "Отзывы"), icon: MessageCircle },
  ] as const;
}

export function Header({ tenant, onOpenCart, onGoHome, onNavClick }: Props) {
  const NAV_LINKS = navLinks(tenant);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);
  const { itemCount } = useCart();
  const [prevCount, setPrevCount] = useState(itemCount);
  const [popping, setPopping] = useState(false);

  // Auto-hide header on scroll down, show on scroll up
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastYRef.current + 8 && y > 80) {
        setHidden(true);
      } else if (y < lastYRef.current - 8) {
        setHidden(false);
      }
      lastYRef.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Active section detection via IntersectionObserver
  useEffect(() => {
    const ids = NAV_LINKS.map((l) => l.id);
    const observers: IntersectionObserver[] = [];

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach((o) => o.disconnect());
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNav = (id: string) => {
    const wasOpen = drawerOpen;
    setDrawerOpen(false);
    const delay = wasOpen ? 350 : 0;
    setTimeout(() => {
      if (onNavClick) {
        onNavClick(id);
      } else {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, delay);
  };

  const goHome = () => {
    setDrawerOpen(false);
    onGoHome?.();
  };

  useEffect(() => {
    if (drawerOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [drawerOpen]);

  useEffect(() => {
    if (itemCount > prevCount) {
      setPopping(true);
      setTimeout(() => setPopping(false), 300);
    }
    setPrevCount(itemCount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount]);

  const initial = tenant.name.trim().charAt(0).toUpperCase() || "•";

  return (
    <>
      {/* Floating glass nav */}
      <header
        className={`fixed top-0 w-full z-[100] px-3 pt-3 pb-0 transition-all duration-300 ${
          hidden && !drawerOpen ? "-translate-y-full" : "translate-y-0"
        }`}
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}
      >
        <div className="mx-auto max-w-6xl">
          <div
            className="glass-nav-float rounded-xl md:rounded-2xl flex h-14 md:h-16 items-center justify-between px-4 md:px-6"
          >
            {/* Logo / Brand */}
            <button
              type="button"
              onClick={goHome}
              className="group flex min-w-0 items-center gap-2.5 text-left shrink-0"
              title="На главную"
            >
              {tenant.logo_url ? (
                <img
                  src={tenant.logo_url}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg font-serif text-sm font-bold text-white transition-colors"
                  style={{ background: "var(--color-primary)" }}
                >
                  {initial}
                </div>
              )}
              <span className="font-serif text-lg font-bold tracking-tight text-ink min-w-0 truncate max-w-[160px]">
                {tenant.name}
              </span>
            </button>

            {/* Desktop nav links — centered */}
            <nav className="hidden md:flex items-center gap-7 absolute left-1/2 -translate-x-1/2" aria-label="Разделы страницы">
              {NAV_LINKS.map((link) => {
                const isActive = activeSection === link.id;
                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => handleNav(link.id)}
                    className={`text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-200 ${
                      isActive ? "text-ink" : "text-ink/50 hover:text-ink"
                    }`}
                    aria-current={isActive ? "true" : undefined}
                  >
                    {link.label}
                  </button>
                );
              })}
            </nav>

            {/* Right side: cart + mobile hamburger */}
            <div className="flex items-center gap-2 shrink-0">
              {/* Cart button */}
              <button
                type="button"
                onClick={() => {
                  onOpenCart();
                  setDrawerOpen(false);
                }}
                className="relative inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[10px] font-bold uppercase tracking-[0.15em] text-white transition-all duration-200 active:scale-[0.96]"
                style={{
                  background: "#1c1917",
                  boxShadow: itemCount > 0 ? "0 4px 14px rgba(0,0,0,0.18)" : "0 2px 8px rgba(0,0,0,0.1)",
                }}
                aria-label="Моя запись"
              >
                <div className="relative">
                  <ShoppingBag size={15} strokeWidth={2} />
                  {itemCount > 0 && (
                    <span
                      className={`absolute -top-2 -right-2 flex min-w-[1rem] items-center justify-center rounded-full bg-white px-0.5 text-[9px] font-bold${popping ? " cart-pop" : ""}`}
                      style={{ color: "var(--color-primary)" }}
                    >
                      {itemCount > 9 ? "9+" : itemCount}
                    </span>
                  )}
                </div>
                <span className="hidden sm:inline whitespace-nowrap">Запись</span>
              </button>

              {/* Mobile hamburger */}
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-ink/60 hover:text-ink transition-colors"
                aria-label="Открыть меню"
              >
                <Menu size={20} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Full-screen glass mobile menu */}
      <div
        className={`fixed inset-0 z-[200] flex flex-col items-center justify-center md:hidden transition-all duration-300 ${
          drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        style={{
          background: "rgba(250,249,247,0.96)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        aria-hidden={!drawerOpen}
      >
        {/* Close button top-right */}
        <button
          type="button"
          onClick={() => setDrawerOpen(false)}
          className="absolute top-5 right-5 flex items-center justify-center w-10 h-10 rounded-xl border border-black/8 bg-white/80 text-ink/60 hover:text-ink transition-colors"
          aria-label="Закрыть меню"
        >
          <X size={20} strokeWidth={2} />
        </button>

        {/* Brand in top-left */}
        <button
          type="button"
          onClick={goHome}
          className="absolute top-5 left-5 font-serif text-lg font-bold tracking-tight text-ink"
        >
          {tenant.name}
        </button>

        {/* Centered nav links */}
        <nav className="flex flex-col items-center gap-7" aria-label="Мобильное меню">
          {NAV_LINKS.map((link) => {
            const isActive = activeSection === link.id;
            return (
              <button
                key={link.id}
                type="button"
                onClick={() => handleNav(link.id)}
                className={`font-serif italic text-2xl transition-colors duration-200 ${
                  isActive ? "text-ink" : "text-ink/50 hover:text-ink"
                }`}
                aria-current={isActive ? "true" : undefined}
              >
                {link.label}
              </button>
            );
          })}
        </nav>

        {/* CTA at bottom */}
        <div className="absolute bottom-10 left-0 right-0 flex justify-center px-8">
          <button
            type="button"
            onClick={() => {
              setDrawerOpen(false);
              onOpenCart();
            }}
            className="btn-ink w-full max-w-xs justify-center"
          >
            <ShoppingBag size={15} strokeWidth={2} />
            Открыть корзину
            {itemCount > 0 && (
              <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[9px]">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
