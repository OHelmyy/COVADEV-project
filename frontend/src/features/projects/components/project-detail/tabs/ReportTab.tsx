import type React from "react";
import { useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import StatusMessage from "../../../../../components/StatusMessage";
import { Card, ScoreBadge } from "../ProjectUi";
import type { LoadState, ReportPayload } from "../../../types/projectDetail";

type Props = {
  canViewReport: boolean;
  reportState: LoadState;
  reportError: string;
  report: ReportPayload;
  projectName: string;
  onRefresh: () => void;
  onRetry: () => void;

  // Optional so the parent file will not break if it still sends this prop.
  onDownloadPdf?: () => void;
};

const styles = {
  screenBackground: {
    background: "#eef2f7",
    padding: "22px",
    borderRadius: 16,
    overflowX: "auto" as const,
  },

  paper: {
    width: "794px",
    minHeight: "1123px",
    margin: "0 auto 24px",
    background: "#ffffff",
    color: "#111827",
    border: "1px solid #d9e2ef",
    boxShadow: "0 16px 40px rgba(15, 23, 42, 0.14)",
    fontFamily: "Arial, sans-serif",
    boxSizing: "border-box" as const,
    pageBreakAfter: "always" as const,
    display: "flex",
    flexDirection: "column" as const,
  },

  pageInner: {
    padding: "46px 52px 34px",
    boxSizing: "border-box" as const,
    flex: 1,
    display: "flex",
    flexDirection: "column" as const,
  },

  header: {
    borderBottom: "4px solid #2563eb",
    paddingBottom: 18,
    marginBottom: 20,
  },

  topLine: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 20,
  },

  label: {
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1.3,
    color: "#2563eb",
    textTransform: "uppercase" as const,
  },

  title: {
    margin: "8px 0 7px",
    fontSize: 25,
    lineHeight: 1.15,
    fontWeight: 950,
    color: "#0f172a",
  },

  subtitle: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.6,
    color: "#475569",
    maxWidth: 480,
  },

  actions: {
    display: "flex",
    flexDirection: "column" as const,
    gap: 8,
    minWidth: 120,
  },

  refreshBtn: {
    padding: "8px 11px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#ffffff",
    color: "#334155",
    fontWeight: 800,
    cursor: "pointer",
    fontSize: 12,
  },

  exportBtn: {
    padding: "8px 11px",
    borderRadius: 8,
    border: "1px solid #1d4ed8",
    background: "#2563eb",
    color: "#ffffff",
    fontWeight: 900,
    cursor: "pointer",
    fontSize: 12,
  },

  section: {
    marginTop: 18,
    pageBreakInside: "avoid" as const,
  },

  sectionTitle: {
    margin: "0 0 10px",
    fontSize: 15,
    fontWeight: 900,
    color: "#0f172a",
    borderBottom: "1px solid #e5e7eb",
    paddingBottom: 7,
  },

  paragraph: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.65,
    color: "#334155",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    tableLayout: "fixed" as const,
    fontSize: 11,
  },

  th: {
    border: "1px solid #cbd5e1",
    background: "#eff6ff",
    color: "#0f172a",
    padding: "7px 8px",
    textAlign: "left" as const,
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase" as const,
    letterSpacing: 0.25,
    lineHeight: 1.3,
    wordBreak: "break-word" as const,
  },

  td: {
    border: "1px solid #e2e8f0",
    padding: "7px 8px",
    verticalAlign: "top" as const,
    color: "#334155",
    lineHeight: 1.45,
    wordBreak: "break-word" as const,
  },

  muted: {
    color: "#64748b",
    fontSize: 10,
    marginTop: 3,
    lineHeight: 1.35,
  },

  code: {
    fontFamily: "Consolas, monospace",
    fontSize: 10,
    background: "#f1f5f9",
    color: "#334155",
    padding: "3px 5px",
    borderRadius: 5,
    display: "inline-block",
    maxWidth: "100%",
    whiteSpace: "normal" as const,
    wordBreak: "break-word" as const,
  },

  kpiGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 8,
    marginTop: 10,
  },

  kpiCard: {
    border: "1px solid #dbe3ef",
    background: "#f8fafc",
    borderRadius: 10,
    padding: 10,
  },

  kpiLabel: {
    fontSize: 9,
    color: "#64748b",
    textTransform: "uppercase" as const,
    fontWeight: 900,
    letterSpacing: 0.35,
  },

  kpiValue: {
    marginTop: 7,
    fontSize: 22,
    fontWeight: 950,
    color: "#0f172a",
  },

  kpiHint: {
    marginTop: 5,
    fontSize: 10,
    color: "#64748b",
    lineHeight: 1.35,
  },

  empty: {
    border: "1px dashed #cbd5e1",
    background: "#f8fafc",
    color: "#64748b",
    padding: 13,
    borderRadius: 10,
    fontSize: 12,
  },

  footer: {
    marginTop: "auto",
    paddingTop: 12,
    borderTop: "1px solid #e5e7eb",
    display: "flex",
    justifyContent: "space-between",
    gap: 12,
    color: "#64748b",
    fontSize: 10,
  },
};

