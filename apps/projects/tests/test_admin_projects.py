from unittest.mock import patch, MagicMock

from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User

from apps.accounts.models import UserProfile
from apps.projects.models import Project, ProjectMembership


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


class AdminProjectTests(TestCase):

    def setUp(self):
        self.client = Client()
        self.admin     = make_user("admin_user",  role="ADMIN")
        self.evaluator = make_user("eval_user",   role="EVALUATOR")
        self.dev1      = make_user("dev_one",     role="DEVELOPER")
        self.dev2      = make_user("dev_two",     role="DEVELOPER")

    # ------------------------------------------------------------------ #
    # TC09 – Admin creates a project (FR04)
    # ------------------------------------------------------------------ #
    def test_admin_creates_project(self):
        self.client.force_login(self.admin)

        response = self.client.post(
            reverse("projects:create"),
            {
                "name": "New Project",
                "description": "Some description",
                "similarity_threshold": "0.6",
                "evaluator_id": self.evaluator.id,
                "developer_ids": [self.dev1.id],
            },
        )

        # Project created and stored in DB
        self.assertTrue(Project.objects.filter(name="New Project").exists())

        project = Project.objects.get(name="New Project")

        # Should redirect to project detail on success
        self.assertRedirects(
            response,
            reverse("projects:detail", kwargs={"project_id": project.id}),
            fetch_redirect_response=False,
        )

    def test_admin_creates_project_without_name_fails(self):
        self.client.force_login(self.admin)

        response = self.client.post(
            reverse("projects:create"),
            {
                "name": "",
                "evaluator_id": self.evaluator.id,
                "similarity_threshold": "0.6",
            },
        )

        # Project should NOT be created
        self.assertFalse(Project.objects.filter(name="").exists())
        self.assertRedirects(response, reverse("projects:create"), fetch_redirect_response=False)

    # ------------------------------------------------------------------ #
    # TC10 – Admin assigns one evaluator + multiple developers (FR05)
    # ------------------------------------------------------------------ #
    def test_admin_assigns_evaluator_and_developers(self):
        self.client.force_login(self.admin)

        self.client.post(
            reverse("projects:create"),
            {
                "name": "Assigned Project",
                "description": "",
                "similarity_threshold": "0.6",
                "evaluator_id": self.evaluator.id,
                "developer_ids": [self.dev1.id, self.dev2.id],
            },
        )

        project = Project.objects.get(name="Assigned Project")

        # Evaluator stored on project directly
        self.assertEqual(project.evaluator_id, self.evaluator.id)

        # Membership rows created for both developers
        self.assertTrue(ProjectMembership.objects.filter(project=project, user=self.dev1).exists())
        self.assertTrue(ProjectMembership.objects.filter(project=project, user=self.dev2).exists())

        # Evaluator should NOT have a membership row
        self.assertFalse(ProjectMembership.objects.filter(project=project, user=self.evaluator).exists())

    def test_evaluator_not_added_as_developer(self):
        """Evaluator passed in developer_ids should be silently skipped."""
        self.client.force_login(self.admin)

        self.client.post(
            reverse("projects:create"),
            {
                "name": "Overlap Project",
                "description": "",
                "similarity_threshold": "0.6",
                "evaluator_id": self.evaluator.id,
                # pass evaluator also as developer — view should skip it
                "developer_ids": [self.evaluator.id, self.dev1.id],
            },
        )

        project = Project.objects.get(name="Overlap Project")
        self.assertFalse(ProjectMembership.objects.filter(project=project, user=self.evaluator).exists())
        self.assertTrue(ProjectMembership.objects.filter(project=project, user=self.dev1).exists())

    # ------------------------------------------------------------------ #
    # TC12 – Admin deletes a project (FR06)
    # ------------------------------------------------------------------ #
    def test_admin_deletes_project(self):
        project = make_project(self.admin, self.evaluator, name="To Delete")

        # Add memberships to verify cascade
        ProjectMembership.objects.create(project=project, user=self.dev1)
        ProjectMembership.objects.create(project=project, user=self.dev2)

        project_id = project.id
        self.client.force_login(self.admin)

        # Django admin delete or direct ORM — no dedicated delete view in urls.py,
        # so we delete via ORM and confirm cascade behavior
        project.delete()

        # Project removed
        self.assertFalse(Project.objects.filter(id=project_id).exists())

        # Related memberships cascaded
        self.assertFalse(ProjectMembership.objects.filter(project_id=project_id).exists())

    def test_non_admin_cannot_create_project(self):
        self.client.force_login(self.dev1)

        response = self.client.post(
            reverse("projects:create"),
            {
                "name": "Unauthorized Project",
                "evaluator_id": self.evaluator.id,
                "similarity_threshold": "0.6",
            },
        )

        # Should redirect away, not create
        self.assertFalse(Project.objects.filter(name="Unauthorized Project").exists())
        self.assertRedirects(response, reverse("projects:list"), fetch_redirect_response=False)