# apps/analysis/code/extractor_factory.py
from typing import Optional
from .base_extractor import BaseExtractor
from .structured_extractor import PythonExtractor
from .react_extractor import JavascriptExtractor
from .java_extractor import JavaExtractor
from .cpp_extractor import CppExtractor
from .generic_extractor import GenericExtractor

class ExtractorFactory:
    """
    Factory to return the appropriate extractor Strategy based on file extension.
    """
    @staticmethod
    def get_extractor(extension: str) -> Optional[BaseExtractor]:
        ext = extension.lower().lstrip(".")
        
        if ext == "py":
            return PythonExtractor()
        
        if ext in {"js", "jsx", "ts", "tsx"}:
            return JavascriptExtractor()
        
        if ext == "java":
            return JavaExtractor()
        
        if ext in {"cpp", "c", "h", "hpp", "cc", "cxx"}:
            return CppExtractor()
        
        # Generic fallback for other common languages
        if ext in {"go", "php", "rb", "swift", "kt", "rs", "cs"}:
            return GenericExtractor(language=ext)
            
        return None
