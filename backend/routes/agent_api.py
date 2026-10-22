"""
EpiText-Agent Flask API routes.
- GET  /api/agent/benchmark      : deterministic fixture simulation (explicitly labeled)
- POST /api/agent/benchmark/real : paired decision-stage benchmark using stored Swin + real MLM
- POST /api/agent/run            : run LangGraph restoration in 'real' or 'fixture' mode
- POST /api/agent/hitl/approve   : persist verified human approval for a real DB target
"""
import os
import sys
import logging
from datetime import datetime
from decimal import Decimal
from flask import Blueprint, request, jsonify

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from agent_core import run_epitext_agent, run_before_after_benchmark
from agent_core.real_benchmark import run_paired_real_benchmark
from agent_core.real_tools import RealModelUnavailable, normalized_lines, prepare_saved_predictions
from models import db, Rubbing, RestorationTarget, Candidate, InspectionRecord

logger = logging.getLogger(__name__)
agent_bp = Blueprint("agent_api", __name__)

SAMPLE_FIXTURE_LINES = [
    "高□洛□歸法寺住持",
    "見性寂炤首□玄應者",
    "立□第十五□肅宗□子",
    "□□歲下元己未二月十",
    "□日甲子薨卒二十一日",
    "壬申茶□以三月□五日",
    "乙酉□舍利□於八德□",
]


