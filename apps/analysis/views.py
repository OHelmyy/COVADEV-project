# apps/analysis/views.py

from __future__ import annotations

import json
import traceback
from pathlib import Path
from django.conf import settings
from django.contrib.auth.decorators import login_required
from django.http import JsonResponse
from django.shortcuts import get_object_or_404, render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_GET, require_http_methods
from apps.projects.models import Project, ProjectMembership, ProjectFile
from apps.analysis.models import AnalysisRun
from apps.accounts.rbac import is_admin, is_evaluator
from .services.services import run_semantic_pipeline_for_project, compute_metrics_from_similarity_payload
from apps.analysis.bpmn.parser import extract_bpmn_graph
from apps.api.projects_api.permissions import can_open_project
from django.http import HttpResponse
from django.views.decorators.http import require_POST
from apps.analysis.services.upload_flow_service import run_bpmn_upload_flow
from django.core.files.base import ContentFile
from apps.analysis.models import MatchResult
# ============================================================
# Helpers
# ============================================================

def _abs_media_path(stored_path: str) -> Path:
    """
    Convert a MEDIA relative stored path to an absolute Path.
    """
    return (Path(settings.MEDIA_ROOT) / stored_path).resolve()


def _ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def _read_json(request) -> dict:
    if not request.body:
        return {}
    return json.loads(request.body.decode("utf-8"))


def _can_open_project(project: Project, user) -> bool:
    """
    Option 1 access rule:
      - Admin can open everything
      - Evaluator can open projects where project.evaluator == user
      - Developer can open if membership exists
    """
    if is_admin(user):
        return True

    if is_evaluator(user) and project.evaluator_id == user.id:
        return True

    return ProjectMembership.objects.filter(project=project, user=user).exists()


def _forbidden():
    return JsonResponse({"detail": "Forbidden"}, status=403)


def _resolve_code_root_from_project(project: Project) -> Path:
    active_code = getattr(project, "active_code", None)
    if not active_code:
        raise ValueError("No active Code ZIP uploaded.")

    extracted_dir = str(getattr(active_code, "extracted_dir", "") or "").strip()
    if extracted_dir:
        p = Path(extracted_dir)
        return p if p.is_absolute() else (Path(settings.MEDIA_ROOT) / p)

    raise ValueError("No extracted_dir found. Re-upload the code ZIP.")

# ============================================================
# ✅ Dashboard page (UI)
# ============================================================

@login_required
@require_GET
def dashboard(request):
    """
    If this is a global dashboard page, keep it accessible to logged-in users.
    Project-specific data should be loaded via the project endpoints below.
    """
    return render(request, "analysis/dashboard.html")


# ============================================================
# ✅ The endpoint your dashboard calls (PROJECT-BASED)
# ============================================================

