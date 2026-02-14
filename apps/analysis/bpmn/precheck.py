from __future__ import annotations

from dataclasses import dataclass
from typing import List, Set, Dict, Tuple
import xml.etree.ElementTree as ET
from collections import defaultdict, deque

from .parser import extract_bpmn_graph


@dataclass
class PrecheckResult:
    ok: bool
    errors: List[str]
    warnings: List[str]
    process_name: str
    task_count: int


def _local(tag: str) -> str:
    return tag.split("}")[-1] if "}" in tag else tag


def precheck_bpmn_xml(bpmn_bytes: bytes) -> PrecheckResult:
    errors: List[str] = []
    warnings: List[str] = []
    process_name: str = ""
    task_count: int = 0

    # -------------------------
    # 1) XML well-formed check
    # -------------------------
    try:
        root = ET.fromstring(bpmn_bytes)
    except Exception as e:
        return PrecheckResult(
            ok=False,
            errors=[f"Invalid XML: {e}"],
            warnings=[],
            process_name="",
            task_count=0,
        )

    # -------------------------
    # 2) Must contain a process
    # -------------------------
    has_process = False
    for el in root.iter():
        if _local(el.tag) == "process":
            has_process = True
            process_name = (el.attrib.get("name") or "").strip()
            break

    if not has_process:
        return PrecheckResult(
            ok=False,
            errors=["No <process> element found. This is not a valid BPMN process file."],
            warnings=[],
            process_name="",
            task_count=0,
        )

    # -------------------------
    # 3) Parse graph
    # -------------------------
    try:
        g = extract_bpmn_graph(bpmn_bytes)
    except Exception as e:
        return PrecheckResult(
            ok=False,
            errors=[f"Cannot parse BPMN graph: {e}"],
            warnings=[],
            process_name=process_name,
            task_count=0,
        )

    process_name = (g.get("process") or {}).get("name") or process_name or ""

    tasks = g.get("tasks") or []
    events = g.get("events") or []
    gateways = g.get("gateways") or []
    flows = g.get("flows") or []

    task_count = len(tasks)

    # -------------------------
    # 4) Must have tasks
    # -------------------------
    if task_count == 0:
        return PrecheckResult(
            ok=False,
            errors=["No BPMN tasks found (task/userTask/serviceTask/...)."],
            warnings=[],
            process_name=process_name,
            task_count=0,
        )

    # -------------------------
    # 5) Unique IDs (nodes)
    # -------------------------
    all_nodes = tasks + events + gateways
    node_ids_list = [str(n.get("id", "")).strip() for n in all_nodes if n.get("id")]
    node_ids: Set[str] = set(node_ids_list)

    if len(node_ids) != len(node_ids_list):
        # find duplicates (small list, count() is ok)
        dupes = sorted({i for i in node_ids_list if node_ids_list.count(i) > 1})
        return PrecheckResult(
            ok=False,
            errors=[f"Duplicate BPMN element IDs found: {', '.join(dupes[:10])}"],
            warnings=[],
            process_name=process_name,
            task_count=task_count,
        )

    # -------------------------
    # 6) Must have start/end events (warning by default)
    # -------------------------
    start_ids = [e["id"] for e in events if e.get("type") == "startEvent" and e.get("id")]
    end_ids = [e["id"] for e in events if e.get("type") == "endEvent" and e.get("id")]

    if not start_ids:
        warnings.append("No startEvent found (model may be incomplete).")
    if not end_ids:
        warnings.append("No endEvent found (model may be incomplete).")

    # -------------------------
    # 7) Validate flows:
    #    - must have source/target
    #    - refs must exist
    # -------------------------
    bad_flows: List[str] = []
    for f in flows:
        fid = str(f.get("id", "") or "").strip() or "[no-id]"
        src = str(f.get("source", "") or "").strip()
        tgt = str(f.get("target", "") or "").strip()

        if not src or not tgt:
            bad_flows.append(f"{fid} (missing sourceRef/targetRef)")
            continue

        if src not in node_ids or tgt not in node_ids:
            bad_flows.append(f"{fid} (invalid ref {src} -> {tgt})")

    if bad_flows:
        return PrecheckResult(
            ok=False,
            errors=["Invalid sequenceFlow references: " + "; ".join(bad_flows[:10])],
            warnings=warnings,
            process_name=process_name,
            task_count=task_count,
        )

    # -------------------------
    # 8) Build adjacency graph from flows
    # -------------------------
    out_edges: Dict[str, List[str]] = defaultdict(list)
    in_deg: Dict[str, int] = defaultdict(int)

    for f in flows:
        src = str(f.get("source", "")).strip()
        tgt = str(f.get("target", "")).strip()
        out_edges[src].append(tgt)
        in_deg[tgt] += 1
        # ensure keys exist
        out_edges.setdefault(tgt, out_edges.get(tgt, []))

    # -------------------------
    # 9) Orphan node detection (warnings)
    # Orphan = node not appearing in any flow
    # -------------------------
    used = set()
    for f in flows:
        used.add(str(f.get("source", "")).strip())
        used.add(str(f.get("target", "")).strip())

    orphan_tasks = []
    for t in tasks:
        tid = str(t.get("id", "")).strip()
        if tid and tid not in used:
            orphan_tasks.append(tid)

    if orphan_tasks:
        warnings.append(f"{len(orphan_tasks)} orphan task(s) not connected by any sequenceFlow.")

    # -------------------------
    # 10) Reachability check (Start -> others)
    # If no start event, we can pick a fallback "entry" nodes:
    # nodes with in-degree 0 (but still warn)
    # -------------------------
    if start_ids:
        entry_nodes = start_ids
    else:
        # fallback: nodes with in-degree 0
        entry_nodes = [nid for nid in node_ids if in_deg.get(nid, 0) == 0]
        if not entry_nodes:
            warnings.append("Could not find an entry node (no startEvent and no in-degree-0 nodes).")

    reachable: Set[str] = set()
    q = deque(entry_nodes)
    while q:
        cur = q.popleft()
        if cur in reachable:
            continue
        reachable.add(cur)
        for nxt in out_edges.get(cur, []):
            if nxt not in reachable:
                q.append(nxt)

    # unreachable tasks warning
    unreachable_tasks = []
    for t in tasks:
        tid = str(t.get("id", "")).strip()
        if tid and tid not in reachable:
            unreachable_tasks.append(tid)

    if unreachable_tasks:
        warnings.append(f"{len(unreachable_tasks)} task(s) are unreachable from the start/entry node.")

    # end reachability warning (if end exists)
    if end_ids and not any(eid in reachable for eid in end_ids):
        warnings.append("No endEvent is reachable from the start/entry node (disconnected flow).")

    # -------------------------
    # 11) Gateway sanity (warnings)
    # - Exclusive/Parallel gateways should usually have >=2 outgoing (not always, but a good warning)
    # -------------------------
    for gw in gateways:
        gid = str(gw.get("id", "")).strip()
        gtype = str(gw.get("type", "")).strip()
        out_count = len(out_edges.get(gid, []))
        if gtype in {"exclusiveGateway", "parallelGateway", "inclusiveGateway"} and out_count == 0:
            warnings.append(f"Gateway {gid} ({gtype}) has no outgoing sequenceFlow.")
        if gtype in {"exclusiveGateway", "parallelGateway", "inclusiveGateway"} and out_count == 1:
            warnings.append(f"Gateway {gid} ({gtype}) has only 1 outgoing flow (might be unnecessary).")

    # -------------------------
    # DONE
    # -------------------------
    return PrecheckResult(
        ok=True,
        errors=[],
        warnings=warnings,
        process_name=process_name,
        task_count=task_count,
    )