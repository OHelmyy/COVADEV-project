from django.urls import path
from . import views
app_name = "analysis"

urlpatterns = [
    # UI page
    path("", views.dashboard, name="dashboard"),

    # Project-based API (protected by login + project access checks)
    path("api/analysis/<int:project_id>/run/", views.run_project, name="run_project"),
    path("api/analysis/<int:project_id>/metrics/from-payload/", views.run_project_metrics, name="run_project_metrics"),
    path("api/analysis/<int:project_id>/metrics/summary/", views.metrics_summary, name="metrics_summary"),
    path("api/analysis/<int:project_id>/metrics/details/", views.metrics_details, name="metrics_details"),
    path("api/analysis/<int:project_id>/metrics/developers/", views.metrics_developers, name="metrics_developers"),

    # Prototype endpoint (ADMIN-only in edited views.py)
    path("run/", views.run_analysis, name="run_analysis"),
]
