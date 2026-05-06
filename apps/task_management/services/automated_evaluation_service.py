# apps/task_management/services/automated_evaluation_service.py
from __future__ import annotations

import json
import logging
from typing import Any, Dict

from apps.analysis.models import MatchResult
from apps.analysis.models_code import CodeArtifact
from apps.analysis.summary.shared_model_singleton import ModelProvider
from apps.task_management.models import TaskAssignment

logger = logging.getLogger(__name__)

class AutomatedEvaluationService:
    def __init__(self):
        self.provider = ModelProvider()

    def evaluate_assignment(self, assignment: TaskAssignment) -> Dict[str, Any]:
        """
        Gathers context for a task assignment and uses LLM to generate evaluation scores.
        """
        context = self._gather_context(assignment)
        prompt = self._build_prompt(context)

        try:
            response = self.provider.client.chat.completions.create(
                model=self.provider.model_name,
                messages=[
                    {
                        "role": "system",
                        "content": "You are a senior technical lead evaluating a developer's task completion. You must provide scores between 0 and 100 based on the provided context. Return ONLY a valid JSON object.",
                    },
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=500,
                response_format={"type": "json_object"},
            )
            
            result_text = response.choices[0].message.content.strip()
            result_json = json.loads(result_text)
            
            # Validate and clean scores
            return {
                "correctness_score": self._clamp(result_json.get("correctness", 0)),
                "quality_score": self._clamp(result_json.get("quality", 0)),
                "timeliness_score": self._clamp(result_json.get("timeliness", 0)),
                "communication_score": self._clamp(result_json.get("communication", 0)),
                "comments": str(result_json.get("comments", "No comments provided.")),
            }

        except Exception as e:
            logger.exception("Automated evaluation failed for assignment %s", assignment.id)
            raise RuntimeError(f"Automated evaluation failed: {str(e)}")

    def _gather_context(self, assignment: TaskAssignment) -> Dict[str, Any]:
        task = assignment.bpmn_task
        project = assignment.project
        
        context = {
            "task_name": task.name,
            "task_description": task.description or task.summary_text,
            "submission_notes": assignment.submission_notes or "No submission notes.",
            "duration": self._calculate_duration(assignment),
            "code_snippet": "",
            "code_summary": ""
        }
        
        # Try to find matched code from analysis
        match = MatchResult.objects.filter(project=project, task=task, status="MATCHED").first()
        if match:
            artifact = CodeArtifact.objects.filter(project=project, code_uid=match.code_ref).first()
            if artifact:
                context["code_snippet"] = artifact.raw_snippet
                context["code_summary"] = artifact.summary_text
                
        return context

    def _calculate_duration(self, assignment: TaskAssignment) -> str:
        if assignment.started_at and assignment.submitted_at:
            delta = assignment.submitted_at - assignment.started_at
            hours = delta.total_seconds() / 3600
            if hours < 1:
                return f"{delta.total_seconds() / 60:.1f} minutes"
            return f"{hours:.2f} hours"
        return "Unknown"

    def _build_prompt(self, context: Dict[str, Any]) -> str:
        return f"""
Evaluate the following task completion by a developer.

### BPMN Task Requirements:
- Name: {context['task_name']}
- Description: {context['task_description']}

### Developer's Submission:
- Notes: {context['submission_notes']}
- Time Taken: {context['duration']}

### Code Implemented (Matched via Semantic Analysis):
- Summary: {context['code_summary'] or "N/A"}
- Snippet:
{context['code_snippet'] if context['code_snippet'] else "No specific code snippet matched in the current analysis run."}

### Evaluation Criteria (Score each 0-100):
1. correctness: Does the implementation (or notes) indicate the requirements were met?
2. quality: Based on the snippet (if available) or description, what is the code quality?
3. timeliness: Is the duration reasonable for this type of task?
4. communication: Are the submission notes clear?

Respond ONLY with a JSON object:
{{
    "correctness": number,
    "quality": number,
    "timeliness": number,
    "communication": number,
    "comments": "concise 1-2 sentence feedback"
}}
"""

    def _clamp(self, value: Any) -> float:
        try:
            v = float(value)
            return max(0.0, min(100.0, v))
        except (TypeError, ValueError):
            return 0.0
