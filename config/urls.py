from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path, re_path
from django.views.generic import TemplateView
from django.views.static import serve


urlpatterns = [
    path("admin/", admin.site.urls),

    # Backend routes
    path("analysis/", include("apps.analysis.urls")),
    path("projects/", include("apps.projects.urls")),
    path("accounts/", include("apps.accounts.urls")),

    # API routes
    path("api/", include("apps.api.urls")),
    path("api/", include("apps.task_management.urls")),

    # React/Vite assets
    re_path(
        r"^assets/(?P<path>.*)$",
        serve,
        {"document_root": settings.FRONTEND_DIST / "assets"},
    ),

    # React public files like logo.png, favicon.ico
    re_path(
        r"^(?P<path>logo\.png|favicon\.ico|vite\.svg|.*\.png|.*\.jpg|.*\.jpeg|.*\.svg|.*\.webp)$",
        serve,
        {"document_root": settings.FRONTEND_DIST},
    ),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# React fallback - must be LAST
urlpatterns += [
    re_path(
        r"^(?!admin/|api/|analysis/|projects/|accounts/|media/|static/|assets/).*",
        TemplateView.as_view(template_name="index.html"),
    ),
]