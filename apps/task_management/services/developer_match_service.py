from __future__ import annotations

import zipfile
import tempfile
from pathlib import Path
from typing import Optional

import numpy as np

from apps.analysis.embeddings.embedder import LocalEmbedder
from apps.analysis.models import BpmnTask, MatchResult, TaskEmbedding
from apps.analysis.code.structured_extractor import extract_structured_functions
from apps.analysis.summary.code_summary_service import SummaryService
from apps.task_management.models import DeveloperSubmission


def _cosine_similarity(a: list, b: list) -> float:
    av = np.asarray(a, dtype=float)
    bv = np.asarray(b, dtype=float)
    if av.size == 0 or bv.size == 0:
        return 0.0
    denom = (np.linalg.norm(av) * np.linalg.norm(bv)) or 1e-9
    return float(np.clip(np.dot(av, bv) / denom, -1.0, 1.0))


def _extract_summaries_from_zip(zip_path: Path) -> list[tuple[str, str]]:
    """
    Extract all Python functions from a ZIP, summarize each one.
    Returns list of (function_name, summary) tuples.
    """
    all_functions = []

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)
        with zipfile.ZipFile(zip_path, "r") as zf:
            zf.extractall(tmp)

        for py_file in tmp.rglob("*.py"):
            try:
                functions = extract_structured_functions(py_file, project_root=tmp)
                all_functions.extend(functions)
            except Exception as e:
                print(f"[developer_match_service] Failed to extract {py_file.name}: {e}")

    if not all_functions:
        return []

    try:
        summaries_dict = SummaryService().summarize_many(all_functions)
        return [
            (sf.get("function_name", ""), summaries_dict.get(sf.get("function_uid", ""), ""))
            for sf in all_functions
            if summaries_dict.get(sf.get("function_uid", ""), "").strip()
        ]
    except Exception as e:
        print(f"[developer_match_service] SummaryService failed: {e}")
        return []


def match_accepted_developer_submission(submission: DeveloperSubmission) -> Optional[dict]:
    """
    Runs when an evaluator accepts a developer ZIP submission.
    Extracts functions, summarizes, embeds, compares vs task embedding,
    saves a MatchResult.
    """
    assignment = submission.assignment
    task: BpmnTask = assignment.bpmn_task
    project = submission.project

    embedder = LocalEmbedder()

    # Get or compute task embedding
    task_emb = TaskEmbedding.objects.filter(project=project, bpmn_task=task).first()
    if task_emb and task_emb.vector:
        task_vector = task_emb.vector
    else:
        task_text = (task.summary_text or task.description or task.name or "").strip()
        if not task_text:
            return None
        task_vector = embedder.embed_many([task_text])[0].vector
        TaskEmbedding.objects.update_or_create(
            project=project,
            bpmn_task=task,
            defaults={"vector": task_vector},
        )

    # Extract and summarize functions from ZIP
    zip_path = Path(submission.zip_file.path)
    name_summary_pairs = _extract_summaries_from_zip(zip_path)

    best_summary = ""
    best_score = 0.0

    if name_summary_pairs:
        summaries = [s for _, s in name_summary_pairs]
        code_embeddings = embedder.embed_many(summaries)
        scores = [_cosine_similarity(emb.vector, task_vector) for emb in code_embeddings]
        best_idx = int(max(range(len(scores)), key=lambda i: scores[i]))
        best_score = scores[best_idx]
        best_summary = summaries[best_idx]

    # Remove any old result for this task from a previous submission
    MatchResult.objects.filter(
        project=project, task=task, is_ai_generated=False,
        code_ref__startswith="Developer submission"
    ).delete()
    MatchResult.objects.filter(
        project=project, task=task, is_ai_generated=False, status="MISSING"
    ).delete()

    threshold = float(getattr(project, "similarity_threshold", 0.6) or 0.6)
    # Evaluator manually reviewed and accepted — always MATCHED
    status = "MATCHED"
    
    code_ref = (
        f"Developer submission #{submission.id} "
        f"(assignment #{assignment.id}, attempt {submission.attempt_number})"
    )

    match = MatchResult.objects.create(
        project=project,
        task=task,
        code_ref=code_ref,
        similarity_score=best_score,
        status=status,
        is_ai_generated=False,
        matched_summary=best_summary,
    )

    return {
        "match": match,
        "similarity": best_score,
        "threshold": threshold,
        "below_threshold": best_score < threshold,
    }
def _parse_added_lines_from_patch(patch: str) -> set:
    """
    Parse a GitHub diff patch and return the set of line numbers
    (in the new file) that were added or modified by the developer.
    """
    import re as _re
    if not patch:
        return set()

    added_lines: set[int] = set()
    current_new_line = 0

    for line in patch.splitlines():
        if line.startswith("@@"):
            m = _re.search(r"\+(\d+)(?:,\d+)?", line)
            if m:
                current_new_line = int(m.group(1))
        elif line.startswith("+") and not line.startswith("+++"):
            added_lines.add(current_new_line)
            current_new_line += 1
        elif line.startswith("-"):
            pass  # removed line — don't advance new-file counter
        else:
            current_new_line += 1  # context line

    return added_lines


