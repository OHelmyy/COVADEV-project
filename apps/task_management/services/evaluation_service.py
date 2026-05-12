from decimal import Decimal
from django.shortcuts import get_object_or_404

from apps.task_management.models import TaskAssignment, TaskEvaluation
from apps.task_management.services.notification_db_service import create_task_evaluated_notification
from apps.task_management.services.automated_evaluation_service import AutomatedEvaluationService


def evaluate_assignment(
    *,
    assignment_id: int,
    evaluator,
    correctness_score,
    quality_score,
    timeliness_score,
    communication_score,
    comments=""
):
    assignment = get_object_or_404(
        TaskAssignment.objects.select_related("project", "developer_membership__user"),
        id=assignment_id,
    )

    # Calculate final score explicitly
    final_score = (
        Decimal(str(correctness_score))
        + Decimal(str(quality_score))
        + Decimal(str(timeliness_score))
        + Decimal(str(communication_score))
    ) / Decimal("4")

    evaluation, _ = TaskEvaluation.objects.update_or_create(
        assignment=assignment,
        defaults={
            "evaluator": evaluator,
            "correctness_score": correctness_score,
            "quality_score": quality_score,
            "timeliness_score": timeliness_score,
            "communication_score": communication_score,
            "final_score": final_score,
            "comments": comments,
        },
    )

    create_task_evaluated_notification(evaluation)

    return evaluation


def auto_evaluate_assignment(*, assignment_id: int, evaluator):
    """
    Triggers automated evaluation for a task assignment.
    """
    assignment = get_object_or_404(
        TaskAssignment.objects.select_related("project", "bpmn_task", "developer_membership__user"),
        id=assignment_id,
    )

    auto_service = AutomatedEvaluationService()
    scores = auto_service.evaluate_assignment(assignment)

    # Calculate final score explicitly
    final_score = (
        Decimal(str(scores["correctness_score"]))
        + Decimal(str(scores["quality_score"]))
        + Decimal(str(scores["timeliness_score"]))
        + Decimal(str(scores["communication_score"]))
    ) / Decimal("4")

    evaluation, _ = TaskEvaluation.objects.update_or_create(
        assignment=assignment,
        defaults={
            "evaluator": evaluator,
            "correctness_score": scores["correctness_score"],
            "quality_score": scores["quality_score"],
            "timeliness_score": scores["timeliness_score"],
            "communication_score": scores["communication_score"],
            "final_score": final_score,
            "comments": scores["comments"],
        },
    )

    create_task_evaluated_notification(evaluation)

    return evaluation