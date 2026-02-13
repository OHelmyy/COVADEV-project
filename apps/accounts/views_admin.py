from django.contrib.auth.decorators import login_required
from django.contrib.auth.models import User
from django.shortcuts import redirect, render, get_object_or_404
from django.contrib import messages
from django.views.decorators.http import require_http_methods

from .models import UserProfile
from .rbac import require_admin


@require_admin
@require_http_methods(["GET"])
def user_list(request):
    users = User.objects.select_related("profile").order_by("username")
    return render(request, "accounts/admin_user_list.html", {"users": users})


@require_admin
@require_http_methods(["GET", "POST"])
def user_create(request):
    if request.method == "GET":
        return render(request, "accounts/admin_user_create.html", {"roles": UserProfile.Role.choices})

    full_name = (request.POST.get("full_name") or "").strip()
    email = (request.POST.get("email") or "").strip().lower()
    password = (request.POST.get("password") or "").strip()
    role = (request.POST.get("role") or "DEVELOPER").strip()

    if not full_name or not email or not password:
        messages.error(request, "Missing required fields.")
        return redirect("accounts:admin_user_create")

    if User.objects.filter(username=email).exists():
        messages.error(request, "User already exists.")
        return redirect("accounts:admin_user_create")

    u = User.objects.create_user(username=email, email=email, password=password, first_name=full_name)
    u.profile.role = role
    u.profile.save()

    messages.success(request, "User created.")
    return redirect("accounts:admin_user_list")


@require_admin
@require_http_methods(["POST"])
def user_delete(request, user_id: int):
    u = get_object_or_404(User, id=user_id)
    if u.id == request.user.id:
        messages.error(request, "You cannot delete yourself.")
        return redirect("accounts:admin_user_list")
    u.delete()
    messages.success(request, "User deleted.")
    return redirect("accounts:admin_user_list")


@require_admin
@require_http_methods(["GET", "POST"])
def user_edit(request, user_id: int):
    u = get_object_or_404(User.objects.select_related("profile"), id=user_id)

    if request.method == "GET":
        return render(request, "accounts/admin_user_edit.html", {"u": u, "roles": UserProfile.Role.choices})

    full_name = (request.POST.get("full_name") or "").strip()
    role = (request.POST.get("role") or u.profile.role).strip()
    password = (request.POST.get("password") or "").strip()

    if full_name:
        u.first_name = full_name

    if role in dict(UserProfile.Role.choices):
        u.profile.role = role
        u.profile.save()

    if password:
        u.set_password(password)

    u.save()
    messages.success(request, "User updated.")
    return redirect("accounts:admin_user_list")
