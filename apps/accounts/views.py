from django.urls import reverse
from django.contrib.auth import login
from django.contrib.auth.views import LoginView, LogoutView
from django.urls import reverse_lazy

from .models import UserProfile


class UserLoginView(LoginView):
    template_name = "accounts/login.html"

    def get_success_url(self):
        user = self.request.user
        role = getattr(getattr(user, "profile", None), "role", UserProfile.Role.DEVELOPER)

        if role == UserProfile.Role.ADMIN:
            return reverse("accounts:admin_user_list")

        return reverse("projects:list")


class UserLogoutView(LogoutView):
    next_page = reverse_lazy("accounts:login")