from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path, re_path
from django.views.generic import TemplateView
from django.views.static import serve


urlpatterns = [
    # Django admin only for you
    path("admin/", admin.site.urls),

    # Backend APIs only
    path("api/", include("apps.api.urls")),
    path("api/", include("apps.task_management.urls")),

    # Optional: keep old Django apps hidden under internal paths
    # Do NOT use /projects/ or /accounts/ because React should own them
    path("_django/analysis/", include("apps.analysis.urls")),
    path("_django/projects/", include("apps.projects.urls")),
    path("_django/accounts/", include("apps.accounts.urls")),

    # React/Vite assets
    re_path(
        r"^assets/(?P<path>.*)$",
        serve,
        {"document_root": settings.FRONTEND_DIST / "assets"},
    ),

    # React public files like logo.png, favicon.ico, svg, etc.
    re_path(
        r"^(?P<path>logo\.png|favicon\.ico|vite\.svg|.*\.png|.*\.jpg|.*\.jpeg|.*\.svg|.*\.webp)$",
        serve,
        {"document_root": settings.FRONTEND_DIST},
    ),
]

# Uploaded files
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# React fallback — must stay last
urlpatterns += [
    re_path(
        r"^(?!admin/|api/|_django/|media/|static/|assets/).*",
        TemplateView.as_view(template_name="index.html"),
    ),
]