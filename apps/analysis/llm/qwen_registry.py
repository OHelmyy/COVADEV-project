from __future__ import annotations

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM

_QWEN_CACHE: dict[str, tuple] = {}


def get_qwen_bundle(model_name: str):
    cached = _QWEN_CACHE.get(model_name)
    if cached is not None:
        return cached

    tokenizer = AutoTokenizer.from_pretrained(
        model_name,
        trust_remote_code=True,
    )

    use_cuda = torch.cuda.is_available()
    dtype = torch.float16 if use_cuda else torch.float32

    model = AutoModelForCausalLM.from_pretrained(
        model_name,
        torch_dtype=dtype,
        device_map="auto" if use_cuda else None,
        trust_remote_code=True,
    )

    if not use_cuda:
        model = model.to("cpu")

    bundle = (tokenizer, model)
    _QWEN_CACHE[model_name] = bundle
    return bundle