from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Dict


class BasePipeline(ABC):
    """
    Template Method base class.

    Defines the fixed execution order:
      1) validate
      2) optionally stop early
      3) load
      4) preprocess
      5) execute
      6) save
      7) build_response

    Subclasses override the variable steps.
    """

    def __init__(self) -> None:
        self.result: Dict[str, Any] = {}

    def run(self) -> Dict[str, Any]:
        self.validate()

        if self.should_stop():
            return self.build_response()

        self.load()
        self.preprocess()
        self.execute()
        self.save()

        return self.build_response()

    @abstractmethod
    def validate(self) -> None:
        """
        Validate inputs and prepare any validation state.
        """
        raise NotImplementedError

    def should_stop(self) -> bool:
        """
        Optional early-stop hook after validation.
        Example: invalid BPMN should return immediately.
        """
        return False

    def load(self) -> None:
        """
        Load or parse required data.
        """
        return None

    def preprocess(self) -> None:
        """
        Optional preprocessing before execute().
        """
        return None

    @abstractmethod
    def execute(self) -> None:
        """
        Run the core logic of the pipeline.
        """
        raise NotImplementedError

    def save(self) -> None:
        """
        Optional persistence hook.
        """
        return None

    @abstractmethod
    def build_response(self) -> Dict[str, Any]:
        """
        Build the final returned payload.
        """
        raise NotImplementedError