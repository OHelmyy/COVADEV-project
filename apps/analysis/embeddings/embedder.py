from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Sequence

import numpy as np
from sentence_transformers import SentenceTransformer


DEFAULT_MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


@dataclass(frozen=True)
class EmbeddingResult:
    """
    One embedding output record:
    - text: the input string used for embedding (cleaned)
    - vector: the embedding vector as a Python list[float]
    """
    text: str
    vector: List[float]


class LocalEmbedder:
    """
    Local (offline) embedder using SentenceTransformers.

    Single responsibility:
    - load the model once
    - embed text(s) into vectors
    """

    def __init__(self, model_name: str = DEFAULT_MODEL_NAME, device: Optional[str] = None) -> None:
        self.model_name = model_name
        self.model = SentenceTransformer(model_name, device=device)

    @staticmethod
    def _clean(text: Optional[str]) -> str:
        """
        Basic cleaning:
        - None -> ""
        - strip whitespace
        """
        if text is None:
            return ""
        return text.strip()

    def embed_one(self, text: Optional[str]) -> List[float]:
        """
        Embed a single text string into a vector.
        Returns list[float] so it can be JSON-serializable later.
        """
        cleaned = self._clean(text)
        vec = self.model.encode(cleaned, normalize_embeddings=True)
        return np.asarray(vec, dtype=float).tolist()

    def embed_many(self, texts: Sequence[Optional[str]], batch_size: int = 32) -> List[EmbeddingResult]:
        """
        Embed multiple texts (batch).

        IMPORTANT:
        - batch_size is supported because pipeline.py passes it.
        - normalize_embeddings=True => cosine similarity becomes stable later (Day 5).
        """
        cleaned: List[str] = [self._clean(t) for t in texts]
        if not cleaned:
            return []

        vectors = self.model.encode(
            cleaned,
            batch_size=int(batch_size),
            normalize_embeddings=True,
        )

        vectors_np = np.asarray(vectors, dtype=float)

        results: List[EmbeddingResult] = []
        for text, vec in zip(cleaned, vectors_np):
            results.append(EmbeddingResult(text=text, vector=vec.tolist()))

        return results
