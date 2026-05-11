# apps/analysis/code/universal_extractor.py
from pathlib import Path
from typing import Any, Dict, List, Optional
from analysis.code.extractor_factory import ExtractorFactory

class UniversalExtractor:
    """
    Orchestrates the extraction of code artifacts from a directory
    by dispatching files to the appropriate specialized extractor.
    """
    @staticmethod
    def extract_from_directory(root_dir: Path, project_root: Optional[Path] = None) -> List[Dict[str, Any]]:
        all_artifacts = []
        root_dir = Path(root_dir)
        
        # Use rglob("*") to find all files recursively
        for file_path in root_dir.rglob("*"):
            if not file_path.is_file():
                continue
            
            # Get the appropriate extractor for this file type
            extractor = ExtractorFactory.get_extractor(file_path.suffix)
            
            if extractor:
                try:
                    # extract_from_file is the Template Method from BaseExtractor
                    file_artifacts = extractor.extract_from_file(file_path, project_root=project_root)
                    all_artifacts.extend(file_artifacts)
                except Exception as e:
                    # Log error and continue with other files
                    print(f"FAILED to extract from {file_path}: {e}")
                    
        return all_artifacts
