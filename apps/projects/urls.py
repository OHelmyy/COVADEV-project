from django.urls import path
from . import views

app_name = "projects"

urlpatterns = [
    path("", views.projects_list, name="list"),

    # Admin-only project creation (views.projects_create must enforce admin)
    path("create/", views.projects_create, name="create"),

    path("<int:project_id>/", views.projects_detail, name="detail"),

    # Uploads
    path("<int:project_id>/upload-bpmn/", views.upload_bpmn, name="upload_bpmn"),
    path("<int:project_id>/upload-code/", views.upload_code_zip, name="upload_code"),
    path("<int:project_id>/run-analysis/", views.run_analysis, name="run_analysis"),

    # JSON endpoints
    path("<int:project_id>/files/", views.project_files, name="project_files"),
    path("<int:project_id>/tasks/", views.project_tasks, name="project_tasks"),
    path("<int:project_id>/matches/", views.project_matches, name="project_matches"),

    # Logs (evaluator/admin only)
    path("<int:project_id>/logs/", views.upload_logs, name="upload_logs"),

    # Settings (evaluator/admin only)
    path("<int:project_id>/settings/threshold/", views.update_threshold, name="update_threshold"),

    # Members (evaluator/admin only) — in Option 1, these should manage developers only
    path("<int:project_id>/members/", views.project_members, name="members"),
    path("<int:project_id>/members/<int:membership_id>/remove/", views.remove_member, name="remove_member"),
]
