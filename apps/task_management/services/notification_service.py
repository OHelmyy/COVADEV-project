from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags


def send_task_assignment_email(assignment):
    developer_user = assignment.developer_membership.user
    project = assignment.project
    task = assignment.bpmn_task
    assigned_by = assignment.assigned_by

    recipient = developer_user.email
    if not recipient:
        return False

    subject = f"New Task Assigned: {task.name}"

    context = {
        "developer_name": developer_user.first_name or developer_user.username,
        "project_name": getattr(project, "name", f"Project #{project.id}"),
        "task_name": task.name,
        "task_id": task.task_id,
        "task_description": task.description or "No description provided.",
        "assignment_notes": assignment.assignment_notes or "No notes provided.",
        "assigned_by": assigned_by.username if assigned_by else "System",
    }

    html_message = render_to_string("emails/task_assigned.html", context)
    plain_message = strip_tags(html_message)

    send_mail(
        subject=subject,
        message=plain_message,
        from_email=getattr(settings, "DEFAULT_FROM_EMAIL", None),
        recipient_list=[recipient],
        html_message=html_message,
        fail_silently=False,
    )

    return True