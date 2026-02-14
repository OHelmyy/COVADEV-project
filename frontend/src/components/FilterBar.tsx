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
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          padding: 12,
          border: "1px solid #eee",
          borderRadius: 12,
          background: "#fff",
        }}
      >
        <input
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search tasks, code, developer..."
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            minWidth: 260,
            flex: 1,
          }}
        />
  
        <select
          value={sort}
          onChange={(e) => onSort(e.target.value)}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
        >
          <option value="similarity_desc">Sort: Similarity (High → Low)</option>
          <option value="similarity_asc">Sort: Similarity (Low → High)</option>
          <option value="task_az">Sort: Task (A → Z)</option>
        </select>
  
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#444" }}>
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
  