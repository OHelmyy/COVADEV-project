# apps/api/admin_users_views.py
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import ensure_csrf_cookie

from apps.accounts.models import UserProfile


def _is_admin(user) -> bool:
    return user.is_authenticated and getattr(getattr(user, "profile", None), "role", "") == UserProfile.Role.ADMIN


def _user_row(u: User):
    role = getattr(getattr(u, "profile", None), "role", UserProfile.Role.DEVELOPER)
    return {
        "id": u.id,
        "email": u.email or u.username,
        "fullName": (u.first_name or "").strip(),
        "role": role,
        "isActive": u.is_active,
        "createdAt": u.date_joined.isoformat() if u.date_joined else None,
    }


@require_http_methods(["GET", "POST"])
@ensure_csrf_cookie
def users_list_create(request):
    if not _is_admin(request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    if request.method == "GET":
        qs = User.objects.all().order_by("-date_joined").select_related("profile")
        return JsonResponse({"users": [_user_row(u) for u in qs]})

    # POST create
    email = (request.POST.get("email") or "").strip().lower()
    full_name = (request.POST.get("fullName") or "").strip()
    role = (request.POST.get("role") or UserProfile.Role.DEVELOPER).strip().upper()
    password = (request.POST.get("password") or "").strip()
    is_active = (request.POST.get("isActive") or "true").strip().lower() != "false"

    if not email or not password:
        return JsonResponse({"detail": "email and password are required"}, status=400)

    if role not in [c[0] for c in UserProfile.Role.choices]:
        return JsonResponse({"detail": "Invalid role"}, status=400)

    if User.objects.filter(username=email).exists():
        return JsonResponse({"detail": "A user with this email already exists"}, status=400)

    u = User.objects.create_user(
        username=email,
        email=email,
        password=password,
        first_name=full_name,
        is_active=is_active,
    )

    profile, _ = UserProfile.objects.get_or_create(user=u)
    profile.role = role
    profile.save()

    return JsonResponse({"user": _user_row(u)}, status=201)


@require_http_methods(["PATCH", "DELETE"])
def users_update_delete(request, user_id: int):
    if not _is_admin(request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    u = User.objects.filter(id=user_id).first()
    if not u:
        return JsonResponse({"detail": "Not found"}, status=404)

    # Protect: don't allow deleting yourself accidentally
    if request.method == "DELETE":
        if request.user.id == u.id:
            return JsonResponse({"detail": "You cannot delete your own account."}, status=400)
        u.delete()
        return JsonResponse({"ok": True})

    # PATCH (form-encoded)
    email = (request.POST.get("email") or "").strip().lower()
    full_name = (request.POST.get("fullName") or "").strip()
    role = (request.POST.get("role") or "").strip().upper()
    password = (request.POST.get("password") or "").strip()
    is_active_raw = (request.POST.get("isActive") or "").strip().lower()

    if email and email != u.username:
        if User.objects.filter(username=email).exclude(id=u.id).exists():
            return JsonResponse({"detail": "Email already in use"}, status=400)
        u.username = email
        u.email = email

    if full_name != "":
        u.first_name = full_name

    if is_active_raw in ["true", "false"]:
        u.is_active = (is_active_raw == "true")

    if password:
        u.set_password(password)

    u.save()

    profile, _ = UserProfile.objects.get_or_create(user=u)
    if role:
        if role not in [c[0] for c in UserProfile.Role.choices]:
            return JsonResponse({"detail": "Invalid role"}, status=400)
        profile.role = role
        profile.save()

    return JsonResponse({"user": _user_row(u)})