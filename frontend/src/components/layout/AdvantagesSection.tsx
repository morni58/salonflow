import { Clock, Sparkles, Smile } from "lucide-react";
import type { Tenant } from "../../types";
import { MediaFrame } from "../common/MediaFrame";
import { parseAdvantages, type AdvantageIcon } from "../../utils/advantages";
import { siteText } from "../../utils/siteContent";

function IconFor({ name }: { name: AdvantageIcon }) {
  const cls = "h-6 w-6 shrink-0";
  if (name === "clock") return <Clock className={cls} aria-hidden />;
  if (name === "smile") return <Smile className={cls} aria-hidden />;
  return <Sparkles className={cls} aria-hidden />;
}

interface Props {
  tenant: Tenant;
}

export function AdvantagesSection({ tenant }: Props) {
  const items = parseAdvantages(tenant);
  if (!items) return null;

  const badge = siteText(tenant, "advantages_badge", "Наши преимущества");
  const titleBefore = siteText(tenant, "advantages_title_before", "Почему нас");
  const titleAccent = siteText(tenant, "advantages_title_accent", "выбирают");

  return (
    <section
      id="advantages"
      data-anchor-section
      className="scroll-mt-24 px-4 py-12 sm:px-6 md:py-16 lg:px-8"
    >
      <div
        className="mx-auto w-full max-w-[var(--layout-max)] overflow-hidden rounded-3xl shadow-[0_24px_80px_rgba(0,0,0,0.12)]"
        style={{
          background:
            "linear-gradient(165deg, #141210 0%, #1c1917 45%, #1a1714 100%)",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="px-5 py-12 sm:px-8 sm:py-14 md:px-12 md:py-16">
          <div className="mx-auto mb-10 max-w-2xl text-center md:mb-14">
            <p
              className="mb-3 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35"
            >
              {badge}
            </p>
            <h2 className="font-serif text-3xl italic leading-tight text-white md:text-5xl md:leading-tight">
              {titleBefore}{" "}
              <span style={{ color: "var(--color-accent, #d4b5a8)" }}>{titleAccent}</span>
            </h2>
          </div>

          <div
            className="grid gap-4 sm:grid-cols-2 sm:gap-5 lg:[grid-template-columns:repeat(auto-fit,minmax(240px,1fr))]"
          >
            {items.map((item, i) => (
              <article
                key={`${item.title}-${i}`}
                className="flex min-h-0 flex-col overflow-hidden rounded-2xl transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5"
                style={{
                  background: "rgba(255,255,255,0.045)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
                }}
              >
                {item.image_url ? (
                  <div
                    className="relative aspect-[16/10] w-full shrink-0 overflow-hidden bg-black/25"
                    style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
                  >
                    <MediaFrame src={item.image_url} alt="" className="h-full w-full" />
                  </div>
                ) : (
                  <div
                    className="flex shrink-0 items-center justify-center border-b px-5 py-5"
                    style={{ borderColor: "rgba(255,255,255,0.06)" }}
                  >
                    <span
                      className="flex h-12 w-12 items-center justify-center rounded-2xl"
                      style={{
                        background: "rgba(255,255,255,0.07)",
                        color: "var(--color-accent, #d4b5a8)",
                      }}
                    >
                      <IconFor name={item.icon} />
                    </span>
                  </div>
                )}

                <div className="flex flex-1 flex-col px-5 pb-6 pt-5 md:px-6">
                  <h3 className="font-serif text-lg font-bold leading-snug text-white md:text-xl">
                    {item.title}
                  </h3>
                  <p
                    className="mt-2 text-sm leading-relaxed"
                    style={{ color: "rgba(255,255,255,0.5)" }}
                  >
                    {item.text}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 flex justify-center md:mt-12">
            <button
              type="button"
              onClick={() =>
                document.getElementById("catalog")?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
              className="inline-flex items-center gap-2 rounded-full px-8 py-3.5 text-[11px] font-bold uppercase tracking-[0.18em] transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
              style={{
                background: "#fafaf9",
                color: "#1c1917",
                boxShadow: "0 4px 24px rgba(255,255,255,0.1)",
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "var(--color-primary)";
                el.style.color = "#fff";
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.background = "#fafaf9";
                el.style.color = "#1c1917";
              }}
            >
              Записаться сейчас
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
