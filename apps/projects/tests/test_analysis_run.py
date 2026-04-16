import numpy as np

from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User

from apps.projects.models import Project, ProjectMembership, ProjectFile
from apps.analysis.models import AnalysisRun, BpmnTask, MatchResult
from apps.analysis.summary.bpmn_task_summary import summarize_bpmn_task
from apps.analysis.summary.code_summary_service import SummaryService
from apps.analysis.embeddings.embedder import LocalEmbedder
from apps.analysis.semantic.similarity import compute_similarity
from apps.analysis.semantic.matcher import greedy_one_to_one_match
from apps.analysis.services.services import compute_metrics_from_similarity_payload


# ------------------------------------------------------------------ #
# Shared test data — 3 BPMN tasks + 3 code functions
# ------------------------------------------------------------------ #

RAW_BPMN_TASKS = [
    {
        "name": "Validate Order Form",
        "description": "Validates the submitted order form fields, checks required fields are filled, and raises an error if any field is missing or invalid.",
        "task_type": "serviceTask",
        "incoming": ["Start Event"],
        "outgoing": ["Charge Payment"],
    },
    {
        "name": "Charge Customer Payment",
        "description": "Charges the customer's credit card for the total order amount using the payment gateway and saves the transaction result to the order record.",
        "task_type": "serviceTask",
        "incoming": ["Validate Order Form"],
        "outgoing": ["Send Email"],
    },
    {
        "name": "Send Order Confirmation Email",
        "description": "Sends a confirmation email to the customer's email address containing the order summary and receipt after payment is successful.",
        "task_type": "sendTask",
        "incoming": ["Charge Payment"],
        "outgoing": ["End Event"],
    },
]

STRUCTURED_FUNCTIONS = [
    {
        "function_uid": "uid_001",
        "function_name": "validate_order_form",
        "file_path": "app/validators.py",
        "language": "python",
        "kind": "function",
        "raw_snippet": "def validate_order_form(data):\n    required = ['email', 'address', 'items']\n    for field in required:\n        if not data.get(field):\n            raise ValueError(f'{field} is required')\n    return True",
        "calls": [],
        "writes": [],
        "returns": ["bool"],
        "exceptions": ["ValueError"],
    },
    {
        "function_uid": "uid_002",
        "function_name": "charge_customer_card",
        "file_path": "app/payments.py",
        "language": "python",
        "kind": "function",
        "raw_snippet": "def charge_customer_card(order, card_details):\n    result = payment_gateway.charge(card_details, order.total)\n    order.paid = True\n    order.transaction_id = result.id\n    order.save()\n    return result",
        "calls": ["payment_gateway.charge", "order.save"],
        "writes": ["order.paid", "order.transaction_id"],
        "returns": ["result"],
        "exceptions": ["PaymentError"],
    },
    {
        "function_uid": "uid_003",
        "function_name": "send_order_confirmation_email",
        "file_path": "app/notifications.py",
        "language": "python",
        "kind": "function",
        "raw_snippet": "def send_order_confirmation_email(user, order):\n    subject = f'Order #{order.id} Confirmed'\n    body = render_template('order_confirmation.html', order=order)\n    send_mail(subject, body, to=user.email)",
        "calls": ["render_template", "send_mail"],
        "writes": [],
        "returns": [],
        "exceptions": [],
    },
]


# ------------------------------------------------------------------ #
# Helpers
# ------------------------------------------------------------------ #

def make_user(username, password="pass1234", role="DEVELOPER"):
    u = User.objects.create_user(username=username, email=f"{username}@test.com", password=password)
    u.profile.role = role
    u.profile.save()
    return u


def make_project(admin, evaluator, name="Test Project"):
    return Project.objects.create(
        name=name,
        description="A test project",
        created_by=admin,
        evaluator=evaluator,
    )


def make_bpmn_file(project, uploader, summary="A valid BPMN summary."):
    return ProjectFile.objects.create(
        project=project,
        file_type="BPMN",
        original_name="test.bpmn",
        stored_path="bpmn/test.bpmn",
        uploaded_by=uploader,
        is_well_formed=True,
        bpmn_summary=summary,
    )


def make_code_file(project, uploader):
    return ProjectFile.objects.create(
        project=project,
        file_type="CODE",
        original_name="code.zip",
        stored_path="projects/1/code/code.zip",
        extracted_dir="/media/projects/1/code/extracted",
        uploaded_by=uploader,
    )


def generate_bpmn_summaries():
    summaries = []
    for task in RAW_BPMN_TASKS:
        summary = summarize_bpmn_task(
            name=task["name"],
            description=task["description"],
            task_type=task["task_type"],
            incoming=task["incoming"],
            outgoing=task["outgoing"],
        )
        summaries.append(summary)
    return summaries


