import { useMemo, useState } from "react";
import { Card, CompareCard } from "../ProjectUi";
import {
  getBpmnCompareBody,
  getCodeComparePresentation,
} from "../../../utils/projectDetail";
import type {
  CompareBpmnTask,
  CompareCodeFn,
} from "../../../types/projectDetail";

type Props = {
  compareLoading: boolean;
  compareError: string;
  bpmnCompare: CompareBpmnTask[];
  codeCompare: CompareCodeFn[];
  onRefresh: () => void;
};

function getFileNameOnly(path?: string) {
  if (!path) return "";
  return path.split(/[\\/]/).pop() || path;
}

export default function SummariesTab({
  compareLoading,
  compareError,
  bpmnCompare,
  codeCompare,
  onRefresh,
}: Props) {
  const [search, setSearch] = useState("");

  const normalizedSearch = search.trim().toLowerCase();

  const filteredBpmnCompare = useMemo(() => {
    if (!normalizedSearch) return bpmnCompare;

    return bpmnCompare.filter((task) => {
      const body = getBpmnCompareBody(task);

      return [
        task.name,
        task.taskId,
        body,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [bpmnCompare, normalizedSearch]);

  const filteredCodeCompare = useMemo(() => {
    if (!normalizedSearch) return codeCompare;

    return codeCompare.filter((code) => {
      const display = getCodeComparePresentation(code);

      return [
        display.title,
        display.subtitle,
        display.body,
        code.codeUid,
        code.source,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [codeCompare, normalizedSearch]);

  return (
    <Card>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>
            Review Summaries
          </h3>
          <div style={{ color: "#374151", fontSize: 14 }}>
            Summaries used for semantic comparison.
          </div>
        </div>

        <button
          onClick={onRefresh}
          style={{
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #ddd",
            height: "fit-content",
          }}
          disabled={compareLoading}
        >
          {compareLoading ? "Refreshing..." : "Refresh compare"}
        </button>
      </div>

      {compareError ? (
        <div style={{ color: "#a00", marginTop: 8 }}>{compareError}</div>
      ) : null}

      <div style={{ marginTop: 14 }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search BPMN tasks, code functions, summaries..."
          style={{
            width: "100%",
            padding: "11px 13px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
            fontSize: 14,
            outline: "none",
            color: "#111827",
            boxSizing: "border-box",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 12,
          marginTop: 12,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>BPMN Task Summaries</div>

          {filteredBpmnCompare.length === 0 ? (
            <div style={{ color: "#374151" }}>
              {bpmnCompare.length === 0
                ? "No BPMN tasks yet."
                : "No BPMN tasks match your search."}
            </div>
          ) : (
            filteredBpmnCompare.map((task) => (
              <CompareCard
                key={task.taskId}
                title={task.name || "Unnamed Task"}
                subtitle={task.taskId}
                body={getBpmnCompareBody(task)}
              />
            ))
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>Code Function Summaries</div>

          {filteredCodeCompare.length === 0 ? (
            <div style={{ color: "#374151" }}>
              {codeCompare.length === 0
                ? "No code summaries yet."
                : "No code functions match your search."}
            </div>
          ) : (
            filteredCodeCompare.map((code) => {
              const display = getCodeComparePresentation(code);
              const isAi = code.source === "ai";
              const isDev = code.source === "developer";

              return (
                <div key={code.codeUid} style={{ position: "relative" }}>
                  {isAi && (
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        background: "#6c47ff",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 6,
                        padding: "2px 8px",
                        zIndex: 1,
                        letterSpacing: 0.5,
                      }}
                    >
                      AI
                    </span>
                  )}

                  {isDev && (
                    <span
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        background: "#0ea5e9",
                        color: "#fff",
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 6,
                        padding: "2px 8px",
                        zIndex: 1,
                        letterSpacing: 0.5,
                      }}
                    >
                      DEV
                    </span>
                  )}

                  <CompareCard
                    title={display.title}
                    subtitle={getFileNameOnly(display.subtitle)}
                    body={display.body}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>
    </Card>
  );
}