@login_required
@require_GET
def run_project(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return _forbidden()

    threshold = float(request.GET.get("threshold", project.similarity_threshold or 0.7))
    top_k = int(request.GET.get("top_k", 3))

    result = run_semantic_pipeline_for_project(project_id, threshold=threshold, top_k=top_k)

    # Attach pre-dev info stored on active_bpmn
    try:
        project = Project.objects.select_related("active_bpmn").get(id=project_id)
        ab = project.active_bpmn
        result["bpmn_summary"] = (ab.bpmn_summary if ab else "") or ""
        result["precheck_warnings"] = (ab.precheck_warnings if ab else []) or []
        result["precheck_errors"] = (ab.precheck_errors if ab else []) or []
        result["is_well_formed"] = bool(ab.is_well_formed) if ab else False
    except Exception:
        result["bpmn_summary"] = ""
        result["precheck_warnings"] = []
        result["precheck_errors"] = []
        result["is_well_formed"] = False

    return JsonResponse(result, safe=True, json_dumps_params={"ensure_ascii": False})


# ============================================================
# ✅ Metrics endpoints
# ============================================================
# NOTE: These metrics endpoints compute precision, recall, F1 and alignment.
# Not currently used by the frontend — available for future use or external tooling.
@csrf_exempt
@login_required
@require_http_methods(["POST"])
def run_project_metrics(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return _forbidden()

    payload = _read_json(request)
    try:
        result = compute_metrics_from_similarity_payload(payload)
        return JsonResponse(result, safe=True, json_dumps_params={"ensure_ascii": False})
    except Exception as e:
        return JsonResponse({"error": str(e), "trace": traceback.format_exc()}, status=500)


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def metrics_summary(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return _forbidden()

    payload = _read_json(request)
    try:
        result = compute_metrics_from_similarity_payload(payload)
        return JsonResponse(result["summary"], safe=True, json_dumps_params={"ensure_ascii": False})
    except Exception as e:
        return JsonResponse({"error": str(e), "trace": traceback.format_exc()}, status=500)


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def metrics_details(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return _forbidden()

    payload = _read_json(request)
    try:
        result = compute_metrics_from_similarity_payload(payload)
        return JsonResponse(result["details"], safe=True, json_dumps_params={"ensure_ascii": False})
    except Exception as e:
        return JsonResponse({"error": str(e), "trace": traceback.format_exc()}, status=500)


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def metrics_developers(request, project_id: int):
    project = get_object_or_404(Project, id=project_id)
    if not _can_open_project(project, request.user):
        return _forbidden()

    return JsonResponse({"message": "developer scoring not wired yet"}, safe=True)


# ============================================================
# Compare BPMN vs Code inputs endpoint
# ============================================================
@login_required
@require_GET
def dashboard_stats(request):
    """
    JSON endpoint for React DashboardPage:
    GET /analysis/api/reports/dashboard/
    Scoped to projects where the user is a member.
    """
    memberships = (
        ProjectMembership.objects
        .select_related("project")
        .filter(user=request.user)
    )
    project_ids = [m.project_id for m in memberships]
    unique_project_ids = list(set(project_ids))

    total_projects = len(unique_project_ids)
    total_uploads = ProjectFile.objects.filter(project_id__in=unique_project_ids).count()

    analyses_done = AnalysisRun.objects.filter(project_id__in=unique_project_ids, status="DONE").count()
    analyses_pending = AnalysisRun.objects.filter(project_id__in=unique_project_ids).exclude(status="DONE").count()

    recent_projects_qs = (
        Project.objects
        .filter(id__in=unique_project_ids)
        .order_by("-created_at")[:10]
    )

    recent_projects = []
    for p in recent_projects_qs:
        last_run = AnalysisRun.objects.filter(project=p).order_by("-created_at").first()
        status = "done" if (last_run and last_run.status == "DONE") else "pending"
        updated_at = (last_run.created_at if last_run else p.created_at)

        recent_projects.append({
            "id": str(p.id),
            "name": p.name,
            "status": status,
            "updatedAt": updated_at.isoformat() if updated_at else "",
        })

    return JsonResponse(
        {
            "totalProjects": total_projects,
            "totalUploads": total_uploads,
            "analysesPending": analyses_pending,
            "analysesDone": analyses_done,
            "recentProjects": recent_projects,
        },
        safe=True,
        json_dumps_params={"ensure_ascii": False},
    )

@login_required
@require_GET
def project_bpmn_diagram(request, project_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    project = get_object_or_404(
        Project.objects.select_related("active_bpmn", "evaluator"),
        id=project_id,
    )

    if not can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    active_bpmn = project.active_bpmn

    if not active_bpmn:
        return JsonResponse({"error": "No active BPMN uploaded."}, status=404)

    try:
        bpmn_path = _abs_media_path(active_bpmn.stored_path)
        graph = extract_bpmn_graph(bpmn_path)

        return JsonResponse(
            graph,
            safe=True,
            json_dumps_params={"ensure_ascii": False},
        )

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

def _auto_add_bpmn_di(xml_text: str) -> str:
    import xml.etree.ElementTree as ET
    from io import StringIO

    BPMN   = "http://www.omg.org/spec/BPMN/20100524/MODEL"
    BPMNDI = "http://www.omg.org/spec/BPMN/20100524/DI"
    DC     = "http://www.omg.org/spec/DD/20100524/DC"
    DI_NS  = "http://www.omg.org/spec/DD/20100524/DI"

    for prefix, uri in [("", BPMN), ("bpmndi", BPMNDI), ("dc", DC), ("di", DI_NS)]:
        ET.register_namespace(prefix, uri)

    try:
        tree = ET.parse(StringIO(xml_text))
    except ET.ParseError:
        return xml_text

    root = tree.getroot()
    process = root.find(f"{{{BPMN}}}process")
    if process is None:
        return xml_text
    process_id = process.get("id", "Process_1")

    SHAPE_SIZES = {
        f"{{{BPMN}}}startEvent": (36,36), f"{{{BPMN}}}endEvent": (36,36),
        f"{{{BPMN}}}intermediateThrowEvent": (36,36), f"{{{BPMN}}}intermediateCatchEvent": (36,36),
        f"{{{BPMN}}}boundaryEvent": (36,36),
        f"{{{BPMN}}}task": (100,80), f"{{{BPMN}}}userTask": (100,80),
        f"{{{BPMN}}}serviceTask": (100,80), f"{{{BPMN}}}scriptTask": (100,80),
        f"{{{BPMN}}}manualTask": (100,80), f"{{{BPMN}}}businessRuleTask": (100,80),
        f"{{{BPMN}}}sendTask": (100,80), f"{{{BPMN}}}receiveTask": (100,80),
        f"{{{BPMN}}}callActivity": (100,80), f"{{{BPMN}}}subProcess": (350,200),
        f"{{{BPMN}}}exclusiveGateway": (50,50), f"{{{BPMN}}}parallelGateway": (50,50),
        f"{{{BPMN}}}inclusiveGateway": (50,50), f"{{{BPMN}}}eventBasedGateway": (50,50),
        f"{{{BPMN}}}complexGateway": (50,50),
    }

    elements, flows = [], []
    for child in process:
        eid = child.get("id")
        if not eid:
            continue
        if child.tag in SHAPE_SIZES:
            w, h = SHAPE_SIZES[child.tag]
            elements.append((eid, w, h))
        elif child.tag == f"{{{BPMN}}}sequenceFlow":
            src, tgt = child.get("sourceRef",""), child.get("targetRef","")
            if src and tgt:
                flows.append((eid, src, tgt))

    if not elements:
        return xml_text

    adj    = {e[0]: [] for e in elements}
    in_deg = {e[0]: 0  for e in elements}
    for _, src, tgt in flows:
        if src in adj and tgt in adj:
            adj[src].append(tgt); in_deg[tgt] += 1

    queue = [e[0] for e in elements if in_deg[e[0]] == 0]
    ordered, seen = [], set()
    while queue:
        node = queue.pop(0)
        if node in seen: continue
        seen.add(node); ordered.append(node)
        for nb in adj.get(node, []):
            in_deg[nb] -= 1
            if in_deg[nb] == 0: queue.append(nb)
    for eid, _, _ in elements:
        if eid not in seen: ordered.append(eid)

    elem_map = {e[0]: (e[1], e[2]) for e in elements}
    positions, x = {}, 100
    for eid in ordered:
        if eid not in elem_map: continue
        w, h = elem_map[eid]
        positions[eid] = (x, 200 - h // 2, w, h)
        x += w + 80

    diag  = ET.SubElement(root,  f"{{{BPMNDI}}}BPMNDiagram", {"id": "BPMNDiagram_auto", "name": "diagram"})
    plane = ET.SubElement(diag,  f"{{{BPMNDI}}}BPMNPlane",   {"id": "BPMNPlane_auto", "bpmnElement": process_id})

    for eid, (ex, ey, ew, eh) in positions.items():
        shape = ET.SubElement(plane, f"{{{BPMNDI}}}BPMNShape", {"id": f"shape_{eid}", "bpmnElement": eid})
        ET.SubElement(shape, f"{{{DC}}}Bounds", {"x": str(ex), "y": str(ey), "width": str(ew), "height": str(eh)})

    for fid, src, tgt in flows:
        if src in positions and tgt in positions:
            sx, sy, sw, sh = positions[src]
            tx, ty, _, th  = positions[tgt]
            edge = ET.SubElement(plane, f"{{{BPMNDI}}}BPMNEdge", {"id": f"edge_{fid}", "bpmnElement": fid})
            ET.SubElement(edge, f"{{{DI_NS}}}waypoint", {"x": str(sx+sw), "y": str(sy+sh//2)})
            ET.SubElement(edge, f"{{{DI_NS}}}waypoint", {"x": str(tx),    "y": str(ty+th//2)})

    return ET.tostring(root, encoding="unicode")


@login_required
@require_GET
def project_bpmn_xml(request, project_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    project = get_object_or_404(
        Project.objects.select_related("active_bpmn", "evaluator"),
        id=project_id,
    )

    if not can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    if not project.active_bpmn:
        return JsonResponse({"error": "No active BPMN uploaded."}, status=404)

    bpmn_path = _abs_media_path(project.active_bpmn.stored_path)

    xml_text = bpmn_path.read_text(encoding="utf-8")

    # ✅ Check if BPMN has visual diagram layout
    # if "BPMNDiagram" not in xml_text:
    #     return JsonResponse(
    #         {
    #             "error": (
    #                 "This BPMN file is valid but has no BPMN diagram layout "
    #                 "(BPMN DI). Please upload a BPMN exported from a BPMN modeler."
    #             )
    #         },
    #         status=400,
    #     )
    if "BPMNDiagram" not in xml_text:
       xml_text = _auto_add_bpmn_di(xml_text)

    return HttpResponse(
        xml_text,
        content_type="application/xml",
    )

@login_required
@require_GET
def project_bpmn_diagnostics(request, project_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    project = get_object_or_404(
        Project.objects.select_related("active_bpmn", "evaluator"),
        id=project_id,
    )

    if not can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    if not project.active_bpmn:
        return JsonResponse({"error": "No active BPMN uploaded."}, status=404)

    return JsonResponse({
        "isWellFormed": project.active_bpmn.is_well_formed,
        "errors": project.active_bpmn.precheck_errors or [],
        "warnings": project.active_bpmn.precheck_warnings or [],
    })

@login_required
@require_POST
def save_fixed_bpmn(request, project_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    project = get_object_or_404(Project, id=project_id)
    if not (
        is_admin(request.user)
        or (is_evaluator(request.user) and project.evaluator_id == request.user.id)
    ):
        return JsonResponse(
            {"detail": "Only the assigned evaluator or admin can edit BPMN."},
            status=403,
        )

    try:
        payload = json.loads(request.body.decode("utf-8"))
        xml = payload.get("xml", "")

        if not xml.strip():
            return JsonResponse({"error": "Missing BPMN XML."}, status=400)

        filename = f"fixed_project_{project.id}.bpmn"
        upload_file = ContentFile(xml.encode("utf-8"), name=filename)

        result = run_bpmn_upload_flow(project, upload_file, request.user)

        return JsonResponse({
            "ok": True,
            "precheck": result.get("predev", {}),
        })

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)
    
@login_required
@require_GET
def project_bpmn_match_status(request, project_id: int):
    if not request.user.is_authenticated:
        return JsonResponse({"detail": "Authentication required"}, status=401)

    project = get_object_or_404(
        Project.objects.select_related("active_bpmn", "evaluator"),
        id=project_id,
    )

    if not can_open_project(project, request.user):
        return JsonResponse({"detail": "Forbidden"}, status=403)

    results = (
        MatchResult.objects
        .filter(project=project)
        .select_related("task")
    )

    tasks = []

    for r in results:
        if not r.task:
            continue

        tasks.append({
            "taskId": r.task.task_id,
            "taskName": r.task.name,
            "status": r.status,
            "score": r.similarity_score,
            "codeRef": r.code_ref,
        })

    return JsonResponse({
        "tasks": tasks,
    })