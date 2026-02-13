# apps/api/urls.py
from django.urls import include, path

from apps.analysis import views as analysis_views
from .projects_api import (
    api_projects_list_create,
    api_project_members,
    api_remove_member,
    api_project_logs,
    api_update_threshold,
    api_upload_bpmn,
    api_upload_code_zip,
    api_run_analysis,
    api_project_files,
    api_project_tasks,
    api_project_matches,
    api_project_detail_or_delete
    
)

app_name = "api"

urlpatterns = [
    # Projects
    path("projects/<int:project_id>/", api_project_detail_or_delete),
    path("projects/", api_projects_list_create),
    
    # Members
    path("projects/<int:project_id>/members/", api_project_members, name="project_members"),
    path("projects/<int:project_id>/members/<int:membership_id>/remove/", api_remove_member, name="remove_member"),

    # Logs
    path("projects/<int:project_id>/logs/", api_project_logs, name="project_logs"),

    # Settings
    path("projects/<int:project_id>/settings/threshold/", api_update_threshold, name="update_threshold"),

    # Uploads & Analysis
    path("projects/<int:project_id>/upload-bpmn/", api_upload_bpmn, name="upload_bpmn"),
    path("projects/<int:project_id>/upload-code/", api_upload_code_zip, name="upload_code"),
    path("projects/<int:project_id>/run-analysis/", api_run_analysis, name="run_analysis"),

    # Data
    path("projects/<int:project_id>/files/", api_project_files, name="project_files"),
    path("projects/<int:project_id>/tasks/", api_project_tasks, name="project_tasks"),
    path("projects/<int:project_id>/matches/", api_project_matches, name="project_matches"),

    # Dashboard
    path("reports/dashboard/", analysis_views.dashboard_stats, name="dashboard_stats"),

    #auth
    path("auth/", include("apps.api.auth_urls")),

    #adminnn
    path("admin/", include("apps.api.admin_users_urls")),

]