def generate_code_summaries():
    summarizer = SummaryService()
    return summarizer.summarize_many(STRUCTURED_FUNCTIONS)


def compute_real_similarity(bpmn_summaries, code_summaries):
    embedder = LocalEmbedder()
    code_texts = [
        code_summaries.get(sf["function_uid"], sf["function_name"])
        for sf in STRUCTURED_FUNCTIONS
    ]
    bpmn_vectors = embedder.embed_many(bpmn_summaries)
    code_vectors  = embedder.embed_many(code_texts)

    task_embeddings = [{"id": f"t{i}", "vector": r.vector} for i, r in enumerate(bpmn_vectors)]
    code_embeddings = [{"id": f"c{i}", "vector": r.vector} for i, r in enumerate(code_vectors)]

    similarity = compute_similarity(
        task_embeddings=task_embeddings,
        code_embeddings=code_embeddings,
    )
    return np.array(similarity["matrix"]), similarity


def print_summaries(bpmn_summaries, code_summaries):
    print("\n========== BPMN Task Summaries ==========")
    for task, summary in zip(RAW_BPMN_TASKS, bpmn_summaries):
        print(f"  Task    : {task['name']}")
        print(f"  Summary : {summary}")
        print()

    print("========== Code Summaries ==========")
    for sf in STRUCTURED_FUNCTIONS:
        print(f"  Function : {sf['function_name']}")
        print(f"  Summary  : {code_summaries.get(sf['function_uid'], '(no summary)')}")
        print()


def print_similarity_matrix(sim_matrix):
    task_names = [t["name"] for t in RAW_BPMN_TASKS]
    code_names = [sf["function_name"] for sf in STRUCTURED_FUNCTIONS]

    col_w = max(len(n) for n in code_names) + 2
    row_w = max(len(n) for n in task_names) + 2

    print("========== Similarity Matrix (all-MiniLM-L6-v2) ==========")
    header = " " * row_w + "".join(f"{n:>{col_w}}" for n in code_names)
    print(header)
    print("-" * len(header))
    for i, task_name in enumerate(task_names):
        row = f"{task_name:<{row_w}}"
        for j in range(len(code_names)):
            row += f"{sim_matrix[i][j]:>{col_w}.3f}"
        print(row)

    print("\n  Highest matches:")
    for i, task_name in enumerate(task_names):
        best_j = int(np.argmax(sim_matrix[i]))
        print(f"  {task_name} --> {code_names[best_j]} (score: {sim_matrix[i][best_j]:.3f})")
    print("==========================================================\n")


# ------------------------------------------------------------------ #
# Test class
# ------------------------------------------------------------------ #

