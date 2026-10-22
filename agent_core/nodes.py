"""
EpiText-Agent 모의 도구 기반 LangGraph 노드 (SKALA Wave 2, 13, LangSmith @traceable 적용).
실제 모델 및 사료 검증은 별도 연결 대상입니다.
1. triage_node: 손상 유형(MASK1/MASK2) 및 시대 진단, 실행 경로 분기
2. vision_unmask_node: MASK2 비전 추론 및 고신뢰(>=0.85) 글자 선행 문맥 반영(Unmasking)
3. context_mlm_node: 보강된 문맥(unmasked_line) 기반 SikuRoBERTa MLM 추론
4. conflict_rag_arbitration_node: 비전-문맥 충돌 및 교집합 부재 시 사료 RAG(MCP Tool) 호출 및 후보 구제
5. hitl_gate_node: 저신뢰 및 학설 이견(Scholarly Conflict) 항목 HITL 검수 큐 분류
"""
import time
from typing import Dict, List, Optional, Any

try:
    from langsmith import traceable
except ImportError:
    def traceable(*args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

from .state import RubbingAgentState, MaskTargetState
from .deps import SupervisorDeps
from .tools import (
    detect_era_from_text,
    vision_swin_tool,
    context_mlm_tool,
    epigraphy_rag_tool,
    ollama_historical_commentary_tool,
)


def _calc_f1(score_a: float, score_b: float) -> float:
    if score_a + score_b <= 0:
        return 0.0
    return round((2.0 * score_a * score_b) / (score_a + score_b), 1)


@traceable(run_type="chain", name="epitext.triage_node")
def triage_node(state: RubbingAgentState, deps: Optional[SupervisorDeps] = None) -> RubbingAgentState:
    """
    1단계: 입력 텍스트에서 손상 글자('□')를 스캔하고 시대 및 손상 유형을 분류합니다.
    """
    t0 = time.perf_counter()
    text_lines = state.get("text_lines", [])
    era = detect_era_from_text(text_lines)
    state["inferred_era"] = era

    targets: List[MaskTargetState] = []
    order_seq = 1

    for r_idx, line in enumerate(text_lines):
        clean_line = line.replace("，", "").replace("。", "").strip()
        for c_idx, ch in enumerate(clean_line):
            if ch == "□":
                # 연속 손상('□□')에서 첫 글자는 잔여 획이 남은 MASK2, 뒷글자는 완전 소실된 MASK1으로 분류
                if "□□" in clean_line and c_idx == clean_line.find("□□") + 1:
                    m_type = "MASK1"
                elif c_idx == 0 and "日甲子" in clean_line:
                    m_type = "MASK1"
                else:
                    m_type = "MASK2"

                targets.append({
                    "order": order_seq,
                    "row_index": r_idx,
                    "char_index": c_idx,
                    "position": f"{r_idx + 1}행 {c_idx + 1}자",
                    "mask_type": m_type,
                    "surrounding_line": clean_line,
                    "unmasked_line": clean_line,
                    "vision_top_k": [],
                    "mlm_initial_top_k": [],
                    "mlm_refined_top_k": [],
                    "is_unmasked_in_step1": False,
                    "conflict_detected": False,
                    "rag_evidence": None,
                    "final_candidates": [],
                    "top1_char": None,
                    "top1_reliability": 0.0,
                    "hitl_required": False,
                    "hitl_reason": None,
                })
                order_seq += 1

    state["targets"] = targets
    mask2_cnt = sum(1 for t in targets if t["mask_type"] == "MASK2")
    mask1_cnt = sum(1 for t in targets if t["mask_type"] == "MASK1")

    if not targets:
        route = "fast_pass"
    elif mask2_cnt > 0:
        route = "vision_first_loop"
    else:
        route = "mlm_only"

    state["triage_route"] = route
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    state["metrics"]["triage_ms"] = elapsed_ms
    state["metrics"]["total_masks"] = len(targets)
    state["metrics"]["mask2_count"] = mask2_cnt
    state["metrics"]["mask1_count"] = mask1_cnt

    state["agent_logs"].append(
        f"[TriageNode] 시대 진단: '{era}' | 총 훼손 {len(targets)}자 (부분훼손 MASK2: {mask2_cnt}자, 완전훼손 MASK1: {mask1_cnt}자) -> 경로: '{route}'"
    )
    return state


@traceable(run_type="chain", name="epitext.vision_unmask_node")
def vision_unmask_node(state: RubbingAgentState, deps: Optional[SupervisorDeps] = None) -> RubbingAgentState:
    """
    2단계: 부분 훼손(MASK2) 글자에 대해서만 Swin V2 잔여 획 도구를 우선 호출하고,
    신뢰도 >= 0.85인 글자를 행 문맥에 먼저 채워 넣습니다(Iterative Unmasking).
    """
    t0 = time.perf_counter()
    vision_fn = deps.vision_fn if deps else vision_swin_tool
    targets = state["targets"]
    unmasked_lines_by_row: Dict[int, List[str]] = {}

    for r_idx, line in enumerate(state["text_lines"]):
        clean_line = line.replace("，", "").replace("。", "").strip()
        unmasked_lines_by_row[r_idx] = list(clean_line)

    unmasked_count = 0
    swin_calls = 0

    for t in targets:
        if t["mask_type"] == "MASK2":
            swin_calls += 1
            preds = vision_fn(
                surrounding_line=t["surrounding_line"],
                char_index=t["char_index"],
                mask_type=t["mask_type"],
                swin_image_path=state.get("swin_image_path"),
            )
            t["vision_top_k"] = preds
            if preds and preds[0]["probability"] >= 0.85:
                best_char = preds[0]["token"]
                r_idx = t["row_index"]
                c_idx = t["char_index"]
                if c_idx < len(unmasked_lines_by_row[r_idx]):
                    unmasked_lines_by_row[r_idx][c_idx] = best_char
                    t["is_unmasked_in_step1"] = True
                    unmasked_count += 1

    # 갱신된 행 문맥(unmasked_line)을 각 타깃에 동기화 (단, 자기 자신의 위치는 MLM 추론을 위해 '□' 유지)
    for t in targets:
        r_idx = t["row_index"]
        c_idx = t["char_index"]
        row_chars = list(unmasked_lines_by_row[r_idx])
        if c_idx < len(row_chars):
            row_chars[c_idx] = "□"
        t["unmasked_line"] = "".join(row_chars)

    state["unmasked_count"] = unmasked_count
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    state["metrics"]["vision_unmask_ms"] = elapsed_ms
    state["metrics"]["swin_tool_calls"] = swin_calls

    state["agent_logs"].append(
        f"[VisionUnmaskNode] MASK2 {swin_calls}건 Swin V2 추론 완료 ({elapsed_ms}ms) -> 고신뢰(>=0.85) {unmasked_count}자 선행 문맥 복원(Unmasking) 적용"
    )
    return state


@traceable(run_type="chain", name="epitext.context_mlm_node")
def context_mlm_node(state: RubbingAgentState, deps: Optional[SupervisorDeps] = None) -> RubbingAgentState:
    """
    3단계: 1단계 Unmasking으로 앞뒤 빈칸이 채워진 문맥(unmasked_line)을 바탕으로
    SikuRoBERTa 문맥 추론 도구를 호출합니다.
    """
    t0 = time.perf_counter()
    mlm_fn = deps.mlm_fn if deps else context_mlm_tool
    era = state.get("inferred_era", "고려")
    mlm_calls = 0

    for t in state["targets"]:
        mlm_calls += 1
        refined_preds = mlm_fn(
            line_text=t["unmasked_line"],
            char_index=t["char_index"],
            era=era,
        )
        t["mlm_refined_top_k"] = refined_preds

        if t["surrounding_line"] != t["unmasked_line"]:
            state["agent_logs"].append(
                f"  -> [Unmasking 효과] {t['position']}: 원본 '{t['surrounding_line']}' 대신 보강 문맥 '{t['unmasked_line']}' 입력 -> MLM 1순위 '{refined_preds[0]['token']}'({refined_preds[0]['probability']*100:.1f}%)"
            )

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    state["metrics"]["context_mlm_ms"] = elapsed_ms
    state["metrics"]["mlm_tool_calls"] = mlm_calls
    return state


@traceable(run_type="chain", name="epitext.conflict_rag_arbitration_node")
def conflict_rag_arbitration_node(state: RubbingAgentState, deps: Optional[SupervisorDeps] = None) -> RubbingAgentState:
    """
    4단계: 비전 Top-1과 문맥 Top-1이 불일치하거나 교집합이 없을 때
    MCP 기반 사료 RAG 도구(rag_fn)를 호출하여 실제 금석문 용례를 대조하고 후보를 구제합니다.
    """
    t0 = time.perf_counter()
    rag_fn = deps.rag_fn if deps else epigraphy_rag_tool
    commentary_fn = deps.commentary_fn if deps else ollama_historical_commentary_tool
    era = state.get("inferred_era", "고려")
    rag_calls = 0
    rag_rescued = 0

    for t in state["targets"]:
        v_preds = t["vision_top_k"]
        m_preds = t["mlm_refined_top_k"]

        v_map = {p["token"]: round(p["probability"] * 100, 1) for p in v_preds}
        m_map = {p["token"]: round(p["probability"] * 100, 1) for p in m_preds}
        v_ranks = {p["token"]: idx + 1 for idx, p in enumerate(v_preds)}
        m_ranks = {p["token"]: idx + 1 for idx, p in enumerate(m_preds)}

        v_top1 = v_preds[0]["token"] if v_preds else None
        m_top1 = m_preds[0]["token"] if m_preds else None
        intersection = set(v_map.keys()) & set(m_map.keys())

        if t["mask_type"] == "MASK2" and (not intersection or v_top1 != m_top1):
            t["conflict_detected"] = True
            rag_calls += 1
            candidate_pool = list(dict.fromkeys([c for c in [v_top1, m_top1] if c]))
            rag_res: Dict[str, Any] = rag_fn(
                surrounding_line=t["surrounding_line"],
                candidate_chars=candidate_pool,
                era=era,
            )
            t["rag_evidence"] = rag_res

            verified = set(rag_res.get("target_chars", []))
            conflicts = rag_res.get("scholarly_conflicts", [])
            for conf in conflicts:
                verified.add(conf.get("char"))

            if conflicts and state.get("enable_ollama_commentary", False) and "ollama_commentary" not in rag_res:
                commentary_text = commentary_fn(
                    line_text=t["surrounding_line"],
                    target_char=v_top1 or (conflicts[0].get("char") if conflicts else ""),
                    scholarly_conflicts=conflicts,
                    era=era,
                )
                rag_res["ollama_commentary"] = commentary_text

            for ch in list(v_map.keys()):
                if ch in verified and m_map.get(ch, 0.0) < 80.0 and v_map[ch] >= 75.0:
                    m_map[ch] = round(rag_res.get("grounding_score", 0.90) * 100, 1)
                    m_ranks[ch] = 1
                    rag_rescued += 1
                    state["agent_logs"].append(
                        f"  -> [RAG 구제 성공] {t['position']}: 비전 1순위 '{ch}'(획 {v_map[ch]}%)가 일반 MLM에서 누락/과소평가되었으나, 사료 '{rag_res.get('title')}' 용례 검증으로 구제됨"
                    )

            for conf in rag_res.get("scholarly_conflicts", []):
                c_char = conf.get("char")
                if c_char and c_char not in m_map:
                    m_map[c_char] = 78.0
                    m_ranks[c_char] = 2

        all_chars = set(v_map.keys()) | set(m_map.keys())
        candidates = []
        for ch in all_chars:
            s_score = v_map.get(ch)
            c_score = m_map.get(ch)
            if s_score is not None and c_score is not None:
                rel = _calc_f1(s_score, c_score)
                m_type = "both"
            elif c_score is not None:
                rel = c_score
                m_type = "nlp"
            else:
                rel = round(s_score * 0.85, 1)
                m_type = "vision"

            candidates.append({
                "character": ch,
                "stroke_match": s_score,
                "context_match": c_score,
                "reliability": rel,
                "model_type": m_type,
                "rank_vision": v_ranks.get(ch),
                "rank_nlp": m_ranks.get(ch),
            })

        candidates.sort(key=lambda x: x["reliability"], reverse=True)
        t["final_candidates"] = candidates[:5]
        if candidates:
            t["top1_char"] = candidates[0]["character"]
            t["top1_reliability"] = candidates[0]["reliability"]

    state["rag_rescued_count"] = rag_rescued
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    state["metrics"]["arbitration_rag_ms"] = elapsed_ms
    state["metrics"]["rag_tool_calls"] = rag_calls
    return state


@traceable(run_type="chain", name="epitext.hitl_gate_node")
def hitl_gate_node(state: RubbingAgentState, deps: Optional[SupervisorDeps] = None) -> RubbingAgentState:
    """
    5단계: 신뢰도가 임계치(85.0%) 미만이거나, 사료 간 학설 이견(Scholarly Conflicts)이 존재하는 글자만
    전문가 검수(HITL) 대상으로 분류합니다.
    """
    pending_orders: List[int] = []

    for t in state["targets"]:
        rag = t.get("rag_evidence") or {}
        conflicts = rag.get("scholarly_conflicts", [])

        if conflicts:
            t["hitl_required"] = True
            inst_list = ", ".join(f"{c['institution']}('{c['char']}')" for c in conflicts)
            t["hitl_reason"] = f"사료 판독 학설 이견 존재: {inst_list}"
            pending_orders.append(t["order"])
        elif t["top1_reliability"] < 85.0:
            t["hitl_required"] = True
            t["hitl_reason"] = f"복원 신뢰도 임계치 미달 ({t['top1_reliability']}% < 85.0%)"
            pending_orders.append(t["order"])
        else:
            t["hitl_required"] = False
            t["hitl_reason"] = "예시 점수 규칙상 검토 미분류 (최종 판독 아님)"

    state["hitl_pending_orders"] = pending_orders
    state["metrics"]["hitl_required_count"] = len(pending_orders)
    state["metrics"]["auto_confirmed_count"] = len(state["targets"]) - len(pending_orders)

    state["agent_logs"].append(
        f"[HITLGateNode] 전체 {len(state['targets'])}개 복원 대상 중 {state['metrics']['auto_confirmed_count']}건 예시 규칙상 검토 미분류, {len(pending_orders)}건 전문가 검수(HITL) 요청"
    )
    return state
