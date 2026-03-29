from django.shortcuts import get_object_or_404

from apps.task_management.models import TaskAssignment, TaskEvaluation


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

    evaluation, _ = TaskEvaluation.objects.update_or_create(
        assignment=assignment,
        defaults={
            "evaluator": evaluator,
            "correctness_score": correctness_score,
            "quality_score": quality_score,
            "timeliness_score": timeliness_score,
            "communication_score": communication_score,
            "comments": comments,
        },
    )
    return evaluation