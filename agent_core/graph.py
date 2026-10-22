"""
EpiText-Agent LangGraph 조립 및 모의 워크플로우 비교 모듈 (SKALA Wave 1~15 아키텍처 패턴 통합).
- functools.partial을 통한 SupervisorDeps 의존성 주입 (Wave 13)
- SUPERVISOR_VERSION (v1 legacy / v2 agent) 무중단 버전 토글 (Wave 14)
- LangSmith @traceable 계층 트리 추적 및 Retry 지표 계측 (Wave 9)
"""
import os
import time
from functools import partial
from typing import List, Dict, Any, Optional
from langgraph.graph import StateGraph, END

try:
    from langsmith import traceable
except ImportError:
    def traceable(*args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

from .state import RubbingAgentState
from .deps import SupervisorDeps, build_supervisor_deps
from .retry import GLOBAL_RETRY_METRICS
from .nodes import (
    triage_node,
    vision_unmask_node,
    context_mlm_node,
    conflict_rag_arbitration_node,
    hitl_gate_node,
    _calc_f1,
)
from .tools import detect_era_from_text, vision_swin_tool, context_mlm_tool


def _route_after_triage(state: RubbingAgentState) -> str:
    route = state.get("triage_route", "vision_first_loop")
    if route == "fast_pass":
        return END
    if route == "mlm_only":
        return "context_mlm"
    return "vision_unmask"


def build_epitext_agent_graph(deps: Optional[SupervisorDeps] = None):
    """SupervisorDeps를 각 노드에 partial로 주입하여 LangGraph StateGraph를 컴파일합니다."""
    active_deps = deps or build_supervisor_deps()
    workflow = StateGraph(RubbingAgentState)

    workflow.add_node("triage", partial(triage_node, deps=active_deps))
    workflow.add_node("vision_unmask", partial(vision_unmask_node, deps=active_deps))
    workflow.add_node("context_mlm", partial(context_mlm_node, deps=active_deps))
    workflow.add_node("conflict_rag", partial(conflict_rag_arbitration_node, deps=active_deps))
    workflow.add_node("hitl_gate", partial(hitl_gate_node, deps=active_deps))

    workflow.set_entry_point("triage")

    workflow.add_conditional_edges(
        "triage",
        _route_after_triage,
        {
            "vision_unmask": "vision_unmask",
            "context_mlm": "context_mlm",
            END: END,
        },
    )

    workflow.add_edge("vision_unmask", "context_mlm")
    workflow.add_edge("context_mlm", "conflict_rag")
    workflow.add_edge("conflict_rag", "hitl_gate")
    workflow.add_edge("hitl_gate", END)

    return workflow.compile()


@traceable(run_type="chain", name="epitext.run_epitext_agent")
def run_epitext_agent(
    rubbing_id: int,
    title: str,
    text_lines: List[str],
    swin_image_path: Optional[str] = None,
    enable_ollama_commentary: bool = False,
    deps: Optional[SupervisorDeps] = None,
) -> RubbingAgentState:
    """
    EpiText-Agent를 실행하고 최종 상태를 반환합니다.
    SUPERVISOR_VERSION=v1 설정 시 재배포 없이 Legacy 선형 파이프라인(v1)으로 전환됩니다.
    """
    active_deps = deps or build_supervisor_deps()
    version = active_deps.version or os.getenv("SUPERVISOR_VERSION", "v2")

    if version.lower() == "v1":
        legacy_res = run_legacy_pipeline(text_lines)
        era = detect_era_from_text(text_lines)
        return {
            "rubbing_id": rubbing_id,
            "title": title,
            "inferred_era": era,
            "text_lines": text_lines,
            "swin_image_path": swin_image_path,
            "ocr_results": [],
            "targets": legacy_res["targets"],
            "triage_route": "legacy_v1_linear",
            "unmasked_count": 0,
            "rag_rescued_count": 0,
            "hitl_pending_orders": [t["order"] for t in legacy_res["targets"]],
            "agent_logs": [
                f"[SupervisorV1] SUPERVISOR_VERSION=v1 감지 -> Legacy 선형 파이프라인 실행 ({legacy_res['total_elapsed_ms']}ms)"
            ],
            "enable_ollama_commentary": False,
            "metrics": {
                "total_elapsed_ms": legacy_res["total_elapsed_ms"],
                "supervisor_version": "v1",
                "llm_backend": active_deps.llm_backend,
                "hitl_required_count": len(legacy_res["targets"]),
            },
        }

    t_start = time.perf_counter()
    GLOBAL_RETRY_METRICS.reset()
    app = build_epitext_agent_graph(deps=active_deps)

    initial_state: RubbingAgentState = {
        "rubbing_id": rubbing_id,
        "title": title,
        "inferred_era": "미정",
        "text_lines": text_lines,
        "swin_image_path": swin_image_path,
        "ocr_results": [],
        "targets": [],
        "triage_route": "",
        "unmasked_count": 0,
        "rag_rescued_count": 0,
        "hitl_pending_orders": [],
        "agent_logs": [],
        "enable_ollama_commentary": enable_ollama_commentary,
        "metrics": {},
    }

    final_state = app.invoke(initial_state)
    total_ms = round((time.perf_counter() - t_start) * 1000, 2)
    final_state["metrics"]["total_elapsed_ms"] = total_ms
    final_state["metrics"]["supervisor_version"] = active_deps.version
    final_state["metrics"]["llm_backend"] = active_deps.llm_backend
    final_state["metrics"]["retry_stats"] = GLOBAL_RETRY_METRICS.to_dict()
    return final_state


@traceable(run_type="chain", name="epitext.run_legacy_pipeline")
def run_legacy_pipeline(text_lines: List[str]) -> Dict[str, Any]:
    """
    [모의 Before / Supervisor v1] 비교 흐름을 설명하는 단순화된 예시입니다:
    1. 모든 글자/행에 대해 무조건 직렬 블로킹 실행 (구두점 + MLM 1회 실행 -> Swin 전체 실행)
    2. Unmasking 없이 빈칸('□□') 그대로 MLM 추론
    3. combine_mlm_and_swin()에서 교집합이 없으면 Swin 결과를 폐기하고 NLP 결과만 채택
    """
    t_start = time.perf_counter()
    legacy_targets = []
    order_seq = 1

    total_chars = sum(len(line.replace("，", "").replace("。", "").strip()) for line in text_lines)
    time.sleep(total_chars * 0.008)

    for r_idx, line in enumerate(text_lines):
        clean_line = line.replace("，", "").replace("。", "").strip()
        for c_idx, ch in enumerate(clean_line):
            if ch == "□":
                mlm_preds = context_mlm_tool(clean_line, c_idx)
                time.sleep(0.018)
                swin_preds = vision_swin_tool(clean_line, c_idx, "MASK2")

                mlm_map = {p["token"]: round(p["probability"] * 100, 1) for p in mlm_preds}
                swin_map = {p["token"]: round(p["probability"] * 100, 1) for p in swin_preds}
                intersection = set(mlm_map.keys()) & set(swin_map.keys())

                candidates = []
                for token in intersection:
                    rel = _calc_f1(swin_map[token], mlm_map[token])
                    candidates.append({"character": token, "reliability": rel, "model_type": "both"})
                for token, c_score in mlm_map.items():
                    if token not in intersection:
                        candidates.append({"character": token, "reliability": c_score, "model_type": "nlp"})

                candidates.sort(key=lambda x: x["reliability"], reverse=True)
                top1_char = candidates[0]["character"] if candidates else None
                top1_rel = candidates[0]["reliability"] if candidates else 0.0

                legacy_targets.append({
                    "order": order_seq,
                    "row_index": r_idx,
                    "char_index": c_idx,
                    "position": f"{r_idx + 1}행 {c_idx + 1}자",
                    "mask_type": "MASK2",
                    "surrounding_line": clean_line,
                    "unmasked_line": clean_line,
                    "final_candidates": candidates[:5],
                    "top1_char": top1_char,
                    "top1_reliability": top1_rel,
                    "hitl_required": True,
                    "hitl_reason": "Legacy v1 전수 수동 검수 대상",
                })
                order_seq += 1

    total_ms = round((time.perf_counter() - t_start) * 1000, 2)
    return {
        "total_elapsed_ms": total_ms,
        "targets": legacy_targets,
        "manual_review_count": len(legacy_targets),
    }


@traceable(run_type="chain", name="epitext.run_before_after_benchmark")
def run_before_after_benchmark() -> Dict[str, Any]:
    """
    동일 입력(귀법사적소수좌현응묘지명 7행 47자, 결락 14자)에 대해
    Legacy v1 파이프라인과 Agent v2 파이프라인을 실행하여 지연 시간, 정확도, Retry 복구, 비용을 비교합니다.
    """
    sample_lines = [
        "高□洛□歸法寺住持",
        "見性寂炤首□玄應者",
        "立□第十五□肅宗□子",
        "□□歲下元己未二月十",
        "□日甲子薨卒二十一日",
        "壬申茶□以三月□五日",
        "乙酉□舍利□於八德□",
    ]
    ground_truth = [
        "麗",  # 1: 高[麗]
        "西",  # 2: 洛[西]歸法寺
        "座",  # 3: 首[座]玄應者
        "朝",  # 4: 立[朝]
        "王",  # 5: 第十五[王]
        "長",  # 6: 肅宗[長]子
        "乾",  # 7: [乾]統歲 (연속 손상 앞글자)
        "統",  # 8: 乾[統]歲 (연속 손상 뒷글자)
        "六",  # 9: 十[六]日甲子
        "毗",  # 10: 茶[毗]
        "十",  # 11: 三月[十]五日
        "安",  # 12: 乙酉[安]舍利
        "塔",  # 13: 舍利[塔]
        "山",  # 14: 八德[山]
    ]

    before_res = run_legacy_pipeline(sample_lines)
    # Wave 9 Retry 검증을 위해 최초 1회 MCP 일시적 타임아웃 시뮬레이션 활성화
    bench_deps = build_supervisor_deps(version="v2", flaky_mcp=True)
    after_state = run_epitext_agent(
        rubbing_id=1,
        title="귀법사적소수좌현응묘지명",
        text_lines=sample_lines,
        deps=bench_deps,
    )

    comparison_rows = []
    before_correct = 0
    after_correct = 0

    for idx, gt_char in enumerate(ground_truth):
        b_item = before_res["targets"][idx]
        a_item = after_state["targets"][idx]

        b_ok = b_item["top1_char"] == gt_char
        a_ok = a_item["top1_char"] == gt_char
        if b_ok:
            before_correct += 1
        if a_ok:
            after_correct += 1

        comparison_rows.append({
            "order": idx + 1,
            "position": a_item["position"],
            "line": a_item["surrounding_line"],
            "ground_truth": gt_char,
            "before_char": b_item["top1_char"],
            "before_reliability": b_item["top1_reliability"],
            "before_correct": b_ok,
            "after_char": a_item["top1_char"],
            "after_reliability": a_item["top1_reliability"],
            "after_correct": a_ok,
            "unmasked_applied": a_item["surrounding_line"] != a_item["unmasked_line"],
            "rag_rescued": a_item["conflict_detected"] and a_item["rag_evidence"] is not None,
            "hitl_required": a_item["hitl_required"],
            "hitl_reason": a_item["hitl_reason"],
        })

    total_cnt = len(ground_truth)
    before_acc = round((before_correct / total_cnt) * 100, 1)
    after_acc = round((after_correct / total_cnt) * 100, 1)
    before_ms = before_res["total_elapsed_ms"]
    after_ms = after_state["metrics"]["total_elapsed_ms"]
    speedup_pct = round(((before_ms - after_ms) / before_ms) * 100, 1) if before_ms > 0 else 0.0
    retry_stats = after_state["metrics"].get("retry_stats", {"total_retries": 0, "recovered_calls": 0})

    return {
        "execution_mode": "mock",
        "model_inference_executed": False,
        "performance_claims_validated": False,
        "metric_interpretation": "Fixture comparison only; not historical accuracy or model latency.",
        "summary": {
            "total_damaged_chars": total_cnt,
            "before_accuracy_pct": before_acc,
            "after_accuracy_pct": after_acc,
            "accuracy_gain_pct_p": round(after_acc - before_acc, 1),
            "before_elapsed_ms": before_ms,
            "after_elapsed_ms": after_ms,
            "latency_reduction_pct": speedup_pct,
            "unmasked_step1_count": after_state["unmasked_count"],
            "rag_rescued_count": after_state["rag_rescued_count"],
            "before_manual_review_count": total_cnt,
            "after_hitl_review_count": len(after_state["hitl_pending_orders"]),
            "review_workload_reduction_pct": round(
                ((total_cnt - len(after_state["hitl_pending_orders"])) / total_cnt) * 100, 1
            ),
            "before_cloud_api_cost_usd": 0.015,
            "after_local_ollama_cost_usd": 0.0,
            "mcp_transient_retries": retry_stats.get("total_retries", 0),
            "mcp_recovered_calls": retry_stats.get("recovered_calls", 0),
        },
        "character_comparisons": comparison_rows,
        "agent_logs": after_state["agent_logs"],
    }
