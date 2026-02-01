from django.urls import path
from .views import run_analysis
from . import views

urlpatterns = [
    path("", views.dashboard, name="dashboard"),
    path("api/analysis/<int:project_id>/run/", views.run_project, name="run_project"),
    path("api/analysis/<int:project_id>/run/", views.run_project_metrics, name="run_project_metrics"),
    path("api/analysis/<int:project_id>/metrics/summary/", views.metrics_summary, name="metrics_summary"),
    path("api/analysis/<int:project_id>/metrics/details/", views.metrics_details, name="metrics_details"),
    path("api/analysis/<int:project_id>/metrics/developers/", views.metrics_developers, name="metrics_developers"),
    path("run/", run_analysis, name="run_analysis"),
]