class AnalysisRunTests(TestCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        # Generate real summaries + similarity ONCE for the entire test class
        print("\n>>> Generating summaries and similarity matrix (runs once)...")
        cls.bpmn_summaries = generate_bpmn_summaries()
        cls.code_summaries = generate_code_summaries()
        cls.sim_matrix, cls.similarity = compute_real_similarity(
            cls.bpmn_summaries, cls.code_summaries
        )
        print_summaries(cls.bpmn_summaries, cls.code_summaries)
        print_similarity_matrix(cls.sim_matrix)

    def setUp(self):
        self.client    = Client()
        self.admin     = make_user("admin_user", role="ADMIN")
        self.evaluator = make_user("eval_user",  role="EVALUATOR")
        self.dev       = make_user("dev_user",   role="DEVELOPER")

        self.project = make_project(self.admin, self.evaluator)
        ProjectMembership.objects.create(project=self.project, user=self.dev)

        self.bpmn_file = make_bpmn_file(self.project, self.evaluator)
        self.code_file = make_code_file(self.project, self.dev)
        self.project.active_bpmn = self.bpmn_file
        self.project.active_code = self.code_file
        self.project.save(update_fields=["active_bpmn", "active_code"])

    # ------------------------------------------------------------------ #
    # TC25 – Run validation with active BPMN and code (FR18)
    # ------------------------------------------------------------------ #
    def test_run_analysis_creates_analysis_run(self):
        # Store real BpmnTask rows with generated summaries
        for i, task in enumerate(RAW_BPMN_TASKS):
            BpmnTask.objects.create(
                project=self.project,
                task_id=f"t{i+1}",
                name=task["name"],
                summary_text=self.bpmn_summaries[i],
            )

        # Match using real similarity
        matching = greedy_one_to_one_match(similarity=self.similarity, threshold=0.6)

        task_map = {t.task_id: t for t in BpmnTask.objects.filter(project=self.project)}
        for item in matching.get("matched", []):
            MatchResult.objects.create(
                project=self.project,
                task=task_map.get(item.get("task_id")),
                code_ref=item.get("code_ref", ""),
                similarity_score=float(item.get("score", 0)),
                status="MATCHED",
            )

        run = AnalysisRun.objects.create(project=self.project, status="DONE")

        print(f"\n  AnalysisRun created: id={run.id}, status={run.status}")
        print(f"  MatchResult rows stored: {MatchResult.objects.filter(project=self.project).count()}")

        self.assertTrue(AnalysisRun.objects.filter(project=self.project, status="DONE").exists())

    # ------------------------------------------------------------------ #
    # TC26 – View analysis results (matches/missing/extra + scores) (FR19)
    # ------------------------------------------------------------------ #
    def test_run_project_endpoint_returns_results(self):
        matching = greedy_one_to_one_match(similarity=self.similarity, threshold=0.6)

        print("\n  Matched results:")
        for m in matching.get("matched", []):
            print(f"    {m}")

        self.assertIn("matched", matching)
        self.assertIn("missing", matching)
        self.assertIn("extra", matching)

        for m in matching.get("matched", []):
            self.assertIn("score", m)
            self.assertGreater(m["score"], 0)

    # ------------------------------------------------------------------ #
    # TC27 – View project-level metrics (coverage/alignment) (FR20)
    # ------------------------------------------------------------------ #
    def test_metrics_summary_returns_coverage_and_alignment(self):
        matching = greedy_one_to_one_match(similarity=self.similarity, threshold=0.6)

        # Build matches in the format evaluate_traceability expects
        matches_payload = [
            {
                "taskId": m.get("task_id", ""),
                "codeId": m.get("code_id", ""),
                "similarity": float(m.get("score", 0)),
            }
            for m in matching.get("matched", [])
        ]

        payload = {
            "threshold": 0.6,
            "bpmn_tasks": [{"taskId": f"t{i}", "taskName": t["name"]} for i, t in enumerate(RAW_BPMN_TASKS)],
            "code_items": [{"codeId": sf["function_uid"], "symbol": sf["function_name"]} for sf in STRUCTURED_FUNCTIONS],
            "matches": matches_payload,
        }

        result = compute_metrics_from_similarity_payload(payload)

        print("\n  Metrics result:")
        print(f"    {result.get('summary', result)}")

        summary = result.get("summary", {})
        self.assertGreater(summary.get("total_tasks", 0), 0)
        self.assertGreater(summary.get("matched_count", 0), 0)
        self.assertGreaterEqual(summary.get("alignment", 0), 0)
        self.assertGreaterEqual(summary.get("precision", 0), 0)
        self.assertGreaterEqual(summary.get("recall", 0), 0)

    # ------------------------------------------------------------------ #
    # TC29 – Run validation with missing active artifacts (FR18)
    # ------------------------------------------------------------------ #
    def test_run_analysis_blocked_when_no_active_bpmn(self):
        self.project.active_bpmn = None
        self.project.save(update_fields=["active_bpmn"])
        self.client.force_login(self.evaluator)

        response = self.client.post(
            reverse("projects:run_analysis", kwargs={"project_id": self.project.id})
        )

        self.assertRedirects(
            response,
            reverse("projects:detail", kwargs={"project_id": self.project.id}),
            fetch_redirect_response=False,
        )
        self.assertFalse(AnalysisRun.objects.filter(project=self.project).exists())

    def test_run_analysis_blocked_when_no_active_code(self):
        self.project.active_code = None
        self.project.save(update_fields=["active_code"])
        self.client.force_login(self.evaluator)

        response = self.client.post(
            reverse("projects:run_analysis", kwargs={"project_id": self.project.id})
        )

        self.assertRedirects(
            response,
            reverse("projects:detail", kwargs={"project_id": self.project.id}),
            fetch_redirect_response=False,
        )
        self.assertFalse(AnalysisRun.objects.filter(project=self.project).exists())

    def test_run_analysis_blocked_when_bpmn_not_well_formed(self):
        self.bpmn_file.is_well_formed = False
        self.bpmn_file.precheck_errors = ["Missing start event"]
        self.bpmn_file.save(update_fields=["is_well_formed", "precheck_errors"])
        self.client.force_login(self.evaluator)

        response = self.client.post(
            reverse("projects:run_analysis", kwargs={"project_id": self.project.id})
        )

        self.assertRedirects(
            response,
            reverse("projects:detail", kwargs={"project_id": self.project.id}),
            fetch_redirect_response=False,
        )
        self.assertFalse(AnalysisRun.objects.filter(project=self.project).exists())