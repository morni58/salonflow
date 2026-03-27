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

export function SegmentedTabs({ tabs, activeKey, onSelect, className, ariaLabel = "Категории", dark, allLabel = "Все" }: Props) {
  if (dark) {
    return (
      <div className={cn("flex flex-wrap gap-2", className)} role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          const id = tab.key === null ? "__all__" : tab.key;
          return (
            <button
              key={id} type="button" role="tab" aria-selected={isActive}
              onClick={() => onSelect(tab.key)}
              className={cn(
                "rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.97]",
                isActive
                  ? "border-white bg-white text-ink shadow-sm"
                  : "border-white/20 text-white/75 hover:border-white/40 hover:text-white"
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
    <div className={cn("-mx-4 overflow-x-auto pb-1 hide-scrollbar sm:mx-0 sm:overflow-visible", className)}>
      <div className="flex min-w-min gap-2 px-4 sm:flex-wrap sm:px-0" role="tablist" aria-label={ariaLabel}>
        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          const id = tab.key === null ? "__all__" : tab.key;
          return (
            <button
              key={id} type="button" role="tab" aria-selected={isActive}
              onClick={() => onSelect(tab.key)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-[0.97] whitespace-nowrap",
                isActive
                  ? "border-transparent text-white shadow-sm"
                  : "border-brand-200 bg-white text-ink-muted hover:border-brand-400 hover:text-ink"
              )}
              style={isActive ? { background: "var(--color-primary)" } : undefined}
            >
              {tab.key === null ? allLabel : tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
