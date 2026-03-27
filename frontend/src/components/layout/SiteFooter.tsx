import type { Tenant } from "../../types";
import { getFooterContact } from "../../utils/siteContent";

function IconTelegram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
    </svg>
  );
}

function IconWhatsApp({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

function IconInstagram({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm3.98-10.822a1.424 1.424 0 100 2.848 1.424 1.424 0 000-2.848z" />
    </svg>
  );
}

const NAV_LINKS = [
  { label: "Услуги", id: "catalog" },
  { label: "Мастера", id: "masters" },
  { label: "Портфолио", id: "portfolio" },
  { label: "Отзывы", id: "reviews" },
];

interface Props {
  tenant: Tenant;
  onNavClick?: (sectionId: string) => void;
}

export function SiteFooter({ tenant, onNavClick }: Props) {
  const contact = getFooterContact(tenant);
  const year = new Date().getFullYear();

  const scrollTo = (id: string) => {
    if (onNavClick) {
      onNavClick(id);
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <footer className="mt-4 overflow-hidden" style={{ background: "#1c1917" }}>
      <div className="mx-auto max-w-6xl py-14 md:py-16 px-6">
        {/* Main row */}
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between">
          {/* Brand */}
          <div className="flex-shrink-0">
            <span className="font-serif italic text-2xl md:text-3xl text-white tracking-tight block mb-4">
              {tenant.name}
            </span>
            <p className="max-w-[240px] text-sm leading-relaxed mb-5" style={{ color: "rgba(255,255,255,0.35)" }}>
              Ваш beauty-салон с заботой о каждом клиенте.
            </p>
            {/* Social links */}
            <div className="flex items-center gap-4">
              {[
                { href: contact.telegram, Icon: IconTelegram, label: "Telegram" },
                { href: contact.whatsapp, Icon: IconWhatsApp, label: "WhatsApp" },
                { href: contact.instagram, Icon: IconInstagram, label: "Instagram" },
              ].map(({ href, Icon, label }) =>
                href && href !== "#" ? (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="transition-opacity duration-200 hover:opacity-70"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                  >
                    <Icon className="h-4 w-4" />
                  </a>
                ) : null
              )}
            </div>
          </div>

          {/* Nav */}
          <div>
            <h3 className="mb-4 text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
              Навигация
            </h3>
            <ul className="flex flex-col gap-3">
              {NAV_LINKS.map((link) => (
                <li key={link.id}>
                  <button
                    type="button"
                    onClick={() => scrollTo(link.id)}
                    className="text-[9px] font-bold uppercase tracking-widest transition-colors duration-200"
                    style={{ color: "rgba(255,255,255,0.35)" }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.7)"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.35)"; }}
                  >
                    {link.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Contacts */}
          <div>
            <h3 className="mb-4 text-[9px] font-bold uppercase tracking-widest" style={{ color: "rgba(255,255,255,0.25)" }}>
              Контакты
            </h3>
            <div className="flex flex-col gap-3">
              {contact.phones.map((p) => (
                <a
                  key={p.href}
                  href={p.href}
                  className="text-sm font-medium tabular-nums transition-colors duration-200"
                  style={{ color: "rgba(255,255,255,0.55)" }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.9)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,0.55)"; }}
                >
                  {p.label}
                </a>
              ))}
              {contact.address && (
                <p className="text-sm" style={{ color: "rgba(255,255,255,0.3)" }}>{contact.address}</p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-6 flex flex-col items-center justify-between gap-2 sm:flex-row"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.2)" }}>
            © {year} {tenant.name}. Все права защищены.
          </p>
          <p className="text-[9px]" style={{ color: "rgba(255,255,255,0.15)" }}>Работает на SalonFlow</p>
        </div>
      </div>
    </footer>
  );
}
