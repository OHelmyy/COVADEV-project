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

export default function CompareTab({
  compareLoading,
  compareError,
  bpmnCompare,
  codeCompare,
  onRefresh,
}: Props) {
  return (
    <Card>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <h3 style={{ marginTop: 0 }}>Compare Inputs (What the system compares)</h3>
        <button
          onClick={onRefresh}
          style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ddd" }}
          disabled={compareLoading}
        >
          {compareLoading ? "Refreshing..." : "Refresh compare"}
        </button>
      </div>

      {compareError ? <div style={{ color: "#a00", marginTop: 8 }}>{compareError}</div> : null}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontWeight: 900 }}>BPMN Task Summaries</div>

          {bpmnCompare.length === 0 ? (
            <div style={{ color: "#888" }}>No BPMN tasks yet.</div>
          ) : (
            bpmnCompare.map((task) => (
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

          {codeCompare.length === 0 ? (
            <div style={{ color: "#888" }}>No code summaries yet.</div>
          ) : (
            codeCompare.map((code) => {
              const display = getCodeComparePresentation(code);

              return (
                <CompareCard
                  key={code.codeUid}
                  title={display.title}
                  subtitle={display.subtitle}
                  body={display.body}
                />
              );
            })
          )}
        </div>
      </div>
    </Card>
  );
}