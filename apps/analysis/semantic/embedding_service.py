from __future__ import annotations
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

_MODEL = None

def get_model():
    global _MODEL
    if _MODEL is None:
        _MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    return _MODEL

class SemanticEmbeddingService:
    def compute_similarity_matrix(self, task_texts, code_texts):
        model = get_model()
        task_vecs = model.encode(task_texts, normalize_embeddings=True)
        code_vecs = model.encode(code_texts, normalize_embeddings=True)
        return cosine_similarity(task_vecs, code_vecs).tolist()
