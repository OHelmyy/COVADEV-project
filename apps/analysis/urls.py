# apps/analysis/urls.py

from django.urls import path
from . import views

app_name = "analysis"

urlpatterns = [
    path("", views.dashboard, name="dashboard"),

    path("api/analysis/<int:project_id>/run/", views.run_project, name="run_project"),
    path("api/analysis/<int:project_id>/metrics/from-payload/", views.run_project_metrics, name="run_project_metrics"),
    path("api/analysis/<int:project_id>/metrics/summary/", views.metrics_summary, name="metrics_summary"),
    path("api/analysis/<int:project_id>/metrics/details/", views.metrics_details, name="metrics_details"),
    path("api/analysis/<int:project_id>/metrics/developers/", views.metrics_developers, name="metrics_developers"),
path("api/reports/dashboard/", views.dashboard_stats, name="dashboard_stats"),

    path("api/analysis/<int:project_id>/compare-inputs/", views.compare_inputs_api, name="compare_inputs_api"),
]
