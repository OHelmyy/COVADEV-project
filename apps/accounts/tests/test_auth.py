from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse


class LoginTest(TestCase):

    def setUp(self):
        self.username = "testuser"
        self.password = "strongpassword"
        self.email = "test@example.com"

        self.user = User.objects.create_user(
            username=self.email,   # email used as username in your system
            email=self.email,
            password=self.password
        )

        self.login_url = reverse("accounts:login")
        self.logout_url = reverse("accounts:logout")

    def test_login_success(self):
        response = self.client.post(self.login_url, {
            "username": self.email,
            "password": self.password
        })

        self.assertEqual(response.status_code, 302)
        self.assertIn("_auth_user_id", self.client.session)

    def test_login_invalid_credentials(self):
        response = self.client.post(self.login_url, {
            "username": "wrong",
            "password": "wrong"
        })

        self.assertEqual(response.status_code, 200)
        self.assertNotIn("_auth_user_id", self.client.session)

    def test_logout(self):
        self.client.login(username=self.email, password=self.password)

        response = self.client.post(self.logout_url)

        self.assertEqual(response.status_code, 302)
        self.assertNotIn("_auth_user_id", self.client.session)