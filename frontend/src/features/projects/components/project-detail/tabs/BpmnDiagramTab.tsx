import { useEffect, useRef, useState } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import BpmnViewer from "bpmn-js/lib/NavigatedViewer";
import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";

import { Card } from "../ProjectUi";

type Props = {
  projectId: number | string;
  canEdit: boolean;
};

function getCookie(name: string) {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);

  if (parts.length === 2) {
    return parts.pop()?.split(";").shift() || "";
  }

  return "";
}

export default function BpmnDiagramTab({ projectId, canEdit }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const modelerRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function applyMatchStatus(modeler: any) {
    const res = await fetch(`/api/projects/${projectId}/bpmn-match-status/`, {
      method: "GET",
      credentials: "include",
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(
        data.detail || data.error || "Failed to load BPMN match status."
      );
    }

    const canvas = modeler.get("canvas") as any;
    const overlays = modeler.get("overlays") as any;

    const tasks = data.tasks || [];

    tasks.forEach((item: any) => {
      const taskId = item.taskId;
      const status = item.status;

      try {
        if (status === "MATCHED") {
          canvas.addMarker(taskId, "bpmn-task-matched");

          overlays.add(taskId, {
            position: {
              bottom: -12,
              right: -12,
            },
            html: `
              <div class="bpmn-match-badge" title="Matched with code">
                ✓
              </div>
            `,
          });
        }

        if (status === "MISSING") {
          canvas.addMarker(taskId, "bpmn-task-missing");

          overlays.add(taskId, {
            position: {
              bottom: -12,
              right: -12,
            },
            html: `
              <div class="bpmn-missing-badge" title="Missing implementation">
                !
              </div>
            `,
          });
        }
      } catch {
        // Task may not be visible in diagram
      }
    });
  }

  async function applyDiagnostics(modeler: any) {
    const diagnosticsRes = await fetch(
      `/api/projects/${projectId}/bpmn-diagnostics/`,
      {
        method: "GET",
        credentials: "include",
      }
    );

    const diagnostics = await diagnosticsRes.json();

    if (!diagnosticsRes.ok) {
      throw new Error(
        diagnostics.detail ||
          diagnostics.error ||
          "Failed to load BPMN diagnostics."
      );
    }

    const canvas = modeler.get("canvas") as any;
    const overlays = modeler.get("overlays") as any;

    const errors = diagnostics.errors || [];
    const warnings = diagnostics.warnings || [];

    const errorText = errors.join(" ");

    const errorIds = Array.from(
      errorText.matchAll(/[A-Za-z_][A-Za-z0-9_]+/g)
    ).map((m: any) => m[0]);

    const uniqueErrorIds = Array.from(new Set(errorIds));

    uniqueErrorIds.forEach((id) => {
      try {
        canvas.addMarker(id, "bpmn-diagnostic-highlight");

        overlays.add(id, {
          position: {
            top: -14,
            right: -14,
          },
          html: `
            <div class="bpmn-diagnostic-badge" title="BPMN error">
              !
            </div>
          `,
        });
      } catch {
        // Ignore invalid overlay target
      }
    });

    const warningText = warnings.join(" ");

    const warningIds = Array.from(
      warningText.matchAll(/[A-Za-z_][A-Za-z0-9_]+/g)
    ).map((m: any) => m[0]);

    const uniqueWarningIds = Array.from(new Set(warningIds));

    uniqueWarningIds.forEach((id) => {
      try {
        canvas.addMarker(id, "bpmn-warning-highlight");

        overlays.add(id, {
          position: {
            top: -14,
            left: -14,
          },
          html: `
            <div class="bpmn-warning-badge" title="BPMN warning">
              ⚠
            </div>
          `,
        });
      } catch {
        // Ignore invalid overlay target
      }
    });
  }

  async function loadBpmnXml() {
    try {
      setLoading(true);
      setError("");
      setMessage("");

      const res = await fetch(`/api/projects/${projectId}/bpmn-xml/`, {
        method: "GET",
        credentials: "include",
      });

      const xml = await res.text();

      if (!res.ok) {
        throw new Error(xml || "Failed to load BPMN XML.");
      }

      if (!containerRef.current) return;

      if (modelerRef.current) {
        modelerRef.current.destroy();
      }
      const modeler = canEdit
      ? new BpmnModeler({
          container: containerRef.current,
        })
      : new BpmnViewer({
          container: containerRef.current,
        });
      modelerRef.current = modeler;

      await modeler.importXML(xml);

      const canvas = modeler.get("canvas") as any;
      canvas.zoom("fit-viewport");

      await applyDiagnostics(modeler);
      await applyMatchStatus(modeler);
    } catch (err: any) {
      setError(err.message || "Failed to render BPMN diagram.");
    } finally {
      setLoading(false);
    }
  }

  async function saveFixedBpmn() {
    try {
      setSaving(true);
      setError("");
      setMessage("");

      if (!modelerRef.current) {
        throw new Error("BPMN editor is not ready.");
      }

      const result = await modelerRef.current.saveXML({
        format: true,
      });

      const xml = result.xml;

      if (!xml || !xml.trim()) {
        throw new Error("Could not export BPMN XML.");
      }

      const csrfToken = getCookie("csrftoken");

      const res = await fetch(`/api/projects/${projectId}/bpmn-save-fixed/`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": csrfToken,
        },
        body: JSON.stringify({ xml }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.detail || "Failed to save BPMN.");
      }

      setMessage("BPMN saved and revalidated successfully.");

      await loadBpmnXml();
    } catch (err: any) {
      setError(err.message || "Failed to save BPMN.");
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadBpmnXml();

    return () => {
      if (modelerRef.current) {
        modelerRef.current.destroy();
        modelerRef.current = null;
      }
    };
  }, [projectId]);

  return (
    <Card>
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>BPMN Diagram Editor</h3>

          <p
            style={{
              margin: "6px 0 0",
              color: "#64748b",
            }}
          >
            Edit the BPMN process model, fix validation issues, and save the
            corrected workflow.
          </p>
        </div>

        {canEdit ? (
    <button
      onClick={saveFixedBpmn}
      disabled={loading || saving}
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid #2563eb",
        background:
          loading || saving
            ? "#93c5fd"
            : "#2563eb",
        color: "white",
        fontWeight: 800,
        cursor:
          loading || saving
            ? "not-allowed"
            : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {saving ? "Saving..." : "Save Fixed BPMN"}
    </button>
) : null}
      </div>

      {loading ? <p>Loading BPMN diagram...</p> : null}

      {message ? (
        <p style={{ color: "#15803d", fontWeight: 700 }}>{message}</p>
      ) : null}

      {error ? (
        <p style={{ color: "#b91c1c", fontWeight: 700 }}>{error}</p>
      ) : null}

      <div
        ref={containerRef}
        style={{
          height: 700,
          border: "1px solid #e2e8f0",
          borderRadius: 16,
          overflow: "hidden",
          background: "#ffffff",
        }}
      />
    </Card>
  );
}