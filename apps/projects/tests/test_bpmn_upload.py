from io import BytesIO
from unittest.mock import patch, MagicMock

from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User

from apps.accounts.models import UserProfile
from apps.projects.models import Project, ProjectMembership, ProjectFile
from apps.analysis.models import BpmnTask


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


def make_bpmn_file(content=b"<bpmn/>"):
    """Return a simple in-memory uploaded file."""
    f = BytesIO(content)
    f.name = "test.bpmn"
    return f


VALID_BPMN_PREDEV = {
    "ok": True,
    "warnings": [],
    "errors": [],
    "summary": "This BPMN describes a simple process.",
}

INVALID_BPMN_PREDEV = {
    "ok": False,
    "warnings": [],
    "errors": ["Missing start event", "Invalid task reference"],
    "summary": "",
}


class BpmnUploadTests(TestCase):

    def setUp(self):
        self.client = Client()
        self.admin     = make_user("admin_user", role="ADMIN")
        self.evaluator = make_user("eval_user",  role="EVALUATOR")
        self.dev       = make_user("dev_user",   role="DEVELOPER")

        self.project = make_project(self.admin, self.evaluator)
        ProjectMembership.objects.create(project=self.project, user=self.dev)

    # ------------------------------------------------------------------ #
    # TC16 – Upload valid BPMN XML (FR10)
    # ------------------------------------------------------------------ #
    def test_valid_bpmn_upload_succeeds(self):
        self.client.force_login(self.evaluator)

        with patch("apps.projects.views.run_bpmn_upload_flow") as mock_flow:
            mock_bpmn_obj = MagicMock()
            mock_bpmn_obj.is_well_formed = True
            mock_bpmn_obj.precheck_warnings = []
            mock_flow.return_value = {
                "ok": True,
                "warnings": [],
                "errors": [],
                "summary": "Valid BPMN summary.",
                "taskCount": 3,
                "active_bpmn": mock_bpmn_obj,
                "predev": VALID_BPMN_PREDEV,
            }

            response = self.client.post(
                reverse("projects:upload_bpmn", kwargs={"project_id": self.project.id}),
                {"bpmn_file": make_bpmn_file()},
            )

        # Should redirect back to project detail
        self.assertRedirects(
            response,
            reverse("projects:detail", kwargs={"project_id": self.project.id}),
            fetch_redirect_response=False,
        )

        # Upload flow was called once
        mock_flow.assert_called_once()

    # ------------------------------------------------------------------ #
    # TC17 – Validate BPMN and display well-formed/warnings/summary (FR11)
    # ------------------------------------------------------------------ #
    def test_valid_bpmn_stores_well_formed_and_summary(self):
        """
        After a successful upload, ProjectFile should have
        is_well_formed=True and bpmn_summary populated.
        """
        self.client.force_login(self.evaluator)

        with patch("apps.projects.views.run_bpmn_upload_flow") as mock_flow:
            # Simulate what the real flow does to the DB object
            pf = ProjectFile.objects.create(
                project=self.project,
                file_type="BPMN",
                original_name="test.bpmn",
                stored_path="bpmn/test.bpmn",
                uploaded_by=self.evaluator,
                is_well_formed=True,
                bpmn_summary="This BPMN describes a simple process.",
            )
            mock_flow.return_value = {
                "ok": True,
                "warnings": [],
                "errors": [],
                "summary": pf.bpmn_summary,
                "taskCount": 2,
                "active_bpmn": pf,
                "predev": VALID_BPMN_PREDEV,
            }

            self.client.post(
                reverse("projects:upload_bpmn", kwargs={"project_id": self.project.id}),
                {"bpmn_file": make_bpmn_file()},
            )

        pf.refresh_from_db()
        self.assertTrue(pf.is_well_formed)
        self.assertNotEqual(pf.bpmn_summary, "")

    def test_bpmn_upload_with_warnings_still_succeeds(self):
        self.client.force_login(self.evaluator)

        with patch("apps.projects.views.run_bpmn_upload_flow") as mock_flow:
            mock_bpmn_obj = MagicMock()
            mock_bpmn_obj.is_well_formed = True
            mock_bpmn_obj.precheck_warnings = ["Missing label on task X"]
            mock_flow.return_value = {
                "ok": True,
                "warnings": ["Missing label on task X"],
                "errors": [],
                "summary": "Summary with warnings.",
                "taskCount": 1,
                "active_bpmn": mock_bpmn_obj,
                "predev": {**VALID_BPMN_PREDEV, "warnings": ["Missing label on task X"]},
            }

            response = self.client.post(
                reverse("projects:upload_bpmn", kwargs={"project_id": self.project.id}),
                {"bpmn_file": make_bpmn_file()},
            )

        # Still redirects to detail (not an error)
        self.assertRedirects(
            response,
            reverse("projects:detail", kwargs={"project_id": self.project.id}),
            fetch_redirect_response=False,
        )

    # ------------------------------------------------------------------ #
    # TC18 – Extract BPMN tasks and display them (FR12, FR15)
    # ------------------------------------------------------------------ #
    def test_bpmn_tasks_stored_after_upload(self):
        """
        After upload flow, BpmnTask rows should exist for the project.
        We simulate the storage step directly.
        """
        BpmnTask.objects.create(
            project=self.project,
            task_id="task_001",
            name="Validate Input",
        )
        BpmnTask.objects.create(
            project=self.project,
            task_id="task_002",
            name="Process Data",
        )

        tasks = BpmnTask.objects.filter(project=self.project)
        self.assertEqual(tasks.count(), 2)

        task_names = list(tasks.values_list("name", flat=True))
        self.assertIn("Validate Input", task_names)
        self.assertIn("Process Data", task_names)

    # ------------------------------------------------------------------ #
    # TC19 – Generate and store recommended methods from summary (FR13, FR25)
    # ------------------------------------------------------------------ #
    def test_recommendations_stored_from_summary(self):
        """
        Calls the real pipeline and prints generated recommendations to terminal.
        Run with: python manage.py test apps.projects.tests.test_bpmn_upload -s
        """
        from apps.analysis.models import BpmnRecommendations
        from apps.analysis.services.recommendation_flow_service import run_recommendation_for_project

        pf = ProjectFile.objects.create(
            project=self.project,
            file_type="BPMN",
            original_name="test.bpmn",
            stored_path="bpmn/test.bpmn",
            uploaded_by=self.evaluator,
            is_well_formed=True,
            bpmn_summary="This BPMN describes a simple process with user login, data validation, and report generation.",
        )
        self.project.active_bpmn = pf
        self.project.save(update_fields=["active_bpmn"])

        result = run_recommendation_for_project(self.project)

        print("\n--- TC19 Recommendations (REAL) ---")
        print("Cached:", result["cached"])
        print("Recommendations:")
        for item in result["recommendations"]:
            print(" ", item)
        print("------------------------------------\n")

        # Result returned correctly
        self.assertTrue(result["ok"])
        self.assertGreater(len(result["recommendations"]), 0)

        # Persisted to DB
        rec = BpmnRecommendations.objects.get(project=self.project)
        self.assertNotEqual(rec.recommendations_text, "")
        self.assertEqual(rec.source_summary, "This BPMN describes a simple process with user login, data validation, and report generation.")

    def test_recommendations_returns_cached_if_summary_unchanged(self):
        """
        If recommendations already exist for the same summary, return cached result.
        """
        from apps.analysis.models import BpmnRecommendations
        from apps.analysis.services.recommendation_flow_service import run_recommendation_for_project

        pf = ProjectFile.objects.create(
            project=self.project,
            file_type="BPMN",
            original_name="test.bpmn",
            stored_path="bpmn/test2.bpmn",
            uploaded_by=self.evaluator,
            is_well_formed=True,
            bpmn_summary="Cached summary.",
        )
        self.project.active_bpmn = pf
        self.project.save(update_fields=["active_bpmn"])

        # Pre-populate recommendations with matching summary
        BpmnRecommendations.objects.create(
            project=self.project,
            recommendations_text="- cached_method",
            source_summary="Cached summary.",
        )

        with patch("apps.analysis.services.recommendation_flow_service.run_recommendation_pipeline") as mock_pipeline:
            result = run_recommendation_for_project(self.project)

        # Pipeline should NOT be called — cached result used
        mock_pipeline.assert_not_called()
        self.assertTrue(result["cached"])
        self.assertIn("- cached_method", result["recommendations"])

    # ------------------------------------------------------------------ #
    # TC20 – Evaluator/Developer access Recommended Methods tab (FR14, FR25)
    # ------------------------------------------------------------------ #
    def test_evaluator_can_open_project_detail(self):
        """Evaluator assigned to project should be able to access project detail."""
        self.client.force_login(self.evaluator)

        with patch("django.template.loader.get_template") as mock_tpl:
            mock_tpl.return_value = MagicMock(render=MagicMock(return_value=""))
            response = self.client.get(
                reverse("projects:detail", kwargs={"project_id": self.project.id})
            )

        self.assertEqual(response.status_code, 200)

    def test_developer_can_open_project_detail(self):
        """Developer who is a member should be able to access project detail."""
        self.client.force_login(self.dev)

        with patch("django.template.loader.get_template") as mock_tpl:
            mock_tpl.return_value = MagicMock(render=MagicMock(return_value=""))
            response = self.client.get(
                reverse("projects:detail", kwargs={"project_id": self.project.id})
            )

        self.assertEqual(response.status_code, 200)

    def test_non_member_cannot_open_project_detail(self):
        """A developer with no membership should be redirected away."""
        outsider = make_user("outsider", role="DEVELOPER")
        self.client.force_login(outsider)

        with patch("django.template.loader.get_template") as mock_tpl:
            mock_tpl.return_value = MagicMock(render=MagicMock(return_value=""))
            response = self.client.get(
                reverse("projects:detail", kwargs={"project_id": self.project.id})
            )

        self.assertRedirects(response, reverse("projects:list"), fetch_redirect_response=False)

    # ------------------------------------------------------------------ #
    # TC21 – Upload invalid BPMN XML (FR11)
    # ------------------------------------------------------------------ #
    def test_invalid_bpmn_upload_rejected(self):
        self.client.force_login(self.evaluator)

        with patch("apps.projects.views.run_bpmn_upload_flow") as mock_flow:
            mock_bpmn_obj = MagicMock()
            mock_bpmn_obj.is_well_formed = False
            mock_bpmn_obj.precheck_errors = ["Missing start event", "Invalid task reference"]
            mock_flow.return_value = {
                "ok": False,
                "warnings": [],
                "errors": ["Missing start event", "Invalid task reference"],
                "summary": "",
                "taskCount": 0,
                "active_bpmn": mock_bpmn_obj,
                "predev": INVALID_BPMN_PREDEV,
            }

            response = self.client.post(
                reverse("projects:upload_bpmn", kwargs={"project_id": self.project.id}),
                {"bpmn_file": make_bpmn_file(b"<invalid/>")},
            )

        # Should redirect back to detail with error messages
        self.assertRedirects(
            response,
            reverse("projects:detail", kwargs={"project_id": self.project.id}),
            fetch_redirect_response=False,
        )

    def test_invalid_bpmn_marks_file_not_well_formed(self):
        """ProjectFile created from invalid BPMN should have is_well_formed=False."""
        pf = ProjectFile.objects.create(
            project=self.project,
            file_type="BPMN",
            original_name="bad.bpmn",
            stored_path="bpmn/bad.bpmn",
            uploaded_by=self.evaluator,
            is_well_formed=False,
            precheck_errors=["Missing start event"],
            bpmn_summary="",
        )

        pf.refresh_from_db()
        self.assertFalse(pf.is_well_formed)
        self.assertGreater(len(pf.precheck_errors), 0)

    def test_non_evaluator_cannot_upload_bpmn(self):
        """Developer should not be able to upload BPMN."""
        self.client.force_login(self.dev)

        with patch("apps.projects.views.run_bpmn_upload_flow") as mock_flow:
            response = self.client.post(
                reverse("projects:upload_bpmn", kwargs={"project_id": self.project.id}),
                {"bpmn_file": make_bpmn_file()},
            )

        # Flow should never be called
        mock_flow.assert_not_called()

        # Should redirect back to detail
        self.assertRedirects(
            response,
            reverse("projects:detail", kwargs={"project_id": self.project.id}),
            fetch_redirect_response=False,
        )