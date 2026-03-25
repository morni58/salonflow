import { cn } from "../../utils";

export type SegmentedTabItem = { key: string | null; label: string };

interface Props {
  tabs: SegmentedTabItem[];
  activeKey: string | null;
  onSelect: (key: string | null) => void;
  className?: string;
  ariaLabel?: string;
  dark?: boolean;
  allLabel?: string;
}

/** Табы каталога / портфолио — стиль как в спецификации: активный primary, неактивный glass */
export function SegmentedTabs({
  tabs,
  activeKey,
  onSelect,
  className,
  ariaLabel = "Категории",
  dark,
  allLabel = "Все услуги",
}: Props) {
  if (dark) {
    return (
      <div className={cn("flex flex-wrap justify-center gap-3", className)} role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          const id = tab.key === null ? "__all__" : tab.key;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.key)}
              className={cn(
                "min-h-[44px] shrink-0 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all duration-300 md:px-6",
                !isActive && "border-white/12 bg-white/5 text-white/75 hover:border-white/25 hover:bg-white/10",
                isActive && "border-transparent shadow-lg"
              )}
              style={
                isActive
                  ? {
                      background: "var(--color-primary)",
                      color: "var(--color-primary-foreground)",
                      boxShadow: "0 8px 28px color-mix(in srgb, var(--color-primary) 40%, transparent)",
                    }
                  : undefined
              }
            >
              {tab.key === null ? allLabel : tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="-mx-4 overflow-x-auto pb-2 hide-scrollbar px-4 sm:mx-0 sm:overflow-visible sm:px-0">
      <div
        className={cn(
          "flex w-max min-w-full flex-nowrap justify-start gap-2 sm:w-auto sm:flex-wrap sm:justify-center md:gap-3",
          className
        )}
        role="tablist"
        aria-label={ariaLabel}
      >
        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          const id = tab.key === null ? "__all__" : tab.key;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onSelect(tab.key)}
              className={cn(
                "min-h-[44px] shrink-0 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all duration-300 md:px-6",
                !isActive && "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.08]",
                isActive && "border-transparent shadow-lg"
              )}
              style={
                isActive
                  ? {
                      background: "var(--color-primary)",
                      color: "var(--color-primary-foreground)",
                      boxShadow: "0 8px 28px color-mix(in srgb, var(--color-primary) 40%, transparent)",
                    }
                  : { color: "var(--color-text)", opacity: 0.75 }
              }
            >
              {tab.key === null ? allLabel : tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
