from django.shortcuts import render

from django.urls import reverse
from django.contrib.auth import login
from django.contrib.auth.views import LoginView, LogoutView
from django.shortcuts import redirect, render
from django.contrib import messages
from django.contrib.auth.models import User
from django.views.decorators.http import require_http_methods
from .models import UserProfile



class UserLoginView(LoginView):
    template_name = "accounts/login.html"

    def get_success_url(self):
        user = self.request.user
        role = getattr(getattr(user, "profile", None), "role", UserProfile.Role.DEVELOPER)

        if role == UserProfile.Role.ADMIN:
            return reverse("accounts:admin_user_list")

        # evaluator + developer both go to role-filtered projects list
        return reverse("projects:list")

from django.contrib.auth.views import LogoutView
from django.urls import reverse_lazy

class UserLogoutView(LogoutView):
    next_page = reverse_lazy("accounts:login")



@require_http_methods(["GET", "POST"])
def register_view(request):
    if request.method == "GET":
        return render(request, "accounts/register.html")

    full_name = (request.POST.get("full_name") or "").strip()
    email = (request.POST.get("email") or "").strip().lower()
    password = (request.POST.get("password") or "").strip()
    confirm = (request.POST.get("confirm_password") or "").strip()

    if not full_name or not email or not password:
        messages.error(request, "Please fill all required fields.")
        return redirect("accounts:register")

    if password != confirm:
        messages.error(request, "Passwords do not match.")
        return redirect("accounts:register")

    if User.objects.filter(username=email).exists():
        messages.error(request, "An account with this email already exists.")
        return redirect("accounts:register")

    # Use email as username to keep it simple
    user = User.objects.create_user(
        username=email,
        email=email,
        password=password,
        first_name=full_name,
    )

    login(request, user)
    return redirect("/projects/")
