from __future__ import annotations

import uuid
import zipfile
from pathlib import Path

from django.conf import settings
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from .bpmn.parser import extract_tasks
from .code.extractor import extract_python_from_directory
from .embeddings.pipeline import embed_pipeline
from .semantic.similarity import compute_similarity, top_k_matches
from .semantic.matcher import greedy_one_to_one_match


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


@csrf_exempt
def run_analysis(request):
    """
    Test endpoint for Days 1–5 pipeline.
    multipart/form-data:
      - bpmn_file (.bpmn/.xml)
      - code_zip (.zip)
      - top_k (optional)
    """
    if request.method != "POST":
        return JsonResponse({"error": "POST only"}, status=405)

    bpmn_file = request.FILES.get("bpmn_file")
    code_zip = request.FILES.get("code_zip")
    top_k = int(request.POST.get("top_k", "3") or "3")

    if not bpmn_file or not code_zip:
        return JsonResponse({"error": "bpmn_file and code_zip are required"}, status=400)

    # temp folder under MEDIA_ROOT
    run_id = uuid.uuid4().hex
    base_dir = Path(settings.MEDIA_ROOT) / "tmp_analysis" / run_id
    _ensure_dir(base_dir)

    bpmn_path = base_dir / bpmn_file.name
    zip_path = base_dir / code_zip.name
    code_dir = base_dir / "code"

    bpmn_path.write_bytes(bpmn_file.read())
    zip_path.write_bytes(code_zip.read())

    _ensure_dir(code_dir)
    with zipfile.ZipFile(zip_path, "r") as zf:
        zf.extractall(code_dir)

    try:
        tasks = extract_tasks(bpmn_path)
        code_items = extract_python_from_directory(code_dir, project_root=code_dir)

        embedded = embed_pipeline(tasks=tasks, code_items=code_items, batch_size=32)
        similarity = compute_similarity(
            task_embeddings=embedded["task_embeddings"],
            code_embeddings=embedded["code_embeddings"],
        )

        topk = top_k_matches(similarity=similarity, k=top_k)

        return JsonResponse(
            {
                "meta": {**embedded["meta"], **similarity["meta"], "top_k": top_k},
                "counts": {"tasks": len(tasks), "code_items": len(code_items)},
                "tasks_preview": tasks[:30],
                "code_items_preview": code_items[:50],
                "topk": topk,
            },
            json_dumps_params={"ensure_ascii": False},
        )
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
