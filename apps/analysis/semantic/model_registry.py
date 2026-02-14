from __future__ import annotations

from typing import Optional, Tuple

import torch
from transformers import AutoModelForSeq2SeqLM, AutoTokenizer


_T5_TOKENIZER: Optional[AutoTokenizer] = None
_T5_MODEL: Optional[AutoModelForSeq2SeqLM] = None
_T5_NAME: Optional[str] = None


def get_t5_bundle(
    model_name: str = "google/flan-t5-base",
) -> Tuple[AutoTokenizer, AutoModelForSeq2SeqLM, torch.device]:
    """
    Safe loader that avoids 'meta tensor' issues by loading normally on CPU.
    """

    global _T5_TOKENIZER, _T5_MODEL, _T5_NAME

    if _T5_MODEL is None or _T5_TOKENIZER is None or _T5_NAME != model_name:
        _T5_NAME = model_name

        _T5_TOKENIZER = AutoTokenizer.from_pretrained(model_name)

        # ✅ Force a standard load (no meta / no accelerate tricks)
        _T5_MODEL = AutoModelForSeq2SeqLM.from_pretrained(
            model_name,
            low_cpu_mem_usage=False,
        )
        _T5_MODEL.eval()

    device = torch.device("cpu")  # ✅ keep on CPU for stability
    return _T5_TOKENIZER, _T5_MODEL, device