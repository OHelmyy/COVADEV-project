from django.db import models
from apps.analysis.models import AnalysisRun
from apps.analysis.models_code import CodeArtifact


class CodeEmbedding(models.Model):
    run = models.ForeignKey(AnalysisRun, on_delete=models.CASCADE, related_name="code_embeddings")
    code_artifact = models.ForeignKey(CodeArtifact, on_delete=models.CASCADE)

    vector = models.JSONField()   # list[float]


class SimilarityScore(models.Model):
    run = models.ForeignKey(AnalysisRun, on_delete=models.CASCADE)
    task_id = models.CharField(max_length=255)
    code_artifact = models.ForeignKey(CodeArtifact, on_delete=models.CASCADE)

    score = models.FloatField()
