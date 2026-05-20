from __future__ import annotations

from dataclasses import dataclass
from typing import List, Optional, Sequence

import numpy as np
from sentence_transformers import SentenceTransformer


DEFAULT_MODEL_NAME = "models/covadev-finetuned-embedder"

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
    #constructor with model loading
    def __init__(self, model_name: str = DEFAULT_MODEL_NAME, device: Optional[str] = None) -> None:
        self.model_name = model_name
        self.model = SentenceTransformer(model_name, device=device)

    @staticmethod
    def _clean(text: Optional[str]) -> str:

        if text is None:  
            return ""
        return text.strip()  # " hello " -> "hello"


    def embed_many(self, texts: Sequence[Optional[str]], batch_size: int = 32) -> List[EmbeddingResult]:

        cleaned: List[str] = [self._clean(t) for t in texts]
        if not cleaned:
            return []

        vectors = self.model.encode(  #calling the model to get embeddings
            cleaned,
            batch_size=int(batch_size), #the amount of texts to process in one batch, can be tuned for performance vs memory
            normalize_embeddings=True,
        )

        vectors_np = np.asarray(vectors, dtype=float) #convert to numpy array for easier math operation handling
                                                        #vectors_np[0] + vectors_np[1]
        results: List[EmbeddingResult] = [] 
        for text, vec in zip(cleaned, vectors_np):
            results.append(EmbeddingResult(text=text, vector=vec.tolist()))
            
        return results
        # print(results[0])
        # EmbeddingResult(text='Hello world!', vector=[0.12, -0.44, 0.98, ..., 0.05])
