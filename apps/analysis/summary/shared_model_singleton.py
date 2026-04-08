from __future__ import annotations

import torch
from transformers import AutoTokenizer, AutoModelForCausalLM


class ModelProvider:
    _instance = None
    MODEL_NAME = "Qwen/Qwen2.5-1.5B-Instruct"

    def __new__(cls):
        if cls._instance is None:
            print("Loading shared summary model once...")

            instance = super().__new__(cls)

            instance.tokenizer = AutoTokenizer.from_pretrained(
                cls.MODEL_NAME,
                trust_remote_code=True,
            )

            instance.model = AutoModelForCausalLM.from_pretrained(
                cls.MODEL_NAME,
                torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
                device_map="auto",
                trust_remote_code=True,
            )

            cls._instance = instance

        return cls._instance