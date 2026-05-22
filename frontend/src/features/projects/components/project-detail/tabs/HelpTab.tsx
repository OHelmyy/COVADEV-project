import { useState } from "react";
import { inputBase, ui } from "../../../../../theme/ui";

// ── Types ──────────────────────────────────────────────────────────────────────

type HelpItem = {
  q: string;
  a: string | string[];
  steps?: string[];
  tags?: string[];
};

type Section = {
  icon: string;
  title: string;
  color: string;
  soft: string;
  border: string;
  items: HelpItem[];
};

// ── Developer Content ──────────────────────────────────────────────────────────

const DEVELOPER_SECTIONS: Section[] = [
  {
    icon: "🚀",
    title: "Getting Started",
    color: "#6366f1",
    soft: "#eef2ff",
    border: "#c7d2fe",
    items: [
      {
        q: "What is my workflow as a developer?",
        a: "Your tasks go through these stages in order:",
        steps: [
          "Assigned — the project manager assigned a BPMN task to you",
          "In Progress — you clicked Start Task and are actively working on it",
          "Submitted — you submitted your work via GitHub PR or ZIP file",
          "Under Review — the evaluator is reviewing your submission",
          "Accepted — your submission was approved ✅",
          "Changes Requested — the evaluator wants you to improve something",
          "Rejected — the submission was rejected, you may need to resubmit",
        ],
        tags: ["workflow", "status"],
      },
      {
        q: "Where do I see my tasks?",
        a: [
          "Go to a specific project → My Tasks tab to see tasks assigned to you in that project.",
          "Or use the My Tasks link in the top navigation to see all your tasks across all projects.",
        ],
      },
      {
        q: "How do I start a task?",
        a: "Open the My Tasks tab in your project. Find the task with status Assigned and click the Start Task button. This marks you as actively working on it.",
      },
    ],
  },
  {
    icon: "🔗",
    title: "Submitting via GitHub PR",
    color: "#0ea5e9",
    soft: "#f0f9ff",
    border: "#bae6fd",
    items: [
      {
        q: "How do I submit using a GitHub Pull Request?",
        a: "When your task has a GitHub branch assigned, push your code to that branch and open a Pull Request on GitHub. Then come back here and submit:",
        steps: [
          "Push your code to the assigned branch shown on your task card",
          "Open a Pull Request on GitHub from that branch to the main branch",
          "Note your PR number (e.g. #23)",
          "In My Tasks, click Submit via GitHub PR",
          "Enter the PR number and optionally add a submission note",
          "Click Submit PR — the system links your PR automatically",
        ],
        tags: ["github", "pr", "submit"],
      },
      {
        q: "Where do I find my assigned GitHub branch?",
        a: "On your task card in My Tasks, you'll see a blue 🔗 branch link. Click it to go directly to your branch on GitHub.",
      },
      {
        q: "Can I submit without a GitHub PR?",
        a: "Yes — use the Submit via ZIP option. You can upload a .zip file of your code directly without needing GitHub.",
      },
    ],
  },
  {
    icon: "📦",
    title: "Submitting via ZIP",
    color: "#10b981",
    soft: "#ecfdf5",
    border: "#a7f3d0",
    items: [
      {
        q: "How do I submit a ZIP file?",
        a: "In My Tasks, switch to the Submit via ZIP tab on your task card:",
        steps: [
          "Make sure your task is In Progress",
          "Click the Submit via ZIP tab",
          "Click Upload ZIP File",
          "Select your .zip file from your computer",
          "The file uploads and submits automatically",
        ],
        tags: ["zip", "upload", "submit"],
      },
      {
        q: "What should my ZIP file contain?",
        a: "Your ZIP should contain only the Python code files relevant to the task. Include the source files, not build artifacts or virtual environments. The system extracts and analyzes Python functions from your code.",
      },
    ],
  },
  {
    icon: "🔍",
    title: "Preview Score",
    color: "#f59e0b",
    soft: "#fffbeb",
    border: "#fde68a",
    items: [
      {
        q: "What is Preview Score?",
        a: "Preview Score lets you check how closely your code matches the expected task implementation before you submit. It runs the same similarity analysis the system uses — but saves nothing and changes nothing.",
      },
      {
        q: "How do I use Preview Score?",
        a: "On your task card (status must be In Progress or Changes Requested), click 🔍 Preview My Score:",
        steps: [
          "Click 🔍 Preview My Score to expand the panel",
          "Choose From GitHub Branch (if you have pushed your code) or From ZIP File",
          "Wait for the analysis to finish",
          "See your similarity % vs the required threshold",
          "✅ means you're above threshold, ⚠️ means you should improve before submitting",
        ],
        tags: ["preview", "score", "similarity"],
      },
      {
        q: "What does the similarity percentage mean?",
        a: "It measures how closely your code's semantic meaning matches what the BPMN task description expects. Higher is better. If your score is below the threshold, your submission may not be accepted automatically — but the evaluator makes the final call.",
      },
    ],
  },
  {
    icon: "⚠️",
    title: "Changes Requested",
    color: "#ef4444",
    soft: "#fef2f2",
    border: "#fecaca",
    items: [
      {
        q: "What does Changes Requested mean?",
        a: "The evaluator reviewed your submission and wants you to improve it. Read their feedback carefully — it will appear as a highlighted orange banner on your task card.",
      },
      {
        q: "What do I do when I get Changes Requested?",
        a: "Make the requested changes to your code, then resubmit:",
        steps: [
          "Read the evaluator feedback on your task card",
          "Fix or improve your code accordingly",
          "Use Preview Score to check your new code if you're unsure",
          "Submit again via GitHub PR (update your PR) or upload a new ZIP",
        ],
      },
      {
        q: "Can I use Preview Score when status is Changes Requested?",
        a: "Yes — the Preview Score panel is available for both In Progress and Changes Requested tasks.",
      },
    ],
  },
  {
    icon: "📊",
    title: "Scores & Evaluation",
    color: "#8b5cf6",
    soft: "#f5f3ff",
    border: "#ddd6fe",
    items: [
      {
        q: "How is my work evaluated?",
        a: "After your submission is accepted, the evaluator scores it across 4 dimensions (each out of 10):",
        steps: [
          "Correctness — does your code do what the task requires?",
          "Quality — is the code clean, readable, and well-structured?",
          "Timeliness — did you submit promptly?",
          "Communication — were your submission notes clear and helpful?",
        ],
        tags: ["evaluation", "score"],
      },
      {
        q: "Where do I see my evaluation scores?",
        a: "Go to the Submission History tab in your project. Accepted tasks show a 📊 Evaluation Scores card with progress bars for each dimension and your final score.",
      },
    ],
  },
];

