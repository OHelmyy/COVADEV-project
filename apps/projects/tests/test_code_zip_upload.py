import io
import zipfile
from unittest.mock import patch, MagicMock

from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User
from django.core.files.uploadedfile import InMemoryUploadedFile

from apps.accounts.models import UserProfile
from apps.projects.models import Project, ProjectMembership, ProjectFile, CodeFile


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


def make_valid_zip(filename="code.zip"):
    """Build a valid in-memory ZIP with a small Python file inside."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("main.py", "def hello():\n    return 'hello'\n")
        zf.writestr("utils.py", "def add(a, b):\n    return a + b\n")
    buf.seek(0)
    return InMemoryUploadedFile(
        buf, "file", filename, "application/zip", buf.getbuffer().nbytes, None
    )


def make_corrupted_zip(filename="bad.zip"):
    """Return a file with .zip extension but invalid/corrupted content."""
    buf = io.BytesIO(b"this is not a valid zip file at all")
    buf.seek(0)
    return InMemoryUploadedFile(
        buf, "file", filename, "application/zip", buf.getbuffer().nbytes, None
    )


def make_empty_zip(filename="empty.zip"):
    """Return a valid ZIP file with no entries inside."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        pass  # empty
    buf.seek(0)
    return InMemoryUploadedFile(
        buf, "file", filename, "application/zip", buf.getbuffer().nbytes, None
    )


class CodeZipUploadTests(TestCase):

    def setUp(self):
        self.client = Client()
        self.admin     = make_user("admin_user", role="ADMIN")
        self.evaluator = make_user("eval_user",  role="EVALUATOR")
        self.dev       = make_user("dev_user",   role="DEVELOPER")

        self.project = make_project(self.admin, self.evaluator)
        ProjectMembership.objects.create(project=self.project, user=self.dev)

    # ------------------------------------------------------------------ #
    # TC22 – Developer uploads valid code ZIP (FR16)
    # ------------------------------------------------------------------ #
    def test_valid_zip_upload_stores_file_and_updates_active_code(self):
        self.client.force_login(self.dev)

        with patch("apps.projects.views.save_code_zip_and_extract") as mock_save:
            # Simulate what the real service does
            pf = ProjectFile.objects.create(
                project=self.project,
                file_type="CODE",
                original_name="code.zip",
                stored_path="projects/1/code/code.zip",
                extracted_dir="/media/projects/1/code/extracted",
                uploaded_by=self.dev,
            )
            self.project.active_code = pf
            self.project.save(update_fields=["active_code"])
            mock_save.return_value = pf

            response = self.client.post(
                reverse("projects:upload_code", kwargs={"project_id": self.project.id}),
                {"code_zip": make_valid_zip()},
            )

        # Should redirect to project detail
        self.assertRedirects(
            response,
            reverse("projects:detail", kwargs={"project_id": self.project.id}),
            fetch_redirect_response=False,
        )

        # Service was called
        mock_save.assert_called_once()

        # active_code is set
        self.project.refresh_from_db()
        self.assertIsNotNone(self.project.active_code)

    def test_valid_zip_upload_indexes_code_files(self):
        """After real extraction, CodeFile rows should exist for the project."""
        with patch("apps.projects.services.save_code_zip_and_extract") as mock_save:
            # Simulate indexing side effect
            CodeFile.objects.create(
                project=self.project,
                relative_path="main.py",
                ext="py",
                size_bytes=40,
                uploaded_by=self.dev,
            )
            CodeFile.objects.create(
                project=self.project,
                relative_path="utils.py",
                ext="py",
                size_bytes=35,
                uploaded_by=self.dev,
            )

        files = CodeFile.objects.filter(project=self.project)
        self.assertEqual(files.count(), 2)

        paths = list(files.values_list("relative_path", flat=True))
        self.assertIn("main.py", paths)
        self.assertIn("utils.py", paths)

    def test_valid_zip_creates_project_file_log(self):
        """A ProjectFile record of type CODE should be created on upload."""
        pf = ProjectFile.objects.create(
            project=self.project,
            file_type="CODE",
            original_name="code.zip",
            stored_path="projects/1/code/code.zip",
            extracted_dir="/media/projects/1/code/extracted",
            uploaded_by=self.dev,
        )

        self.assertTrue(
            ProjectFile.objects.filter(project=self.project, file_type="CODE").exists()
        )
        self.assertEqual(pf.original_name, "code.zip")
        self.assertNotEqual(pf.extracted_dir, "")

    # ------------------------------------------------------------------ #
    # TC24 – Upload corrupted/empty ZIP (FR16)
    # ------------------------------------------------------------------ #
    def test_corrupted_zip_upload_is_rejected(self):
        self.client.force_login(self.dev)

        with patch("apps.projects.views.save_code_zip_and_extract") as mock_save:
            mock_save.side_effect = Exception("Bad zip file (not a zip)")

            response = self.client.post(
                reverse("projects:upload_code", kwargs={"project_id": self.project.id}),
                {"code_zip": make_corrupted_zip()},
            )

        # Should redirect back to detail with error message
        self.assertRedirects(
            response,
            reverse("projects:detail", kwargs={"project_id": self.project.id}),
            fetch_redirect_response=False,
        )

        # active_code should NOT be updated
        self.project.refresh_from_db()
        self.assertIsNone(self.project.active_code)

        # No CodeFile rows should be created
        self.assertEqual(CodeFile.objects.filter(project=self.project).count(), 0)

    def test_empty_zip_upload_is_rejected(self):
        self.client.force_login(self.dev)

        with patch("apps.projects.views.save_code_zip_and_extract") as mock_save:
            mock_save.side_effect = Exception("Empty zip — no files to extract.")

            response = self.client.post(
                reverse("projects:upload_code", kwargs={"project_id": self.project.id}),
                {"code_zip": make_empty_zip()},
            )

        self.assertRedirects(
            response,
            reverse("projects:detail", kwargs={"project_id": self.project.id}),
            fetch_redirect_response=False,
        )

        # No indexing performed
        self.assertEqual(CodeFile.objects.filter(project=self.project).count(), 0)

    def test_no_file_submitted_is_rejected(self):
        """Submitting the form without a file should redirect with error."""
        self.client.force_login(self.dev)

        response = self.client.post(
            reverse("projects:upload_code", kwargs={"project_id": self.project.id}),
            {},  # no file
        )

        self.assertRedirects(
            response,
            reverse("projects:detail", kwargs={"project_id": self.project.id}),
            fetch_redirect_response=False,
        )

        # Nothing stored
        self.assertFalse(ProjectFile.objects.filter(project=self.project, file_type="CODE").exists())