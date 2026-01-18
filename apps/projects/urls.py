from django.urls import path
from . import views

app_name = "projects"

urlpatterns = [
    path("", views.project_list, name="list"),
    path("create/", views.project_create, name="create"),
    path("<int:project_id>/", views.project_detail, name="detail"),
    path("<int:project_id>/run-analysis/", views.run_analysis, name="run_analysis"),
    path("<int:project_id>/versions/<int:version_id>/files/", views.version_files, name="version_files"),
    path("<int:project_id>/versions/<int:version_id>/tasks/", views.version_tasks, name="version_tasks"),
    path("<int:project_id>/versions/<int:version_id>/matches/", views.version_matches, name="version_matches"),
    path("<int:project_id>/settings/threshold/", views.update_threshold, name="update_threshold"),

]
