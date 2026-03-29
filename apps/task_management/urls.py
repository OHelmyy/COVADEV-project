from django.urls import path
from apps.task_management.api import (
    project_developers_api,
    project_task_assignments_api,
    assign_task_api,
    submit_task_assignment_api,
    review_task_assignment_api,
    my_task_assignments_api,
    start_task_assignment_api,
    evaluate_task_assignment_api,
    developer_performance_overview_api
)

urlpatterns = [
    path("projects/<int:project_id>/developers/", project_developers_api, name="project_developers_api"),
    path("projects/<int:project_id>/task-assignments/", project_task_assignments_api, name="project_task_assignments_api"),
    path("projects/<int:project_id>/task-assignments/assign/", assign_task_api, name="assign_task_api"),
    path("task-assignments/<int:assignment_id>/submit/", submit_task_assignment_api, name="submit_task_assignment_api"),
    path("task-assignments/<int:assignment_id>/review/", review_task_assignment_api, name="review_task_assignment_api"),
    path("task-assignments/my/", my_task_assignments_api),
    path("task-assignments/<int:assignment_id>/start/", start_task_assignment_api),
    path("task-assignments/<int:assignment_id>/evaluate/", evaluate_task_assignment_api, name="evaluate_task_assignment_api"),
    path("task-management/developer-performance/",developer_performance_overview_api,name="developer_performance_overview_api",
),
]