@agent_bp.route("/api/agent/benchmark", methods=["GET"])
def get_agent_benchmark():
    """Return the 14-mask simulation benchmark with an explicit simulation label."""
    try:
        result = run_before_after_benchmark()
        return jsonify({
            "success": True,
            "benchmark_mode": "fixture_simulation",
            "warning": "이 결과는 사전 정의된 후보/지연(time.sleep)을 사용하는 시뮬레이션이며 실모델 정확도나 지연시간 측정값이 아닙니다.",
            "benchmark": result,
        })
    except Exception as e:
        logger.error(f"[Agent Benchmark] 실행 오류: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@agent_bp.route("/api/agent/benchmark/real", methods=["POST"])
def run_real_agent_benchmark():
    """Compare original vs agent decision stage on a real uploaded rubbing."""
    data = request.get_json(silent=True) or {}
    rubbing_id = data.get("rubbing_id")
    repeats = int(data.get("repeats", 3))
    ground_truth = data.get("ground_truth_by_position")
    if not isinstance(rubbing_id, int):
        return jsonify({"success": False, "error": "integer rubbing_id is required"}), 400

    rubbing = db.session.get(Rubbing, rubbing_id)
    if not rubbing:
        return jsonify({"success": False, "error": f"Rubbing {rubbing_id} not found"}), 404

    try:
        real_inputs = prepare_saved_predictions(rubbing)
        report = run_paired_real_benchmark(
            rubbing_id=rubbing.id,
            title=rubbing.filename or f"rubbing-{rubbing.id}",
            real_inputs=real_inputs,
            ground_truth_by_position=ground_truth if isinstance(ground_truth, dict) else None,
            repeats=repeats,
        )
        return jsonify({"success": True, "benchmark": report})
    except (RealModelUnavailable, ValueError) as e:
        return jsonify({"success": False, "error": str(e)}), 422
    except Exception as e:
        logger.error(f"[Real Agent Benchmark] 실행 오류: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@agent_bp.route("/api/agent/run", methods=["POST"])
def execute_agent_restoration():
    """Run LangGraph restoration. Defaults to real mode when rubbing_id is provided."""
    data = request.get_json(silent=True) or {}
    rubbing_id = data.get("rubbing_id")
    mode = data.get("inference_mode") or ("real" if rubbing_id is not None and not data.get("text_lines") else "fixture")
    enable_ollama = bool(data.get("enable_ollama", False))

    if mode not in {"real", "fixture", "mock"}:
        return jsonify({"success": False, "error": "inference_mode must be 'real' or 'fixture'"}), 400

    if mode == "real":
        if not isinstance(rubbing_id, int):
            return jsonify({"success": False, "error": "real inference_mode requires integer rubbing_id"}), 400
        rubbing = db.session.get(Rubbing, rubbing_id)
        if not rubbing:
            return jsonify({"success": False, "error": f"Rubbing {rubbing_id} not found"}), 404
        try:
            real_inputs = prepare_saved_predictions(rubbing)
            state = run_epitext_agent(
                rubbing_id=rubbing.id,
                title=data.get("title") or rubbing.filename or f"rubbing-{rubbing.id}",
                text_lines=real_inputs["text_lines"],
                enable_ollama_commentary=enable_ollama,
                inference_mode="real",
                vision_candidates_by_position=real_inputs["vision_candidates_by_position"],
                damage_types_by_position=real_inputs["damage_types_by_position"],
                target_ids_by_position=real_inputs["target_ids_by_position"],
            )
            _sync_agent_candidates_to_db(rubbing.id, state["targets"])
            db.session.commit()
        except RealModelUnavailable as e:
            db.session.rollback()
            return jsonify({"success": False, "inference_mode": "real", "error": str(e)}), 422
        except Exception as e:
            db.session.rollback()
            logger.error(f"[Agent Run Real] 실패: {e}", exc_info=True)
            return jsonify({"success": False, "inference_mode": "real", "error": str(e)}), 500
    else:
        raw_lines = data.get("text_lines") or SAMPLE_FIXTURE_LINES
        if not isinstance(raw_lines, list) or not all(isinstance(line, str) for line in raw_lines):
            return jsonify({"success": False, "error": "text_lines must be a list of strings"}), 400
        text_lines = normalized_lines(raw_lines)
        state = run_epitext_agent(
            rubbing_id=int(rubbing_id or 0),
            title=data.get("title", "귀법사적소수좌현응묘지명 (simulation)"),
            text_lines=text_lines,
            enable_ollama_commentary=enable_ollama,
            inference_mode="fixture",
        )

    return jsonify({
        "success": True,
        "execution_mode": mode if mode == "real" else "mock",
        "inference_mode": "real" if mode == "real" else "fixture",
        "rubbing_id": state["rubbing_id"],
        "inferred_era": state["inferred_era"],
        "triage_route": state["triage_route"],
        "unmasked_count": state["unmasked_count"],
        "rag_rescued_count": state["rag_rescued_count"],
        "hitl_pending_orders": state["hitl_pending_orders"],
        "metrics": state["metrics"],
        "agent_logs": state["agent_logs"],
        "targets": state["targets"],
    })


def _sync_agent_candidates_to_db(rubbing_id: int, targets):
    db_targets = {
        (int(t.row_index), int(t.char_index)): t
        for t in RestorationTarget.query.filter_by(rubbing_id=rubbing_id).all()
        if t.row_index is not None and t.char_index is not None
    }
    for t_state in targets:
        key = (int(t_state["row_index"]), int(t_state["char_index"]))
        db_target = db_targets.get(key)
        if not db_target:
            raise RealModelUnavailable(f"DB target missing for position {key}")
        t_state["target_id"] = db_target.id
        Candidate.query.filter_by(target_id=db_target.id).delete()
        for cand in t_state["final_candidates"]:
            db.session.add(Candidate(
                target_id=db_target.id,
                character=cand["character"],
                stroke_match=Decimal(str(cand["stroke_match"])) if cand["stroke_match"] is not None else None,
                context_match=Decimal(str(cand["context_match"])) if cand["context_match"] is not None else None,
                rank_vision=cand["rank_vision"],
                rank_nlp=cand["rank_nlp"],
                model_type=cand["model_type"],
                reliability=Decimal(str(cand["reliability"])),
            ))


@agent_bp.route("/api/agent/hitl/approve", methods=["POST"])
def approve_hitl_target():
    """Persist human-in-the-loop approval. Never returns success unless DB commit succeeded."""
    data = request.get_json(silent=True) or {}
    rubbing_id = data.get("rubbing_id")
    target_id = data.get("target_id")
    selected_character = (data.get("selected_character") or "").strip()
    reviewer_note = data.get("reviewer_note", "사료 RAG 근거 확인 후 전문가 승인")

    if not isinstance(rubbing_id, int) or not isinstance(target_id, int):
        return jsonify({"success": False, "error": "integer rubbing_id and target_id are required"}), 400
    if not selected_character or len(selected_character) != 1:
        return jsonify({"success": False, "error": "single-character selected_character is required"}), 400

    target = RestorationTarget.query.filter_by(id=target_id, rubbing_id=rubbing_id).first()
    if not target:
        return jsonify({"success": False, "error": f"RestorationTarget {target_id} for rubbing {rubbing_id} not found"}), 404

    matched_candidate = Candidate.query.filter_by(
        target_id=target.id,
        character=selected_character,
    ).order_by(Candidate.reliability.desc()).first()
    reliability = float(matched_candidate.reliability) if matched_candidate and matched_candidate.reliability is not None else float(data.get("reliability", 0.0))

    try:
        rec = InspectionRecord.query.filter_by(rubbing_id=rubbing_id, target_id=target.id).first()
        if rec:
            rec.selected_character = selected_character
            rec.selected_candidate_id = matched_candidate.id if matched_candidate else None
            rec.reliability = Decimal(str(reliability))
            rec.inspected_at = datetime.utcnow()
        else:
            rec = InspectionRecord(
                rubbing_id=rubbing_id,
                target_id=target.id,
                selected_character=selected_character,
                selected_candidate_id=matched_candidate.id if matched_candidate else None,
                reliability=Decimal(str(reliability)),
                inspected_at=datetime.utcnow(),
            )
            db.session.add(rec)
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"[HITL Approve] DB 저장 실패: {e}", exc_info=True)
        return jsonify({"success": False, "error": "Failed to persist inspection record"}), 500

    return jsonify({
        "success": True,
        "message": f"'{selected_character}' 문자가 최종 복원 기록부에 승인 반영되었습니다.",
        "audit_record": {
            "id": rec.id,
            "rubbing_id": rubbing_id,
            "target_id": target.id,
            "selected_character": selected_character,
            "selected_candidate_id": rec.selected_candidate_id,
            "reliability": float(rec.reliability) if rec.reliability is not None else reliability,
            "reviewer_note": reviewer_note,
            "approved_at": rec.inspected_at.isoformat(),
        },
    })
