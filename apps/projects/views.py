from apps.analysis.services import run_analysis_for_version
from django.contrib.auth.decorators import login_required
from django.shortcuts import get_object_or_404, redirect, render
from django.views.decorators.http import require_POST
from .models import UploadVersion

from .models import Project
from .services import (
    create_project,
    create_new_version,
    save_bpmn_file,
    save_code_zip_and_extract,
)


@login_required
def project_list(request):
    projects = Project.objects.filter(created_by=request.user)
    return render(request, "projects/project_list.html", {"projects": projects})


@login_required
def project_create(request):
    if request.method == "POST":
        name = request.POST.get("name")
        description = request.POST.get("description", "")
        project = create_project(request.user, name, description)
        return redirect("projects:detail", project_id=project.id)

    return render(request, "projects/project_create.html")


@login_required
def project_detail(request, project_id):
    project = get_object_or_404(Project, id=project_id, created_by=request.user)

    if request.method == "POST":
        version = create_new_version(project)

        bpmn_file = request.FILES.get("bpmn_file")
        code_zip = request.FILES.get("code_zip")

        if bpmn_file:
            save_bpmn_file(version, bpmn_file)

        if code_zip:
            save_code_zip_and_extract(version, code_zip)

        return redirect("projects:detail", project_id=project.id)

    latest_version = project.versions.first()
    latest_run = None
    run_history = []

    if latest_version:
        latest_run = latest_version.analysis_runs.first()

    # show history across versions (last 10 runs)
    for v in project.versions.all():
        run_history.extend(list(v.analysis_runs.all()[:3]))  # 3 per version max

    # sort by created_at desc in python
    run_history.sort(key=lambda r: r.created_at, reverse=True)
    run_history = run_history[:10]

    return render(
    request,
    "projects/project_detail.html",
    {
        "project": project,
        "latest_version": latest_version,
        "latest_run": latest_run,
        "run_history": run_history,
    },
)





@require_POST
@login_required
def run_analysis(request, project_id):
    project = get_object_or_404(Project, id=project_id, created_by=request.user)

    version_id = request.POST.get("version_id")

    if version_id:
        version = get_object_or_404(project.versions, id=version_id)
    else:
        version = project.versions.first()

    if not version:
        return redirect("projects:detail", project_id=project.id)

    run_analysis_for_version(version)
    return redirect("projects:detail", project_id=project.id)


from django.http import JsonResponse

@login_required
def version_files(request, project_id, version_id):
    project = get_object_or_404(Project, id=project_id, created_by=request.user)
    version = get_object_or_404(project.versions, id=version_id)

    files = list(
        version.code_files.values("relative_path", "ext", "size_bytes")
    )
    return JsonResponse({"project_id": project.id, "version_id": version.id, "files": files})


from django.http import JsonResponse

@login_required
def version_tasks(request, project_id, version_id):
    project = get_object_or_404(Project, id=project_id, created_by=request.user)
    version = get_object_or_404(project.versions, id=version_id)

    tasks = list(
        version.bpmn_tasks.values("task_id", "name", "description")
    )
    return JsonResponse({"project_id": project.id, "version_id": version.id, "tasks": tasks})



@login_required
def version_matches(request, project_id, version_id):
    project = get_object_or_404(Project, id=project_id, created_by=request.user)
    version = get_object_or_404(project.versions, id=version_id)

    matches = []
    for m in version.match_results.select_related("task").all():
        matches.append({
            "status": m.status,
            "similarity_score": m.similarity_score,
            "task": {
                "task_id": m.task.task_id,
                "name": m.task.name,
            } if m.task else None,
            "code_ref": m.code_ref,
        })

    return JsonResponse({"project_id": project.id, "version_id": version.id, "matches": matches})


from django.contrib import messages
from django.views.decorators.http import require_POST

@require_POST
@login_required
def update_threshold(request, project_id):
    project = get_object_or_404(Project, id=project_id, created_by=request.user)
    value = request.POST.get("similarity_threshold", "").strip()

    try:
        v = float(value)
        if v <= 0 or v >= 1:
            raise ValueError("Threshold must be between 0 and 1.")
        project.similarity_threshold = v
        project.save(update_fields=["similarity_threshold"])
        messages.success(request, "Similarity threshold updated.")
    except Exception:
        messages.error(request, "Invalid threshold. Use a number between 0 and 1 (e.g., 0.6).")

    return redirect("projects:detail", project_id=project.id)
