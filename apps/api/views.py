import shutil
import tempfile
import zipfile
from pathlib import Path

from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework import status

from apps.analysis.semantic.analyze import analyze_project


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def analyze_view(request):
    """
    POST multipart/form-data:
      - bpmn: BPMN XML file (.bpmn or .xml)
      - code_zip: ZIP file containing code (python/react)

    Optional form fields:
      - threshold: float
      - matcher: "greedy" | "best_per_task"
      - top_k: int
      - include_debug: "true" | "false"
    """
    bpmn_file = request.FILES.get("bpmn")
    code_zip = request.FILES.get("code_zip")

    if not bpmn_file or not code_zip:
        return Response(
            {"error": "Missing required files: bpmn and code_zip"},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Parse optional params
    threshold = float(request.data.get("threshold", 0.55))
    matcher = str(request.data.get("matcher", "greedy"))
    top_k = int(request.data.get("top_k", 3))
    include_debug = str(request.data.get("include_debug", "false")).lower() == "true"

    # Temp workspace
    tmp_dir = Path(tempfile.mkdtemp(prefix="covadev_"))

    try:
        # 1) Save + unzip code
        zip_path = tmp_dir / "code.zip"
        zip_path.write_bytes(code_zip.read())

        code_root = tmp_dir / "code"
        code_root.mkdir(parents=True, exist_ok=True)

        with zipfile.ZipFile(zip_path, "r") as z:
            z.extractall(code_root)

        # 2) Run analysis
        bpmn_bytes = bpmn_file.read()

        result = analyze_project(
            bpmn_input=bpmn_bytes,
            code_root=code_root,
            threshold=threshold,
            matcher=matcher,
            top_k=top_k,
            include_debug=include_debug,
        )

        return Response(result, status=status.HTTP_200_OK)

    except zipfile.BadZipFile:
        return Response({"error": "Invalid ZIP file"}, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        # You can log e here
        return Response(
            {"error": "Analysis failed", "detail": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )

    finally:
        # 3) Cleanup temp directory
        shutil.rmtree(tmp_dir, ignore_errors=True)
