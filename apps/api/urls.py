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
from apps.api.projects_api.developer_submission_views import (
    api_my_tasks,
    api_submit_zip,
    api_dev_submissions_list,
    api_dev_submission_accept,
    api_dev_submission_reject,
    api_dev_submission_reassign,
    api_dev_submission_download,
)
from apps.api.projects_api.upload_views import (
    api_upload_bpmn,
    api_upload_code_zip,
    api_fetch_github_code,
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
    api_update_github_url,
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
    path("projects/<int:project_id>/settings/github-url/", api_update_github_url, name="update_github_url"),

    # Uploads & Analysis
    path("projects/<int:project_id>/upload-bpmn/", api_upload_bpmn, name="upload_bpmn"),
    path("projects/<int:project_id>/upload-code/", api_upload_code_zip, name="upload_code"),
    path("projects/<int:project_id>/fetch-github/", api_fetch_github_code, name="fetch_github"),
    path("projects/<int:project_id>/run-analysis/", api_run_analysis, name="run_analysis"),

    # Data
    path("projects/<int:project_id>/files/", api_project_files, name="project_files"),
    path("projects/<int:project_id>/tasks/", api_project_tasks, name="project_tasks"),
    path("projects/<int:project_id>/matches/", api_project_matches, name="project_matches"),
    path("projects/<int:project_id>/compare-inputs/", compare_inputs_api, name="compare_inputs"),
    path("projects/<int:project_id>/report/", api_project_report, name="project_report"),
    path("projects/<int:project_id>/recommendations/", api_project_recommendations, name="project_recommendations"),

    # Dashboard
    path("reports/dashboard/", analysis_views.dashboard_stats, name="dashboard_stats"),

    # Auth
    path("auth/", include("apps.api.auth_urls")),

    # Admin
    path("admin/", include("apps.api.admin_users_urls")),

    # Developer submissions
    path("projects/<int:project_id>/my-tasks/", api_my_tasks, name="my_tasks"),
    path("projects/<int:project_id>/my-tasks/<int:assignment_id>/submit/", api_submit_zip, name="submit_zip"),
    path("projects/<int:project_id>/developer-submissions/", api_dev_submissions_list, name="dev_submissions_list"),
    path("projects/<int:project_id>/developer-submissions/<int:submission_id>/accept/", api_dev_submission_accept, name="dev_submission_accept"),
    path("projects/<int:project_id>/developer-submissions/<int:submission_id>/reject/", api_dev_submission_reject, name="dev_submission_reject"),
    path("projects/<int:project_id>/developer-submissions/<int:submission_id>/reassign/", api_dev_submission_reassign, name="dev_submission_reassign"),
    path("projects/<int:project_id>/developer-submissions/<int:submission_id>/download/", api_dev_submission_download, name="dev_submission_download"),
]