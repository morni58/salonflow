import { SegmentedTabs, type SegmentedTabItem } from "../common/SegmentedTabs";

interface Props {
  categories: string[];
  active: string | null;
  onSelect: (name: string | null) => void;
}

export function CategoryFilter({ categories, active, onSelect }: Props) {
  const tabs: SegmentedTabItem[] = [
    { key: null, label: "Все" },
    ...categories.map((c) => ({ key: c, label: c })),
  ];

  return <SegmentedTabs tabs={tabs} activeKey={active} onSelect={onSelect} />;
}