def _extract_developer_functions_from_pr(service, github_repo, pr_files: list, head_sha: str) -> list[tuple[str, str]]:
    """
    For each Python file changed in the PR, fetch its full content,
    extract only the functions whose lines were added/modified in the diff,
    summarize them, and return (function_name, summary) pairs.
    """
    import ast

    all_functions = []

    for pr_file in pr_files:
        filename = pr_file.get("filename", "")
        if not filename.endswith(".py"):
            continue
        if pr_file.get("status", "") == "removed":
            continue

        added_lines = _parse_added_lines_from_patch(pr_file.get("patch", ""))
        if not added_lines:
            continue

        try:
            file_data = service.get_file_content(
                github_repo.owner, github_repo.repo_name, filename, ref=head_sha or None
            )
            source = file_data.get("content", "")
        except Exception:
            continue

        if not source.strip():
            continue

        try:
            tree = ast.parse(source)
        except SyntaxError:
            continue

        source_lines = source.splitlines()

        for node in ast.walk(tree):
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue

            fn_start = node.lineno
            fn_end = getattr(node, "end_lineno", node.lineno)
            fn_lines = set(range(fn_start, fn_end + 1))

            # Only include if developer actually touched this function
            if not fn_lines.intersection(added_lines):
                continue

            fn_source = "\n".join(source_lines[fn_start - 1: fn_end])
            all_functions.append({
                "function_name": node.name,
                "function_uid": f"{filename}::{node.name}@L{fn_start}-L{fn_end}",
                "raw_snippet": fn_source,
                "file_path": filename,
                "language": "python",
            })

    if not all_functions:
        return []

    try:
        summaries_dict = SummaryService().summarize_many(all_functions)
        return [
            (sf["function_name"], summaries_dict.get(sf["function_uid"], ""))
            for sf in all_functions
            if summaries_dict.get(sf["function_uid"], "").strip()
        ]
    except Exception:
        return []


def match_accepted_github_submission(project, assignment, pr_number: int) -> Optional[dict]:
    """
    Runs when an evaluator accepts a GitHub PR submission.
    Fetches only the developer's changed/added Python functions from the PR,
    runs the same pipeline as ZIP: summarize → embed → cosine similarity vs task.
    Saves a MatchResult and returns the same result dict as match_accepted_developer_submission.
    """
    from apps.github_integration.models import GitHubRepository
    from apps.github_integration.services.github_service import GitHubService

    try:
        github_repo = GitHubRepository.objects.get(project=project)
    except GitHubRepository.DoesNotExist:
        return None

    service = GitHubService(token=github_repo.access_token)
    task: BpmnTask = assignment.bpmn_task
    embedder = LocalEmbedder()

    # Get or compute task embedding
    task_emb = TaskEmbedding.objects.filter(project=project, bpmn_task=task).first()
    if task_emb and task_emb.vector:
        task_vector = task_emb.vector
    else:
        task_text = (task.summary_text or task.description or task.name or "").strip()
        if not task_text:
            return None
        task_vector = embedder.embed_many([task_text])[0].vector
        TaskEmbedding.objects.update_or_create(
            project=project,
            bpmn_task=task,
            defaults={"vector": task_vector},
        )

    # Fetch PR files and head SHA
    try:
        pr_files = service.get_pull_request_files(github_repo.owner, github_repo.repo_name, pr_number)
        pr_data = service.get_pull_request(github_repo.owner, github_repo.repo_name, pr_number)
        head_sha = pr_data.get("head", {}).get("sha", "")
    except Exception:
        return None

    # Extract only developer-touched functions from changed files
    name_summary_pairs = _extract_developer_functions_from_pr(service, github_repo, pr_files, head_sha)

    best_summary = ""
    best_score = 0.0

    if name_summary_pairs:
        summaries = [s for _, s in name_summary_pairs]
        code_embeddings = embedder.embed_many(summaries)
        scores = [_cosine_similarity(emb.vector, task_vector) for emb in code_embeddings]
        best_idx = int(max(range(len(scores)), key=lambda i: scores[i]))
        best_score = scores[best_idx]
        best_summary = summaries[best_idx]

    # Clear old GitHub PR match for this task
    MatchResult.objects.filter(
        project=project, task=task, is_ai_generated=False,
        code_ref__startswith="GitHub PR"
    ).delete()

    threshold = float(getattr(project, "similarity_threshold", 0.6) or 0.6)

    match = MatchResult.objects.create(
        project=project,
        task=task,
        code_ref=f"GitHub PR #{pr_number} (assignment #{assignment.id})",
        similarity_score=best_score,
        status="MATCHED",
        is_ai_generated=False,
        matched_summary=best_summary,
    )

    return {
        "match": match,
        "similarity": best_score,
        "threshold": threshold,
        "below_threshold": best_score < threshold,
    }