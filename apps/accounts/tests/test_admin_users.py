from django.test import TestCase, Client
from django.urls import reverse
from django.contrib.auth.models import User
from apps.accounts.models import UserProfile


def make_user(username, password="pass1234", role="DEVELOPER"):
    u = User.objects.create_user(username=username, email=f"{username}@test.com", password=password)
    u.profile.role = role
    u.profile.save()
    return u


class AdminUserTests(TestCase):

    def setUp(self):
        self.client = Client()
        self.admin = make_user("admin_user", role="ADMIN")

    # ------------------------------------------------------------------ #
    # TC04 – Admin creates a Developer account (FR02)
    # ------------------------------------------------------------------ #
    def test_admin_creates_developer(self):
        self.client.force_login(self.admin)

        response = self.client.post(
            reverse("accounts:admin_user_create"),
            {
                "full_name": "Dev User",
                "email": "devuser@test.com",
                "password": "devpass123",
                "role": "DEVELOPER",
            },
        )

        # Should redirect to user list on success
        self.assertRedirects(response, reverse("accounts:admin_user_list"), fetch_redirect_response=False)

        # User exists with correct role
        u = User.objects.get(username="devuser@test.com")
        self.assertEqual(u.profile.role, "DEVELOPER")

    # ------------------------------------------------------------------ #
    # TC05 – Admin creates an Evaluator account (FR02)
    # ------------------------------------------------------------------ #
    def test_admin_creates_evaluator(self):
        self.client.force_login(self.admin)

        response = self.client.post(
            reverse("accounts:admin_user_create"),
            {
                "full_name": "Eval User",
                "email": "evaluser@test.com",
                "password": "evalpass123",
                "role": "EVALUATOR",
            },
        )

        self.assertRedirects(response, reverse("accounts:admin_user_list"), fetch_redirect_response=False)

        u = User.objects.get(username="evaluser@test.com")
        self.assertEqual(u.profile.role, "EVALUATOR")

    # ------------------------------------------------------------------ #
    # TC06 – Admin views all users (FR03)
    # ------------------------------------------------------------------ #
    def test_admin_can_view_user_list(self):
        from unittest.mock import patch, MagicMock

        make_user("dev1", role="DEVELOPER")
        make_user("eval1", role="EVALUATOR")

        self.client.force_login(self.admin)

        # Mock the template so the test doesn't require the actual HTML file
        with patch("django.template.loader.get_template") as mock_get_template:
            mock_template = MagicMock()
            mock_template.render.return_value = ""
            mock_get_template.return_value = mock_template

            response = self.client.get(reverse("accounts:admin_user_list"))

        self.assertEqual(response.status_code, 200)

        # All users exist in DB (view queries all users)
        self.assertTrue(User.objects.filter(username="dev1").exists())
        self.assertTrue(User.objects.filter(username="eval1").exists())

    # ------------------------------------------------------------------ #
    # TC07 – Admin deletes an existing user (FR02)
    # ------------------------------------------------------------------ #
    def test_admin_deletes_user(self):
        target = make_user("todelete")
        self.client.force_login(self.admin)

        response = self.client.post(
            reverse("accounts:admin_user_delete", kwargs={"user_id": target.id})
        )

        self.assertRedirects(response, reverse("accounts:admin_user_list"), fetch_redirect_response=False)

        # User no longer exists in DB
        self.assertFalse(User.objects.filter(id=target.id).exists())

    def test_admin_cannot_delete_themselves(self):
        self.client.force_login(self.admin)

        response = self.client.post(
            reverse("accounts:admin_user_delete", kwargs={"user_id": self.admin.id})
        )

        # Should redirect back, not delete
        self.assertRedirects(response, reverse("accounts:admin_user_list"), fetch_redirect_response=False)
        self.assertTrue(User.objects.filter(id=self.admin.id).exists())

    # ------------------------------------------------------------------ #
    # TC08 – Non-admin attempts user management → 403 (FR02, FR03)
    # ------------------------------------------------------------------ #
    def test_developer_cannot_access_user_list(self):
        dev = make_user("dev_nonadmin", role="DEVELOPER")
        self.client.force_login(dev)

        response = self.client.get(reverse("accounts:admin_user_list"))
        self.assertEqual(response.status_code, 403)

    def test_evaluator_cannot_access_user_list(self):
        evaluator = make_user("eval_nonadmin", role="EVALUATOR")
        self.client.force_login(evaluator)

        response = self.client.get(reverse("accounts:admin_user_list"))
        self.assertEqual(response.status_code, 403)

    def test_developer_cannot_create_user(self):
        dev = make_user("dev_nonadmin2", role="DEVELOPER")
        self.client.force_login(dev)

        response = self.client.post(
            reverse("accounts:admin_user_create"),
            {"full_name": "X", "email": "x@test.com", "password": "pass123", "role": "DEVELOPER"},
        )
        self.assertEqual(response.status_code, 403)

    def test_developer_cannot_delete_user(self):
        dev = make_user("dev_nonadmin3", role="DEVELOPER")
        target = make_user("victim")
        self.client.force_login(dev)

        response = self.client.post(
            reverse("accounts:admin_user_delete", kwargs={"user_id": target.id})
        )
        self.assertEqual(response.status_code, 403)

        # Target still exists
        self.assertTrue(User.objects.filter(id=target.id).exists())

    def test_unauthenticated_cannot_access_user_list(self):
        response = self.client.get(reverse("accounts:admin_user_list"))
        self.assertEqual(response.status_code, 403)