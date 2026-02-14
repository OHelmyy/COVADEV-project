# apps/api/auth_views.py
from django.contrib.auth import authenticate, login, logout
from django.http import JsonResponse
from django.views.decorators.http import require_GET, require_POST
from django.views.decorators.csrf import ensure_csrf_cookie

from apps.accounts.models import UserProfile


def _user_payload(user):
    # your system uses email as username
    email = user.email or user.username
    full_name = (user.first_name or "").strip() or (user.get_full_name() or "").strip()

    role = getattr(getattr(user, "profile", None), "role", UserProfile.Role.DEVELOPER)

    return {
        "id": user.id,
        "email": email,
        "fullName": full_name,
        "role": role,
    }


@require_GET
@ensure_csrf_cookie
def me(request):
    """
    GET /api/auth/me/
    - returns auth state + role
    - also sets csrftoken cookie (important for SPA)
    """
    if not request.user.is_authenticated:
        return JsonResponse({"isAuthenticated": False, "user": None})

    return JsonResponse({"isAuthenticated": True, "user": _user_payload(request.user)})


@require_POST
def login_view(request):
    """
    POST /api/auth/login/
    form-encoded: username, password
    """
    username = (request.POST.get("username") or "").strip()
    password = (request.POST.get("password") or "").strip()

    user = authenticate(request, username=username, password=password)
    if user is None:
        return JsonResponse({"detail": "Invalid credentials"}, status=401)

    login(request, user)
    return JsonResponse({"ok": True})


@require_POST
def logout_view(request):
    """
    POST /api/auth/logout/
    """
    logout(request)
    return JsonResponse({"ok": True})