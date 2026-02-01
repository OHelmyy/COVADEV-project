from django.shortcuts import render

# Create your views here.
import traceback
import json
from django.http import JsonResponse
from django.http import HttpRequest
from .services import run_semantic_pipeline_for_project
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods, require_GET
from django.shortcuts import render
from .services import compute_metrics_from_similarity_payload

def _read_json(request):
    if not request.body:
        return {}
    return json.loads(request.body.decode("utf-8"))


@require_GET
def run_project_metrics(request, project_id: int):
    payload = _read_json(request)
    result = compute_metrics_from_similarity_payload(payload)
    return JsonResponse(result, safe=True)


@csrf_exempt
@require_http_methods(["POST"])
def metrics_summary(request, project_id: int):
    payload = _read_json(request)
    print("PAYLOAD:", payload)  # ✅ TEMP debug
    result = compute_metrics_from_similarity_payload(payload)
    return JsonResponse(result["summary"], safe=True)




@csrf_exempt
@require_http_methods(["POST"])
def metrics_details(request, project_id: int):
    payload = _read_json(request)
    result = compute_metrics_from_similarity_payload(payload)
    return JsonResponse(result["details"], safe=True)



@csrf_exempt
@require_http_methods(["POST"])
def metrics_developers(request, project_id: int):
    return JsonResponse({"message": "developer scoring not wired yet"}, safe=True)

@require_GET
def run_project(request, project_id: int):
    threshold = float(request.GET.get("threshold", 0.7))
    result = run_semantic_pipeline_for_project(project_id, threshold=threshold)
    return JsonResponse(result, safe=True)

@require_GET
def dashboard(request):
    return render(request, "analysis/dashboard.html")