from apps.task_management.models import Notification


def create_task_assigned_notification(assignment):
    developer_user = assignment.developer_membership.user
    task = assignment.bpmn_task
    project = assignment.project

    return Notification.objects.create(
        user=developer_user,
        project=project,
        assignment=assignment,
        type=Notification.Type.TASK_ASSIGNED,
        title="New task assigned",
        message=(
            f'You have been assigned "{task.name}" '
            f'in project "{getattr(project, "name", f"Project #{project.id}")}".'
        ),
    )


def create_task_reviewed_notification(assignment):
    developer_user = assignment.developer_membership.user
    task = assignment.bpmn_task
    project = assignment.project

    status_text = "accepted" if assignment.status == "ACCEPTED" else "rejected"

    return Notification.objects.create(
        user=developer_user,
        project=project,
        assignment=assignment,
        type=Notification.Type.TASK_REVIEWED,
        title=f"Task {status_text}",
        message=(
            f'Your task "{task.name}" in project '
            f'"{getattr(project, "name", f"Project #{project.id}")}" was {status_text}.'
        ),
    )


def create_task_evaluated_notification(evaluation):
    assignment = evaluation.assignment
    developer_user = assignment.developer_membership.user
    task = assignment.bpmn_task
    project = assignment.project

    return Notification.objects.create(
        user=developer_user,
        project=project,
        assignment=assignment,
        type=Notification.Type.TASK_EVALUATED,
        title="Task evaluation added",
        message=(
            f'Your task "{task.name}" in project '
            f'"{getattr(project, "name", f"Project #{project.id}")}" '
            f'was evaluated with final score {float(evaluation.final_score):.2f}.'
        ),
    )