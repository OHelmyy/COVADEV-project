# apps/task_management/permissions.py

def can_assign_tasks(project, user) -> bool:
    from apps.accounts.rbac import is_admin, is_evaluator
    if is_admin(user):
        return True
    return is_evaluator(user) and getattr(project, "evaluator_id", None) == user.id


def can_review_tasks(project, user) -> bool:
    return can_assign_tasks(project, user)


def can_view_assignment(assignment, user) -> bool:
    from apps.accounts.rbac import is_admin, is_evaluator
    if is_admin(user):
        return True
    if is_evaluator(user) and assignment.project.evaluator_id == user.id:
        return True
    return assignment.developer_membership.user_id == user.id