// ── Evaluator Content ──────────────────────────────────────────────────────────

const EVALUATOR_SECTIONS: Section[] = [
  {
    icon: "🎯",
    title: "Assigning Tasks",
    color: "#6366f1",
    soft: "#eef2ff",
    border: "#c7d2fe",
    items: [
      {
        q: "How do I assign a task to a developer?",
        a: "Go to your project → Tasks & Submissions → Task Management:",
        steps: [
          "Use the Create Task Assignment form at the top",
          "Select an available BPMN task from the dropdown (🟢 Available ones)",
          "Select the developer or AI agent to assign",
          "Check Auto-create GitHub branch if you want a branch created automatically",
          "Click Assign BPMN Task",
        ],
        tags: ["assign", "task"],
      },
      {
        q: "How do I reassign a task to a different developer?",
        a: "In the task assignments table, find the row of the task you want to reassign. Click the 🔄 Reassign button. A panel will expand below the row — select the new developer from the dropdown and click Confirm Reassign. The task resets to Assigned status for the new developer.",
      },
      {
        q: "Can I assign a task to the AI agent?",
        a: "Yes — select the AI Agent option from the developer dropdown. The system will check if the task is suitable for AI (Recommended / Neutral / Not Recommended). You can still assign it even if it's marked Not Recommended, but you'll see a confirmation warning.",
      },
      {
        q: "What do the AI suitability labels mean?",
        a: "The system reads the task description and classifies it:",
        steps: [
          "✅ Recommended — clear, bounded Python coding task (CRUD, validation, unit tests, business logic)",
          "⚠️ Neutral — could go either way",
          "❌ Not Recommended — architecture decisions, security-sensitive, non-Python, or requires wide context",
        ],
        tags: ["ai", "suitability"],
      },
    ],
  },
  {
    icon: "📋",
    title: "Reviewing Submissions",
    color: "#0ea5e9",
    soft: "#f0f9ff",
    border: "#bae6fd",
    items: [
      {
        q: "How do I review a developer submission?",
        a: "Go to Tasks & Submissions → Dev Submissions. Find submissions with Pending status:",
        steps: [
          "Review the submission details (attempt number, similarity score, GitHub PR or ZIP)",
          "View the files if it's a ZIP submission",
          "Click Accept to approve or Reject to send back",
          "Optionally add review notes — if rejecting, explain what needs to change",
          "If you choose Needs Changes, the developer gets an alert and can resubmit",
        ],
        tags: ["review", "accept", "reject"],
      },
      {
        q: "What does the similarity score mean?",
        a: "It shows how closely the developer's code matches the BPMN task's expected implementation semantically. It's a guide — not a hard rule. Use your judgment alongside it. A low score may still be acceptable if the code is correct.",
      },
      {
        q: "Can I view the files in a ZIP submission?",
        a: "Yes — in Dev Submissions, expand a submission and click View Files to browse the file tree and read the submitted code inline.",
      },
    ],
  },
  {
    icon: "🤖",
    title: "AI Submissions",
    color: "#8b5cf6",
    soft: "#f5f3ff",
    border: "#ddd6fe",
    items: [
      {
        q: "How do I review AI-generated code?",
        a: "In Task Management, find a task assigned to the AI Agent. Once the AI has submitted, click View AI Work to see the generated files with syntax highlighting.",
      },
      {
        q: "What if the AI submission is not good enough?",
        a: "You have two options in the task row:",
        steps: [
          "Send Back to AI — click this to give the AI specific feedback and trigger a retry (up to 2 retries allowed)",
          "Reassign — use 🔄 Reassign to move the task to a human developer instead",
        ],
      },
      {
        q: "How does AI retry work?",
        a: "When you send feedback to the AI, it re-runs the code generation with your instructions as additional context. The new attempt is pushed to the same GitHub branch and a new PR is opened. You can retry up to 2 times.",
      },
      {
        q: "What happens when I accept an AI submission?",
        a: "The AI's generated files are pushed to the GitHub branch, a PR is opened automatically, and you can accept & merge it directly from Dev Submissions — same flow as a human developer's PR.",
      },
    ],
  },
  {
    icon: "⭐",
    title: "Evaluating Scores",
    color: "#f59e0b",
    soft: "#fffbeb",
    border: "#fde68a",
    items: [
      {
        q: "When should I evaluate a submission?",
        a: "After accepting a submission, click the Evaluate button on the task row to score the developer's work. You can also update the evaluation later.",
      },
      {
        q: "What are the 4 evaluation dimensions?",
        a: "Each is scored from 0 to 10:",
        steps: [
          "Correctness — does the code correctly implement the task requirements?",
          "Quality — is the code clean, well-structured, and readable?",
          "Timeliness — how quickly did the developer submit relative to when they were assigned?",
          "Communication — were their submission notes clear and professional?",
        ],
        tags: ["score", "evaluation"],
      },
      {
        q: "Can I auto-evaluate?",
        a: "Yes — click Auto Evaluate to let the system generate scores based on the similarity analysis and submission metadata. You can then adjust the scores manually before saving.",
      },
    ],
  },
  {
    icon: "📊",
    title: "Tracking Performance",
    color: "#10b981",
    soft: "#ecfdf5",
    border: "#a7f3d0",
    items: [
      {
        q: "Where do I see developer performance?",
        a: "Use the Developer Performance link in the top navigation. It shows each developer's acceptance rate, average score, and task counts across all projects.",
      },
      {
        q: "Where do I see per-project performance?",
        a: "In your project → Analysis & Results → Results tab. You'll see matched vs missing tasks, coverage percentage, and average similarity scores.",
      },
    ],
  },
];

