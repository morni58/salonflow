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

/** Фильтры: одна рамка, сегменты с умеренным скруглением (не «таблетки»). */
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
      <div
        className={cn(
          "inline-flex max-w-full flex-wrap gap-0 rounded-lg border border-white/20 bg-white/5 p-1 shadow-inner",
          className,
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
                "min-h-[40px] shrink-0 rounded-md px-3 py-2 text-sm font-medium transition-colors md:px-4",
                isActive ? "bg-white text-ink shadow-sm" : "text-white/85 hover:bg-white/10",
              )}
            >
              {tab.key === null ? allLabel : tab.label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("-mx-4 overflow-x-auto pb-2 hide-scrollbar px-4 sm:mx-0 sm:overflow-visible sm:px-0", className)}>
      <div
        className="inline-flex min-w-min max-w-full flex-nowrap gap-0 rounded-lg border border-brand-200 bg-brand-50/90 p-1 shadow-sm sm:flex-wrap"
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
                "min-h-[44px] shrink-0 rounded-md px-4 py-2.5 text-sm font-medium transition-colors md:px-5",
                !isActive && "text-ink-muted hover:bg-white/80 hover:text-ink",
                isActive && "text-white shadow-sm",
              )}
              style={
                isActive
                  ? {
                      background: "var(--tenant-primary, #c08973)",
                      boxShadow: "0 1px 3px rgba(54, 49, 47, 0.12)",
                    }
                  : undefined
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