function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }

  return chunks;
}

function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div style={styles.kpiCard}>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={styles.kpiValue}>{value}</div>
      <div style={styles.kpiHint}>{hint}</div>
    </div>
  );
}

function ReportPage({
  pageNumber,
  totalPages,
  children,
}: {
  pageNumber: number;
  totalPages: number;
  children: React.ReactNode;
}) {
  return (
    <div className="covadev-report-paper" style={styles.paper}>
      <div className="covadev-report-inner" style={styles.pageInner}>
        {children}

        <footer style={styles.footer}>
          <div>COVADEV — AI-driven BPMN-to-Code Semantic Validation</div>
          <div>
            Page {pageNumber} of {totalPages}
          </div>
        </footer>
      </div>
    </div>
  );
}

export default function ReportTab({
  canViewReport,
  reportState,
  reportError,
  report,
  projectName,
  onRefresh,
  onRetry,
}: Props) {
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const traceabilityCount = report.traceability.length;
  const missingCount = report.missingTasks.length;
  const extraCount = report.extraCode.length;

  const totalExpectedTasks = traceabilityCount + missingCount;
  const totalFindings = missingCount + extraCount;

  const coverage =
    totalExpectedTasks > 0
      ? Math.round((traceabilityCount / totalExpectedTasks) * 100)
      : 0;

  const alignmentStatus =
    totalFindings === 0
      ? "Excellent"
      : totalFindings <= 3
      ? "Good"
      : totalFindings <= 7
      ? "Needs Review"
      : "Critical Review Required";

  const traceabilityPages = chunkArray(report.traceability.slice(0, 80), 15);
  const missingPages = chunkArray(report.missingTasks.slice(0, 80), 15);
  const extraPages = chunkArray(report.extraCode.slice(0, 80), 15);

  const totalPages =
    1 +
    Math.max(traceabilityPages.length, 1) +
    Math.max(missingPages.length, 1) +
    Math.max(extraPages.length, 1);

  let currentPage = 1;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    const reportElement = reportRef.current;

    if (!reportElement) return;

    try {
      setIsDownloadingPdf(true);

      const actionButtons = reportElement.querySelector(
        ".covadev-report-actions"
      ) as HTMLElement | null;

      if (actionButtons) {
        actionButtons.style.display = "none";
      }

      const pdf = new jsPDF("p", "mm", "a4");

      const pages = Array.from(
        reportElement.querySelectorAll(".covadev-report-paper")
      ) as HTMLElement[];

      for (let index = 0; index < pages.length; index++) {
        const canvas = await html2canvas(pages[index], {
          scale: 2,
          useCORS: true,
          backgroundColor: "#ffffff",
        });

        const imgData = canvas.toDataURL("image/png");

        if (index > 0) {
          pdf.addPage();
        }

        pdf.addImage(imgData, "PNG", 0, 0, 210, 297);
      }

      const safeProjectName = (projectName || "covadev")
        .trim()
        .replace(/[\\/:*?"<>|]/g, "-")
        .replace(/\s+/g, "-")
        .toLowerCase();

      pdf.save(`${safeProjectName}-report.pdf`);

      if (actionButtons) {
        actionButtons.style.display = "";
      }
    } catch (error) {
      console.error("Failed to download PDF:", error);
      alert("Failed to download PDF. Please try again.");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <Card>
      <style>
        {`
          @media print {
            body {
              background: white !important;
            }

            body * {
              visibility: hidden !important;
            }

            .covadev-report-screen,
            .covadev-report-screen * {
              visibility: visible !important;
            }

            .covadev-report-screen {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: white !important;
              padding: 0 !important;
              border-radius: 0 !important;
              overflow: visible !important;
            }

            .covadev-report-paper {
              width: 210mm !important;
              min-height: 297mm !important;
              max-width: none !important;
              margin: 0 !important;
              box-shadow: none !important;
              border: none !important;
              page-break-after: always !important;
              break-after: page !important;
            }

            .covadev-report-paper:last-child {
              page-break-after: auto !important;
              break-after: auto !important;
            }

            .covadev-report-inner {
              padding: 16mm 14mm !important;
              min-height: 297mm !important;
            }

            .covadev-report-actions {
              display: none !important;
            }

            @page {
              size: A4;
              margin: 0;
            }
          }

          @media screen and (max-width: 900px) {
            .covadev-report-inner {
              padding: 34px 28px !important;
            }

            .covadev-report-title {
              font-size: 22px !important;
            }

            .covadev-report-kpis {
              grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
            }
          }
        `}
      </style>

      {!canViewReport ? (
        <div style={{ color: "#888" }}>
          You don't have permission to view this report.
        </div>
      ) : reportState === "loading" || reportState === "idle" ? (
        <StatusMessage
          title="Loading report..."
          message="Fetching report data from backend."
        />
      ) : reportState === "error" ? (
        <StatusMessage
          title="Failed to load report"
          message={reportError}
          onRetry={onRetry}
        />
      ) : (
        <div
          ref={reportRef}
          className="covadev-report-screen"
          style={styles.screenBackground}
        >
          <ReportPage pageNumber={currentPage++} totalPages={totalPages}>
            <header style={styles.header}>
              <div style={styles.topLine}>
                <div>
                  <div style={styles.label}>COVADEV Report</div>
                  <h2 className="covadev-report-title" style={styles.title}>
                    BPMN-to-Code Semantic Validation Report
                  </h2>
                  <p style={styles.subtitle}>
                    This document summarizes the semantic alignment between the uploaded BPMN
                    process model and the implemented source code.
                  </p>
                </div>

                <div className="covadev-report-actions" style={styles.actions}>
                  <button onClick={onRefresh} style={styles.refreshBtn}>
                    Refresh
                  </button>

                  <button
                    onClick={handleDownloadPdf}
                    disabled={isDownloadingPdf}
                    style={{
                      ...styles.exportBtn,
                      opacity: isDownloadingPdf ? 0.7 : 1,
                      cursor: isDownloadingPdf ? "not-allowed" : "pointer",
                    }}
                  >
                    {isDownloadingPdf ? "Downloading..." : "Download PDF"}
                  </button>

                  <button onClick={handlePrint} style={styles.refreshBtn}>
                    Print
                  </button>
                </div>
              </div>
            </header>

            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>1. Report Information</h3>

              <table style={styles.table}>
                <tbody>
                  <tr>
                    <th style={{ ...styles.th, width: "22%" }}>Report Type</th>
                    <td style={{ ...styles.td, width: "28%" }}>
                      Semantic BPMN-to-Code Validation
                    </td>
                    <th style={{ ...styles.th, width: "22%" }}>Generated By</th>
                    <td style={{ ...styles.td, width: "28%" }}>
                      COVADEV Analysis Engine
                    </td>
                  </tr>

                  <tr>
                    <th style={styles.th}>Project Name</th>
                    <td style={styles.td}>{projectName || "Untitled Project"}</td>
                    <th style={styles.th}>Review Status</th>
                    <td style={styles.td}>{alignmentStatus}</td>
                  </tr>

                  <tr>
                    <th style={styles.th}>Traceability Rows</th>
                    <td style={styles.td}>{traceabilityCount}</td>
                    <th style={styles.th}>Total Findings</th>
                    <td style={styles.td}>{totalFindings}</td>
                  </tr>
                </tbody>
              </table>
            </section>

            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>2. Executive Summary</h3>

              <p style={styles.paragraph}>
                The analysis compares BPMN task meanings with extracted code logic using semantic
                similarity. Matched rows indicate implemented business process coverage. Missing
                tasks indicate expected BPMN logic that was not confidently found in the code. Extra
                code indicates implementation logic that was not clearly connected to a BPMN task.
              </p>

              <div className="covadev-report-kpis" style={styles.kpiGrid}>
                <KpiCard
                  label="Coverage"
                  value={`${coverage}%`}
                  hint="Matched BPMN tasks compared to expected BPMN tasks."
                />

                <KpiCard
                  label="Matched"
                  value={traceabilityCount}
                  hint="BPMN tasks with traceable code matches."
                />

                <KpiCard
                  label="Missing"
                  value={missingCount}
                  hint="BPMN tasks without confident code matches."
                />

                <KpiCard
                  label="Extra"
                  value={extraCount}
                  hint="Code elements not clearly linked to BPMN."
                />
              </div>
            </section>

            <section style={styles.section}>
              <h3 style={styles.sectionTitle}>3. Validation Result Summary</h3>

              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={{ ...styles.th, width: "22%" }}>Area</th>
                    <th style={{ ...styles.th, width: "20%" }}>Result</th>
                    <th style={{ ...styles.th, width: "38%" }}>Interpretation</th>
                    <th style={{ ...styles.th, width: "20%" }}>Priority</th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td style={styles.td}>Task Traceability</td>
                    <td style={styles.td}>{traceabilityCount} matched rows</td>
                    <td style={styles.td}>
                      BPMN tasks that were semantically connected to source code.
                    </td>
                    <td style={styles.td}>Informational</td>
                  </tr>

                  <tr>
                    <td style={styles.td}>Missing BPMN Tasks</td>
                    <td style={styles.td}>{missingCount} missing tasks</td>
                    <td style={styles.td}>
                      Business process steps that may not be implemented.
                    </td>
                    <td style={styles.td}>{missingCount > 0 ? "High" : "None"}</td>
                  </tr>

                  <tr>
                    <td style={styles.td}>Extra Code Logic</td>
                    <td style={styles.td}>{extraCount} extra items</td>
                    <td style={styles.td}>
                      Code logic that may be undocumented in the BPMN model.
                    </td>
                    <td style={styles.td}>{extraCount > 0 ? "Medium" : "None"}</td>
                  </tr>

                  <tr>
                    <td style={styles.td}>Overall Alignment</td>
                    <td style={styles.td}>{alignmentStatus}</td>
                    <td style={styles.td}>
                      Final status based on matched, missing, and extra findings.
                    </td>
                    <td style={styles.td}>
                      {alignmentStatus.includes("Critical") ? "High" : "Normal"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>
          </ReportPage>

          {(traceabilityPages.length ? traceabilityPages : [[]]).map((rows, pageIndex) => (
            <ReportPage
              key={`traceability-page-${pageIndex}`}
              pageNumber={currentPage++}
              totalPages={totalPages}
            >
              <section style={{ ...styles.section, marginTop: 0 }}>
                <h3 style={styles.sectionTitle}>
                  4. Task-level Traceability Matrix
                  {traceabilityPages.length > 1 ? ` — Continued ${pageIndex + 1}` : ""}
                </h3>

                {rows.length ? (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, width: "7%" }}>#</th>
                        <th style={{ ...styles.th, width: "31%" }}>BPMN Task</th>
                        <th style={{ ...styles.th, width: "38%" }}>Best Code Match</th>
                        <th style={{ ...styles.th, width: "13%" }}>Similarity</th>
                        <th style={{ ...styles.th, width: "11%" }}>Note</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={`${row.taskId}-${pageIndex}-${index}`}>
                          <td style={styles.td}>{pageIndex * 15 + index + 1}</td>

                          <td style={styles.td}>
                            <strong style={{ color: "#0f172a" }}>{row.taskName}</strong>
                            <div style={styles.muted}>{row.taskId}</div>
                          </td>

                          <td style={styles.td}>
                            <code style={styles.code}>{row.bestMatch}</code>
                          </td>

                          <td style={styles.td}>
                            <ScoreBadge value={row.similarity} />
                          </td>

                          <td style={styles.td}>{row.note ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={styles.empty}>No traceability results available.</div>
                )}
              </section>
            </ReportPage>
          ))}

          {(missingPages.length ? missingPages : [[]]).map((rows, pageIndex) => (
            <ReportPage
              key={`missing-page-${pageIndex}`}
              pageNumber={currentPage++}
              totalPages={totalPages}
            >
              <section style={{ ...styles.section, marginTop: 0 }}>
                <h3 style={styles.sectionTitle}>
                  5. Missing BPMN Tasks
                  {missingPages.length > 1 ? ` — Continued ${pageIndex + 1}` : ""}
                </h3>

                {rows.length ? (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, width: "7%" }}>#</th>
                        <th style={{ ...styles.th, width: "33%" }}>Task</th>
                        <th style={{ ...styles.th, width: "22%" }}>Reason</th>
                        <th style={{ ...styles.th, width: "38%" }}>Recommended Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((item, index) => (
                        <tr key={`${item.taskId}-${pageIndex}-${index}`}>
                          <td style={styles.td}>{pageIndex * 15 + index + 1}</td>

                          <td style={styles.td}>
                            <strong style={{ color: "#0f172a" }}>{item.taskName}</strong>
                            <div style={styles.muted}>{item.taskId}</div>
                          </td>

                          <td style={styles.td}>{item.reason}</td>

                          <td style={styles.td}>
                            Review the implementation and add or connect code that covers this BPMN
                            task.
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={styles.empty}>No missing BPMN tasks were detected.</div>
                )}
              </section>
            </ReportPage>
          ))}

          {(extraPages.length ? extraPages : [[]]).map((rows, pageIndex) => (
            <ReportPage
              key={`extra-page-${pageIndex}`}
              pageNumber={currentPage++}
              totalPages={totalPages}
            >
              <section style={{ ...styles.section, marginTop: 0 }}>
                <h3 style={styles.sectionTitle}>
                  6. Extra Code Findings
                  {extraPages.length > 1 ? ` — Continued ${pageIndex + 1}` : ""}
                </h3>

                {rows.length ? (
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ ...styles.th, width: "7%" }}>#</th>
                        <th style={{ ...styles.th, width: "42%" }}>Code Reference</th>
                        <th style={{ ...styles.th, width: "17%" }}>Reason</th>
                        <th style={{ ...styles.th, width: "34%" }}>Recommended Action</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rows.map((item, index) => (
                        <tr key={`${item.id}-${pageIndex}-${index}`}>
                          <td style={styles.td}>{pageIndex * 15 + index + 1}</td>

                          <td style={styles.td}>
                            <code style={styles.code}>{item.id}</code>

                            <div style={{ marginTop: 5 }}>
                              <code style={styles.code}>{item.file}</code>
                            </div>

                            <div style={{ ...styles.muted, marginTop: 5 }}>{item.symbol}</div>
                          </td>

                          <td style={styles.td}>{item.reason}</td>

                          <td style={styles.td}>
                            Check whether this code is valid additional logic or should be reflected
                            in the BPMN model.
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div style={styles.empty}>No extra code findings were detected.</div>
                )}
              </section>
            </ReportPage>
          ))}
        </div>
      )}
    </Card>
  );
}