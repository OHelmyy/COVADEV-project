from django.urls import path
from apps.task_management.api import (
    ai_submission_api,
    project_ai_runs_api,
    project_developers_api,
    project_task_assignments_api,
    assign_task_api,
    retry_ai_assignment_api,
    submit_task_assignment_api,
    review_task_assignment_api,
    my_task_assignments_api,
    start_task_assignment_api,
    evaluate_task_assignment_api,
    developer_performance_overview_api,
    my_performance_insights_api,
    my_notifications_api,
    mark_notification_read_api,
    mark_all_notifications_read_api,
)


urlpatterns = [
    # Project-scoped endpoints
    path("projects/<int:project_id>/developers/", project_developers_api, name="project_developers_api"),
    path("projects/<int:project_id>/task-assignments/", project_task_assignments_api, name="project_task_assignments_api"),
    path("projects/<int:project_id>/task-assignments/assign/", assign_task_api, name="assign_task_api"),
    path("projects/<int:project_id>/ai-runs/", project_ai_runs_api, name="project_ai_runs_api"),

    # Per-assignment endpoints
    path("task-assignments/<int:assignment_id>/submit/", submit_task_assignment_api, name="submit_task_assignment_api"),
    path("task-assignments/<int:assignment_id>/review/", review_task_assignment_api, name="review_task_assignment_api"),
    path("task-assignments/<int:assignment_id>/start/", start_task_assignment_api),
    path("task-assignments/<int:assignment_id>/evaluate/", evaluate_task_assignment_api, name="evaluate_task_assignment_api"),
    path("task-assignments/<int:assignment_id>/ai-submission/", ai_submission_api, name="ai_submission_api"),
    path("task-assignments/<int:assignment_id>/ai-retry/", retry_ai_assignment_api, name="retry_ai_assignment_api"),
    path("task-assignments/my/", my_task_assignments_api),

    # Reporting / notifications
    path("task-management/developer-performance/", developer_performance_overview_api, name="developer_performance_overview_api"),
    path("task-management/my-insights/", my_performance_insights_api, name="my_performance_insights_api"),
    path("task-management/my-notifications/", my_notifications_api, name="my_notifications_api"),
    path("task-management/notifications/<int:notification_id>/read/", mark_notification_read_api, name="mark_notification_read_api"),
    path("task-management/notifications/read-all/", mark_all_notifications_read_api, name="mark_all_notifications_read_api"),
]