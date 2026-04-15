from __future__ import annotations

import os
from groq import Groq


class ModelProvider:
    _instance = None
    MODEL_NAME = "llama-3.1-8b-instant"

    def __new__(cls):
        
        if cls._instance is None:
            print("Initializing Groq API client once...")
            instance = super().__new__(cls)
            instance.client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
            instance.model_name = cls.MODEL_NAME
            cls._instance = instance
        return cls._instance
