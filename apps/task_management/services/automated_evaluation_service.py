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
You are a Senior Software Architect and Technical Lead. Your task is to evaluate a developer's implementation of a specific business process task.

### 1. CONTEXT
**Business Process Task (BPMN):**
- **Name:** {context['task_name']}
- **Requirement Description:** {context['task_description']}

**Developer's Submission:**
- **Developer Notes:** {context['submission_notes']}
- **Time Elapsed:** {context['duration']}

### 2. CODE ARTIFACT (Matched via Semantic Traceability)
This is the specific function identified in the codebase that corresponds to this task:
- **Functional Intent:** {context['code_summary'] or "N/A"}
- **Source Code Snippet:**
```python
{context['code_snippet'] if context['code_snippet'] else "# NO CODE SNIPPET MATCHED - BASE EVALUATION ON NOTES ONLY"}
```

### 3. EVALUATION INSTRUCTIONS
Analyze the code snippet (or notes if snippet is missing) strictly against the Business Process Task.

**Scoring Rubric (0-100):**
1. **correctness**: 
   - Does the code logic actually perform what the BPMN task requires?
   - Are the business rules handled correctly? 
   - Deduct points for logic gaps or missing requirements.
2. **quality**: 
   - Evaluate code structure, naming conventions, and readability.
   - Look for proper error handling and defensive programming.
   - Is it efficient and follow best practices?
3. **timeliness**: 
   - Evaluate the 'Time Elapsed' ({context['duration']}) against the complexity of the task.
   - **Simple tasks** (basic data mapping, simple UI changes, minor logic): Expected completion < 4 hours.
   - **Moderate tasks** (multi-step logic, API integrations, complex business rules): Expected completion 4-12 hours.
   - **Complex tasks** (architectural changes, deep refactoring, complex algorithms): Expected completion > 12 hours.
   - If 'Time Elapsed' is 'Unknown', provide a neutral baseline score (75-80).
   - Significant over-performance (finishing a complex task very quickly) should be rewarded with high scores *only if* the quality is also high.
   - Significant under-performance (taking 12+ hours for a simple task) should be penalized.
4. **communication**: 
   - Are the developer's notes clear and do they accurately describe the implementation?

### 4. OUTPUT FORMAT
Respond ONLY with a JSON object. Ensure the 'comments' provide technical, actionable feedback based on the code analysis.

{{
    "correctness": number,
    "quality": number,
    "timeliness": number,
    "communication": number,
    "comments": "concise technical feedback (1-2 sentences)"
}}
"""

    def _clamp(self, value: Any) -> float:
        try:
            v = float(value)
            return max(0.0, min(100.0, v))
        except (TypeError, ValueError):
            return 0.0
