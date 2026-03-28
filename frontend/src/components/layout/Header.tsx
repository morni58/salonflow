import { useState, useEffect, useRef } from "react";
import { Menu, X, ShoppingBag } from "lucide-react";
import type { Tenant } from "../../types";
import { useCart } from "../../store/cartStore";
import { siteText } from "../../utils/siteContent";

interface Props {
  tenant: Tenant;
  onOpenCart: () => void;
  onGoHome?: () => void;
  onNavClick?: (sectionId: string) => void;
}

function navLinks(tenant: Tenant) {
  return [
    { id: "catalog",    label: siteText(tenant, "nav_catalog",    "Услуги")    },
    { id: "advantages", label: siteText(tenant, "nav_advantages", "О нас")     },
    { id: "masters",    label: siteText(tenant, "nav_masters",    "Мастера")   },
    { id: "portfolio",  label: siteText(tenant, "nav_portfolio",  "Портфолио") },
    { id: "reviews",    label: siteText(tenant, "nav_reviews",    "Отзывы")    },
  ] as const;
}

export function Header({ tenant, onOpenCart, onGoHome, onNavClick }: Props) {
  const NAV_LINKS = navLinks(tenant);
  const [menuOpen, setMenuOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastYRef = useRef(0);
  const { itemCount } = useCart();
  const [prevCount, setPrevCount] = useState(itemCount);
  const [popping, setPopping] = useState(false);

  // Auto-hide на скролле вниз
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y > lastYRef.current + 8 && y > 100) {
        setHidden(true);
      } else if (y < lastYRef.current - 8) {
        setHidden(false);
      }
      lastYRef.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Блокируем скролл без position:fixed (не скачет страница)
  useEffect(() => {
    const html = document.documentElement;
    if (menuOpen) {
      const prev = html.style.overflow;
      html.style.overflow = "hidden";
      return () => { html.style.overflow = prev; };
    }
  }, [menuOpen]);

  // Анимация счётчика корзины
  useEffect(() => {
    if (itemCount > prevCount) {
      setPopping(true);
      setTimeout(() => setPopping(false), 300);
    }
    setPrevCount(itemCount);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount]);

  const handleNav = (id: string) => {
    const wasOpen = menuOpen;
    setMenuOpen(false);
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
    setMenuOpen(false);
    onGoHome?.();
  };

  return (
    <>
      {/* Floating glass pill nav — как в пример.html */}
      <header
        className={`fixed top-0 w-full z-[100] px-4 transition-all duration-300 ${
          hidden && !menuOpen ? "-translate-y-[120%]" : "translate-y-0"
        }`}
        style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 16px)" }}
      >
        <div className="mx-auto max-w-6xl">
          <div className="glass-nav-float rounded-xl md:rounded-2xl flex h-14 md:h-16 items-center justify-between px-4 md:px-8 shadow-sm">

            {/* Logo / Brand */}
            <button
              type="button"
              onClick={goHome}
              className="flex items-center gap-2.5 shrink-0"
              aria-label="На главную"
            >
              {tenant.logo_url ? (
                <img
                  src={tenant.logo_url}
                  alt={tenant.name}
                  className="h-8 w-8 shrink-0 rounded-xl object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                    const sib = e.currentTarget.nextElementSibling as HTMLElement | null;
                    if (sib) sib.style.display = "flex";
                  }}
                />
              ) : null}
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-serif text-sm font-bold text-white"
                style={{ background: "var(--color-primary)", display: tenant.logo_url ? "none" : "flex" }}
              >
                {tenant.name.trim().charAt(0).toUpperCase() || "•"}
              </div>
              <span className="font-serif text-xl font-bold tracking-tight text-ink">
                {tenant.name}
              </span>
            </button>

            {/* Desktop nav — centered */}
            <nav
              className="hidden md:flex items-center gap-10 absolute left-1/2 -translate-x-1/2"
              aria-label="Разделы страницы"
            >
              {NAV_LINKS.map((link) => (
                <button
                  key={link.id}
                  type="button"
                  onClick={() => handleNav(link.id)}
                  className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50 hover:opacity-100 transition-opacity duration-200"
                  style={{ color: "var(--color-text)" }}
                >
                  {link.label}
                </button>
              ))}
            </nav>

            {/* Right: cart + "Запись" + hamburger */}
            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              {/* Запись (desktop text) */}
              <button
                type="button"
                onClick={() => {
                  onOpenCart();
                  setMenuOpen(false);
                }}
                className="relative flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-white transition-all duration-200 active:scale-[0.96]"
                style={{
                  background: "#1c1917",
                  boxShadow: itemCount > 0 ? "0 4px 14px rgba(0,0,0,0.18)" : "0 2px 8px rgba(0,0,0,0.1)",
                }}
                aria-label="Моя запись"
              >
                <div className="relative">
                  <ShoppingBag size={20} strokeWidth={2} />
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
                onClick={() => setMenuOpen(true)}
                className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl transition-colors"
                style={{ color: "var(--color-text)" }}
                aria-label="Открыть меню"
              >
                <Menu size={22} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Full-screen glass mobile menu (как в пример.html) */}
      <div
        className={`fixed inset-0 z-[200] flex flex-col items-center justify-center md:hidden transition-all duration-500 ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none -translate-y-4"
        }`}
        style={{
          background: "rgba(250,249,247,0.97)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        aria-hidden={!menuOpen}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={() => setMenuOpen(false)}
          className="absolute top-8 right-8 flex items-center justify-center w-12 h-12 rounded-2xl bg-black/5 transition-colors hover:bg-black/10"
          style={{ color: "var(--color-text)" }}
          aria-label="Закрыть меню"
        >
          <X size={22} strokeWidth={2} />
        </button>

        {/* Brand top-left */}
        <button
          type="button"
          onClick={goHome}
          className="absolute top-9 left-8 font-serif text-xl font-bold tracking-tight"
          style={{ color: "var(--color-text)" }}
        >
          {tenant.name}
        </button>

        {/* Nav links — centered, large italic serif */}
        <nav className="flex flex-col items-center gap-8" aria-label="Мобильное меню">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => handleNav(link.id)}
              className="font-serif italic text-3xl font-semibold transition-opacity hover:opacity-70"
              style={{ color: "var(--color-text)" }}
            >
              {link.label}
            </button>
          ))}
        </nav>

        {/* CTA bottom */}
        <div className="absolute bottom-12 left-0 right-0 flex justify-center px-8">
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              onOpenCart();
            }}
            className="w-full max-w-xs flex items-center justify-center gap-2.5 rounded-2xl bg-black py-4 text-[11px] font-bold uppercase tracking-[0.15em] text-white shadow-xl transition-all active:scale-[0.97]"
          >
            <ShoppingBag size={16} strokeWidth={2} />
            Онлайн запись
            {itemCount > 0 && (
              <span className="ml-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px]">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
