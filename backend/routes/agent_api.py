"""
EpiText-Agent 전용 Flask API 라우트
- GET  /api/agent/benchmark : 모의 워크플로우 비교 예시 조회
- POST /api/agent/run       : 특정 탁본 또는 입력 텍스트에 대해 LangGraph 에이전트 복원 실행
- POST /api/agent/hitl/approve : 검수 기록 API 초안 (대상 ID·저장 실패 처리 보완 필요)
"""
import os
import sys
import json
import logging
from datetime import datetime
from decimal import Decimal
from flask import Blueprint, request, jsonify

# 최상위 루트의 agent_core 임포트 경로 확보
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from agent_core import run_epitext_agent, run_before_after_benchmark
from models import db, Rubbing, RestorationTarget, Candidate, InspectionRecord

logger = logging.getLogger(__name__)

agent_bp = Blueprint("agent_api", __name__)


@agent_bp.route("/api/agent/benchmark", methods=["GET"])
def get_agent_benchmark():
    """
    모의 도구·예시 기준값의 비교를 반환합니다.
    실제 모델 정확도·추론 지연·검수 업무 감소의 측정 결과가 아닙니다.
    """
    try:
        result = run_before_after_benchmark()
        return jsonify({
            "success": True,
            "benchmark": result,
        })
    except Exception as e:
        logger.error(f"[Agent Benchmark] 실행 오류: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@agent_bp.route("/api/agent/run", methods=["POST"])
def execute_agent_restoration():
    """
    특정 rubbing_id 또는 직접 전달된 text_lines에 대해 LangGraph 에이전트를 실행합니다.
    rubbing_id가 전달되고 DB에 존재하면, 에이전트가 도출한 후보군과 신뢰도를 DB에 동기화합니다.
    """
    data = request.get_json(silent=True) or {}
    rubbing_id = data.get("rubbing_id", 1)
    title = data.get("title", "귀법사적소수좌현응묘지명")
    text_lines = data.get("text_lines")

    rubbing = None
    try:
        rubbing = Rubbing.query.get(rubbing_id)
    except Exception:
        rubbing = None

    if not text_lines and rubbing and rubbing.details:
        raw_content = rubbing.details[0].text_content
        if raw_content:
            try:
                text_lines = json.loads(raw_content) if raw_content.startswith("[") else raw_content.split("\n")
            except Exception:
                text_lines = raw_content.split("\n")

    if not text_lines:
        text_lines = [
            "高□洛□歸法寺住持",
            "見性寂炤首□玄應者",
            "立□第十五□肅宗□子",
            "□□歲下元己未二月十",
            "□日甲子薨卒二十一日",
            "壬申茶□以三月□五日",
            "乙酉□舍利□於八德□",
        ]

    enable_ollama = bool(data.get("enable_ollama", False))
    state = run_epitext_agent(
        rubbing_id=rubbing_id,
        title=title,
        text_lines=text_lines,
        enable_ollama_commentary=enable_ollama,
    )

    # DB가 초기화된 상태이고 해당 Rubbing이 존재하면 후보군 업데이트
    if rubbing:
        try:
            db_targets = RestorationTarget.query.filter_by(rubbing_id=rubbing.id).order_by(
                RestorationTarget.row_index, RestorationTarget.char_index
            ).all()

            for idx, t_state in enumerate(state["targets"]):
                if idx < len(db_targets):
                    db_t = db_targets[idx]
                    Candidate.query.filter_by(target_id=db_t.id).delete()
                    for cand in t_state["final_candidates"]:
                        c_obj = Candidate(
                            target_id=db_t.id,
                            character=cand["character"],
                            stroke_match=Decimal(str(cand["stroke_match"])) if cand["stroke_match"] is not None else None,
                            context_match=Decimal(str(cand["context_match"])) if cand["context_match"] is not None else None,
                            rank_vision=cand["rank_vision"],
                            rank_nlp=cand["rank_nlp"],
                            model_type=cand["model_type"],
                            reliability=Decimal(str(cand["reliability"])),
                        )
                        db.session.add(c_obj)
            db.session.commit()
        except Exception as db_err:
            db.session.rollback()
            logger.warning(f"[Agent Run] DB 후보 동기화 생략: {db_err}")

    return jsonify({
        "success": True,
        "execution_mode": "mock",
        "model_inference_executed": False,
        "result_status": "preview",
        "rubbing_id": rubbing_id,
        "inferred_era": state["inferred_era"],
        "triage_route": state["triage_route"],
        "unmasked_count": state["unmasked_count"],
        "rag_rescued_count": state["rag_rescued_count"],
        "hitl_pending_orders": state["hitl_pending_orders"],
        "metrics": state["metrics"],
        "agent_logs": state["agent_logs"],
        "targets": state["targets"],
    })


@agent_bp.route("/api/agent/hitl/approve", methods=["POST"])
def approve_hitl_target():
    """
    검수 기록 저장 API 초안입니다.
    대상 ID 검증·저장 실패 응답·화면 재조회는 보완 대상입니다.
    """
    data = request.get_json(silent=True) or {}
    rubbing_id = data.get("rubbing_id", 1)
    target_id = data.get("target_id")
    selected_character = data.get("selected_character")
    reliability = data.get("reliability", 95.0)
    reviewer_note = data.get("reviewer_note", "사료 RAG 근거 확인 후 전문가 승인")

    if not selected_character:
        return jsonify({"error": "selected_character is required"}), 400

    record_dict = {
        "rubbing_id": rubbing_id,
        "target_id": target_id,
        "selected_character": selected_character,
        "reliability": reliability,
        "reviewer_note": reviewer_note,
        "approved_at": datetime.utcnow().isoformat(),
    }

    try:
        if target_id is not None:
            rec = InspectionRecord(
                rubbing_id=rubbing_id,
                target_id=target_id,
                selected_character=selected_character,
                reliability=Decimal(str(reliability)),
                inspected_at=datetime.utcnow(),
            )
            db.session.add(rec)
            db.session.commit()
            record_dict["id"] = rec.id
    except Exception as e:
        db.session.rollback()
        logger.warning(f"[HITL Approve] DB 기록 생략(인메모리 응답 반환): {e}")

    return jsonify({
        "success": True,
        "message": f"'{selected_character}' 문자가 최종 복원 기록부에 승인 반영되었습니다.",
        "audit_record": record_dict,
    })
