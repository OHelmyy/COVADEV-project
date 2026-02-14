# config/urls.py
from django.contrib import admin
from django.shortcuts import redirect
from django.urls import include, path

def home(request):
    # ✅ go to project listing (role-based)
    return redirect("projects:list")

urlpatterns = [
    path("", home),

    path("admin/", admin.site.urls),

    # analysis app (dashboard + project API)
    path("", include("apps.analysis.urls")),

    # projects
    path("projects/", include("apps.projects.urls")),

    # auth + admin user management UI
    path("accounts/", include("apps.accounts.urls")),

    #  api app (if used)
    path("api/", include("apps.api.urls")),
]
