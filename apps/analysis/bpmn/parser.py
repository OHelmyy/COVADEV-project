# covadev/apps/analysis/bpmn/parser.py

from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Dict, List, Union, Optional
import xml.etree.ElementTree as ET
from pathlib import Path


@dataclass
class BpmnTask:
    id: str
    name: str
    description: str
    type: str


@dataclass
class BpmnNode:
    """
    Generic BPMN node: event/gateway/task etc.
    """
    id: str
    name: str
    type: str  # e.g. "startEvent", "exclusiveGateway"


@dataclass
class BpmnFlow:
    """
    Sequence flow edge.
    """
    id: str
    name: str
    source: str
    target: str
    type: str  # "sequenceFlow"


TASK_TAGS = {
    "task",
    "userTask",
    "serviceTask",
    "scriptTask",
    "manualTask",
    "businessRuleTask",
    "sendTask",
    "receiveTask",
    "callActivity",
}

EVENT_TAGS = {"startEvent", "endEvent"}

GATEWAY_TAGS = {
    "exclusiveGateway",
    "parallelGateway",
    "inclusiveGateway",
    "eventBasedGateway",
    "complexGateway",
}

FLOW_TAGS = {"sequenceFlow"}


def _local(tag: str) -> str:
    """Strip XML namespace -> local tag name."""
    return tag.split("}")[-1] if "}" in tag else tag


def _load_xml_bytes(bpmn_input: Union[str, Path, bytes]) -> bytes:
    if isinstance(bpmn_input, Path):
        return bpmn_input.read_bytes()
    if isinstance(bpmn_input, bytes):
        return bpmn_input
    if isinstance(bpmn_input, str):
        p = Path(bpmn_input)
        return p.read_bytes() if p.exists() else bpmn_input.encode("utf-8")
    raise TypeError("bpmn_input must be a path, xml string, or bytes")


def _get_documentation(el: ET.Element) -> str:
    """Extract <documentation> text if present."""
    for child in el:
        if _local(child.tag) == "documentation":
            desc = (child.text or "").strip()
            if desc:
                return desc
    return ""


def _get_attr(el: ET.Element, key: str) -> str:
    return (el.attrib.get(key) or "").strip()


def extract_tasks(bpmn_input: Union[str, Path, bytes]) -> List[dict]:
    """
    Backward-compatible:
    Extract BPMN tasks as list[dict] [{id,name,description,type}, ...]
    """
    xml_bytes = _load_xml_bytes(bpmn_input)
    root = ET.fromstring(xml_bytes)

    tasks: List[BpmnTask] = []
    for el in root.iter():
        tag = _local(el.tag)
        if tag not in TASK_TAGS:
            continue

        task_id = _get_attr(el, "id")
        name = _get_attr(el, "name")
        desc = _get_documentation(el)

        if task_id:
            tasks.append(BpmnTask(id=task_id, name=name, description=desc, type=tag))

    return [asdict(t) for t in tasks]


def extract_bpmn_graph(bpmn_input: Union[str, Path, bytes]) -> Dict[str, object]:
    """
    New (Step 1):
    Extract a richer BPMN graph representation:
    {
      "process": {"id": "...", "name": "..."},
      "tasks": [...],
      "events": [...],
      "gateways": [...],
      "flows": [...]
    }
    """
    xml_bytes = _load_xml_bytes(bpmn_input)
    root = ET.fromstring(xml_bytes)

    process_id: str = ""
    process_name: str = ""

    tasks: List[Dict] = []
    events: List[Dict] = []
    gateways: List[Dict] = []
    flows: List[Dict] = []

    for el in root.iter():
        tag = _local(el.tag)

        # Process meta (first process encountered)
        if tag == "process" and not process_id:
            process_id = _get_attr(el, "id")
            process_name = _get_attr(el, "name")
            continue

        # Tasks
        if tag in TASK_TAGS:
            tid = _get_attr(el, "id")
            if not tid:
                continue
            tasks.append(
                asdict(
                    BpmnTask(
                        id=tid,
                        name=_get_attr(el, "name"),
                        description=_get_documentation(el),
                        type=tag,
                    )
                )
            )
            continue

        # Events
        if tag in EVENT_TAGS:
            nid = _get_attr(el, "id")
            if not nid:
                continue
            events.append(
                asdict(
                    BpmnNode(
                        id=nid,
                        name=_get_attr(el, "name"),
                        type=tag,
                    )
                )
            )
            continue

        # Gateways
        if tag in GATEWAY_TAGS:
            nid = _get_attr(el, "id")
            if not nid:
                continue
            gateways.append(
                asdict(
                    BpmnNode(
                        id=nid,
                        name=_get_attr(el, "name"),
                        type=tag,
                    )
                )
            )
            continue

        # Flows
        if tag in FLOW_TAGS:
            fid = _get_attr(el, "id")
            src = _get_attr(el, "sourceRef")
            tgt = _get_attr(el, "targetRef")
            if not fid or not src or not tgt:
                continue
            flows.append(
                asdict(
                    BpmnFlow(
                        id=fid,
                        name=_get_attr(el, "name"),
                        source=src,
                        target=tgt,
                        type=tag,
                    )
                )
            )
            continue

    return {
        "process": {"id": process_id, "name": process_name},
        "tasks": tasks,
        "events": events,
        "gateways": gateways,
        "flows": flows,
    }
