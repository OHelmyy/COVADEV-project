from __future__ import annotations

import os
import threading
import traceback
from django.utils import timezone
from django.db import connection
from apps.task_management.models import TaskAssignment
from apps.task_management.services.ai_executor import (
    execute_ai_assignment,
    AITransientError,
    AIPermanentError,
    AIExecutorError,
)

SYNCHRONOUS = os.environ.get("AI_EXECUTOR_SYNC", "false").lower() == "true"


def _run_executor_then_close_connection(assignment_id: int) -> None:
    """Run the AI executor in a background thread, mark the assignment
    as REJECTED if the execution fails, and close the DB connection
    so this short-lived thread does not leak it."""
    try:
        execute_ai_assignment(assignment_id)
    except AIExecutorError as exc:
        traceback.print_exc()
        try:
            assignment = TaskAssignment.objects.get(id=assignment_id)
            assignment.status = TaskAssignment.Status.REJECTED
            assignment.review_notes = (
                f"{exc.user_message}\n\nTechnical details: {exc}"
            )[:2000]
            assignment.reviewed_at = timezone.now()
            assignment.save(update_fields=[
                "status", "review_notes", "reviewed_at", "updated_at",
            ])
        except Exception:
            traceback.print_exc()
    except Exception as exc:
        traceback.print_exc()
        try:
            assignment = TaskAssignment.objects.get(id=assignment_id)
            assignment.status = TaskAssignment.Status.REJECTED
            assignment.review_notes = (
                "AI execution failed unexpectedly. "
                "Please reassign this task to a human developer.\n\n"
                f"Technical details: {exc}"
            )[:2000]
            assignment.reviewed_at = timezone.now()
            assignment.save(update_fields=[
                "status", "review_notes", "reviewed_at", "updated_at",
            ])
        except Exception:
            traceback.print_exc()
    finally:
        connection.close()


def _schedule_executor(assignment_id: int) -> None:
    if SYNCHRONOUS:
        _run_executor_then_close_connection(assignment_id)
        return
    thread = threading.Thread(
        target=_run_executor_then_close_connection,
        args=(assignment_id,),
        daemon=True,
    )
    thread.start()


