import { cardBase, inputBase, ui } from "../theme/ui";

type FilterBarProps = {
  search: string;
  onSearch: (v: string) => void;
  sort: string;
  onSort: (v: string) => void;
  showLowOnly: boolean;
  onShowLowOnly: (v: boolean) => void;
};

export default function FilterBar({
  search,
  onSearch,
  sort,
  onSort,
  showLowOnly,
  onShowLowOnly,
}: FilterBarProps) {
  return (
    <div
      style={{
        ...cardBase,
        display: "flex",
        gap: 12,
        flexWrap: "wrap",
        alignItems: "center",
        padding: 14,
      }}
    >
      <input
        value={search}
        onChange={(e) => onSearch(e.target.value)}
        placeholder="Search tasks, code, developer..."
        style={{
          ...inputBase,
          minWidth: 280,
          flex: 1,
        }}
      />

      <select
        value={sort}
        onChange={(e) => onSort(e.target.value)}
        style={{
          ...inputBase,
          minWidth: 220,
        }}
      >
        <option value="similarity_desc">Sort: Similarity (High → Low)</option>
        <option value="similarity_asc">Sort: Similarity (Low → High)</option>
        <option value="task_az">Sort: Task (A → Z)</option>
      </select>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          color: ui.colors.textSoft,
          padding: "8px 10px",
          borderRadius: 12,
          background: ui.colors.bgSoft,
          border: `1px solid ${ui.colors.border}`,
        }}
      >
        <input
          type="checkbox"
          checked={showLowOnly}
          onChange={(e) => onShowLowOnly(e.target.checked)}
        />
        Low similarity only (&lt; 70%)
      </label>
    </div>
  );
}