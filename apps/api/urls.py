# apps/api/urls.py
from django.urls import include, path

from apps.analysis import views as analysis_views
from apps.projects.views import compare_inputs_api

from apps.api.projects_api.project_views import (
    api_projects_list_create,
    api_project_detail_or_delete,
)
from apps.api.projects_api.member_views import (
    api_project_members,
    api_remove_member,
)
from apps.api.projects_api.upload_views import (
    api_upload_bpmn,
    api_upload_code_zip,
)
from apps.api.projects_api.analysis_views import (
    api_run_analysis,
)
from apps.api.projects_api.data_views import (
    api_project_files,
    api_project_tasks,
    api_project_matches,
    api_project_logs,
    api_update_threshold,
    api_project_report,
)
from apps.api.projects_api.recommendation_views import (
    api_project_recommendations,
)

app_name = "api"

urlpatterns = [
    # Projects
    path("projects/", api_projects_list_create, name="projects_list_create"),
    path("projects/<int:project_id>/", api_project_detail_or_delete, name="project_detail_or_delete"),

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
    path("projects/<int:project_id>/compare-inputs/", compare_inputs_api, name="compare_inputs"),
    path("projects/<int:project_id>/report/", api_project_report, name="project_report"),
    path("projects/<int:project_id>/recommendations/", api_project_recommendations, name="project_recommendations"),
    path("projects/<int:project_id>/bpmn-diagram/", analysis_views.project_bpmn_diagram, name="project_bpmn_diagram"),
    path("projects/<int:project_id>/bpmn-xml/",analysis_views.project_bpmn_xml,name="project_bpmn_xml",),
    path("projects/<int:project_id>/bpmn-diagnostics/",analysis_views.project_bpmn_diagnostics,name="project_bpmn_diagnostics",),
    path("projects/<int:project_id>/bpmn-save-fixed/",analysis_views.save_fixed_bpmn,name="bpmn_save_fixed",),
    path("projects/<int:project_id>/bpmn-match-status/",analysis_views.project_bpmn_match_status,name="project_bpmn_match_status",),
    # Dashboard
    path("reports/dashboard/", analysis_views.dashboard_stats, name="dashboard_stats"),

    # Auth
    path("auth/", include("apps.api.auth_urls")),

    # Admin
    path("admin/", include("apps.api.admin_users_urls")),
]