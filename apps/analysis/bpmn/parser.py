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

EVENT_TAGS = {
    "startEvent",
    "endEvent",
    "intermediateCatchEvent",
    "intermediateThrowEvent",
    "boundaryEvent",
}

GATEWAY_TAGS = {
    "exclusiveGateway",
    "parallelGateway",
    "inclusiveGateway",
    "eventBasedGateway",
    "complexGateway",
}


COLLABORATION_TAGS = {
    "collaboration",
    "participant",
}

LANE_TAGS = {
    "laneSet",
    "lane",
}

DATA_TAGS = {
    "dataObject",
    "dataObjectReference",
    "dataStoreReference",
}

MESSAGE_FLOW_TAGS = {
    "messageFlow",
}

EVENT_DEFINITION_TAGS = {
    "messageEventDefinition",
    "timerEventDefinition",
    "errorEventDefinition",
    "signalEventDefinition",
    "conditionalEventDefinition",
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
    participants: List[Dict] = []
    lanes: List[Dict] = []
    data_objects: List[Dict] = []
    message_flows: List[Dict] = []
    event_definitions: List[Dict] = []

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


        if tag in COLLABORATION_TAGS:
            nid = _get_attr(el, "id")
            if not nid:
                continue

            item = {
                "id": nid,
                "name": _get_attr(el, "name"),
                "type": tag,
            }

            if tag == "participant":
                item["processRef"] = _get_attr(el, "processRef")

            participants.append(item)
            continue

        if tag in LANE_TAGS:
            nid = _get_attr(el, "id")
            if not nid:
                continue

            lanes.append({
                "id": nid,
                "name": _get_attr(el, "name"),
                "type": tag,
            })
            continue

        if tag in DATA_TAGS:
            nid = _get_attr(el, "id")
            if not nid:
                continue

            data_objects.append({
                "id": nid,
                "name": _get_attr(el, "name"),
                "type": tag,
                "dataObjectRef": _get_attr(el, "dataObjectRef"),
            })
            continue

        if tag in EVENT_DEFINITION_TAGS:
            nid = _get_attr(el, "id")
            if not nid:
                continue

            event_definitions.append({
                "id": nid,
                "type": tag,
            })
            continue

        if tag in MESSAGE_FLOW_TAGS:
            fid = _get_attr(el, "id")
            src = _get_attr(el, "sourceRef")
            tgt = _get_attr(el, "targetRef")

            if not fid or not src or not tgt:
                continue

            message_flows.append({
                "id": fid,
                "name": _get_attr(el, "name"),
                "source": src,
                "target": tgt,
                "type": tag,
            })
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
         "participants": participants,
        "lanes": lanes,
        "data_objects": data_objects,
        "message_flows": message_flows,
        "event_definitions": event_definitions,
    }

def extract_tasks_with_context(bpmn_input: Union[str, Path, bytes]) -> List[Dict]:
    """
    Extract tasks with full context:
    - task_id, name, description, task_type
    - incoming_nodes: names of nodes that come before
    - outgoing_nodes: names of nodes that come after
    """
    graph = extract_bpmn_graph(bpmn_input)

    flows = graph.get("flows") or []
    events = graph.get("events") or []
    gateways = graph.get("gateways") or []
    tasks = graph.get("tasks") or []

    # build id -> name map for all nodes
    node_names = {}
    for t in tasks:
        node_names[t["id"]] = t["name"]
    for e in events:
        node_names[e["id"]] = e["name"] or e["type"]
    for g in gateways:
        node_names[g["id"]] = g["name"] or g["type"]

    # build incoming/outgoing per task id
    task_incoming: Dict[str, List[str]] = {}
    task_outgoing: Dict[str, List[str]] = {}
    for f in flows:
        src, tgt = f["source"], f["target"]
        task_incoming.setdefault(tgt, []).append(node_names.get(src, src))
        task_outgoing.setdefault(src, []).append(node_names.get(tgt, tgt))

    result = []
    for t in tasks:
        tid = t["id"]
        result.append({
            "task_id": tid,
            "name": t["name"],
            "description": t["description"],
            "task_type": t["type"],
            "incoming_nodes": task_incoming.get(tid, []),
            "outgoing_nodes": task_outgoing.get(tid, []),
        })

    return result