// ── Accordion Item ─────────────────────────────────────────────────────────────

function AccordionItem({ item, color, soft, border }: {
  item: HelpItem; color: string; soft: string; border: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{
      border: `1px solid ${open ? border : "#e5e7eb"}`,
      borderRadius: 12,
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "14px 18px",
          background: open ? soft : "#fff",
          border: "none",
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          transition: "background 0.2s",
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14, color: open ? color : "#1e293b", flex: 1 }}>
          {item.q}
        </span>
        <span style={{ fontSize: 18, color, flexShrink: 0, fontWeight: 900 }}>
          {open ? "−" : "+"}
        </span>
      </button>

      {open && (
        <div style={{ padding: "0 18px 16px", background: "#fafafa", borderTop: `1px solid ${border}` }}>
          {Array.isArray(item.a) ? (
            item.a.map((line, i) => (
              <p key={i} style={{ margin: i === 0 ? "14px 0 8px" : "4px 0 8px", fontSize: 13, color: "#334155", lineHeight: 1.7 }}>{line}</p>
            ))
          ) : (
            <p style={{ margin: "14px 0 8px", fontSize: 13, color: "#334155", lineHeight: 1.7 }}>{item.a}</p>
          )}
          {item.steps && (
            <ol style={{ margin: "10px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 6 }}>
              {item.steps.map((step, i) => (
                <li key={i} style={{ fontSize: 13, color: "#475569", lineHeight: 1.6 }}>
                  <span style={{ fontWeight: 600, color }}>{i + 1}.</span>{" "}{step}
                </li>
              ))}
            </ol>
          )}
          {item.tags && (
            <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
              {item.tags.map(tag => (
                <span key={tag} style={{
                  fontSize: 11, fontWeight: 700, background: soft, color,
                  border: `1px solid ${border}`, padding: "2px 9px", borderRadius: 999,
                }}>
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Section Card ───────────────────────────────────────────────────────────────

function SectionCard({ section }: { section: Section }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div id={`help-section-${section.title}`} style={{
      background: "#fff",
      borderRadius: 16,
      border: `1.5px solid ${section.border}`,
      overflow: "hidden",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
    }}>
      <button
        onClick={() => setCollapsed(v => !v)}
        style={{
          width: "100%",
          textAlign: "left",
          padding: "18px 22px",
          background: section.soft,
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        <span style={{ width: 14, height: 14, borderRadius: "50%", background: section.color, display: "inline-block", flexShrink: 0 }} />
        <span style={{ fontWeight: 900, fontSize: 16, color: section.color, flex: 1 }}>{section.title}</span>
        <span style={{ fontSize: 13, color: section.color, fontWeight: 700, opacity: 0.7 }}>
          {section.items.length} {section.items.length === 1 ? "topic" : "topics"}
        </span>
        <span style={{ fontSize: 18, color: section.color, fontWeight: 900 }}>{collapsed ? "▼" : "▲"}</span>
      </button>

      {!collapsed && (
        <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {section.items.map((item, i) => (
            <AccordionItem key={i} item={item} color={section.color} soft={section.soft} border={section.border} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main HelpTab ───────────────────────────────────────────────────────────────

export default function HelpTab({ role }: { role: "developer" | "evaluator" }) {
  const isDeveloper = role === "developer";
  const sections = isDeveloper ? DEVELOPER_SECTIONS : EVALUATOR_SECTIONS;

  const [search, setSearch] = useState("");
  const q = search.trim().toLowerCase();

  const filtered = q
    ? sections.map(s => ({
        ...s,
        items: s.items.filter(
          item =>
            item.q.toLowerCase().includes(q) ||
            (typeof item.a === "string" ? item.a : item.a.join(" ")).toLowerCase().includes(q) ||
            (item.steps || []).join(" ").toLowerCase().includes(q) ||
            (item.tags || []).join(" ").toLowerCase().includes(q)
        ),
      })).filter(s => s.items.length > 0)
    : sections;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* Hero banner */}
      <div style={{
        background: `linear-gradient(135deg, ${ui.colors.primary} 0%, ${ui.colors.accent} 100%)`,
        borderRadius: 18,
        padding: "28px 32px",
        boxShadow: "0 6px 24px rgba(15,61,145,0.18)",
        color: "#fff",
      }}>
        <h2 style={{ margin: "0 0 8px", fontSize: 24, fontWeight: 900, color: "#fff" }}>
          {isDeveloper ? "Developer Help Center" : "Evaluator Help Center"}
        </h2>
        <p style={{ margin: 0, fontSize: 14, opacity: 0.9, lineHeight: 1.6, color: "#fff" }}>
          {isDeveloper
            ? "Everything you need to know about completing tasks, submitting your work, and improving your scores."
            : "Everything you need to know about assigning tasks, reviewing submissions, evaluating developers, and using AI assistance."}
        </p>
      </div>

      {/* Search */}
      <div style={{ position: "relative" }}>
        <svg style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={ui.colors.textMuted} strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search — submit, score, GitHub, AI, reassign…"
          style={{ ...inputBase, width: "100%", padding: "11px 40px 11px 40px", fontSize: 14, boxSizing: "border-box" }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 18, color: ui.colors.textMuted }}
          >
            ×
          </button>
        )}
      </div>

      {/* Quick-jump chips */}
      {!q && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {sections.map(s => (
            <button
              key={s.title}
              onClick={() => {
                const el = document.getElementById(`help-section-${s.title}`);
                el?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              style={{
                background: s.soft,
                border: `1px solid ${s.border}`,
                borderRadius: 999,
                padding: "6px 14px",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 700,
                color: s.color,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color, display: "inline-block", flexShrink: 0 }} />
              {s.title}
            </button>
          ))}
        </div>
      )}

      {/* Sections */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "52px 0", background: "#fff", borderRadius: 14, border: `1px dashed ${ui.colors.borderStrong}` }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: ui.colors.primarySoft, border: `2px solid ${ui.colors.border}`, margin: "0 auto 12px" }} />
          <div style={{ fontWeight: 700, fontSize: 16, color: ui.colors.text, marginBottom: 6 }}>No results for "{search}"</div>
          <div style={{ fontSize: 13, color: ui.colors.textMuted }}>Try different keywords or clear the search.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {filtered.map(section => (
            <SectionCard key={section.title} section={section} />
          ))}
        </div>
      )}

      {/* Contact / Footer */}
      <div style={{
        background: "#fff",
        borderRadius: 14,
        border: "1.5px solid #e2e8f0",
        padding: "20px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 12,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 28 }}>📬</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: "#1e293b" }}>Need more help?</div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>Reach out to the COVADEV team</div>
          </div>
        </div>
        <a
          href="https://mail.google.com/mail/?view=cm&to=Covadev@gmail.com"
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "linear-gradient(135deg, #0f3d91 0%, #06b6d4 100%)",
            color: "#fff",
            fontWeight: 800,
            fontSize: 13,
            padding: "10px 20px",
            borderRadius: 10,
            textDecoration: "none",
            boxShadow: "0 2px 8px rgba(15,61,145,0.2)",
          }}
        >
          ✉️ Covadev@gmail.com
        </a>
      </div>

      <div style={{ textAlign: "center", fontSize: 12, color: "#cbd5e1", paddingTop: 4 }}>
        COVADEV — BPMN • Code • AI Traceability
      </div>
    </div>
  );
}
