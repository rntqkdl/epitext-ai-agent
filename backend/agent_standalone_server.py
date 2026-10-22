"""
EpiText-Agent 실시간 시연용 API 서버 (:5001 / :8000)
- 프론트엔드(http://localhost:5173)와 1:1 연결됩니다.
- inference_mode='real' 요청 시 실제 Hugging Face SikuRoBERTa(jhangyejin/epitext-sikuroberta) 모델을 구동합니다.
- POST /api/agent/benchmark/real 요청 시 실제 모델 기반 Before/After 의사결정 지연시간 및 정확도를 비교합니다.
- HITL 승인 시 target_id 유효성 검증 및 영속 파일(data/hitl_audit_log.json) 저장/실패 처리를 수행합니다.
"""
import json
import os
import sys
from datetime import datetime
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.parse import urlparse

ROOT_DIR = Path(__file__).resolve().parent.parent
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from agent_core import (
    run_epitext_agent,
    run_before_after_benchmark,
    diagnose_and_reprocess_ocr_line,
    evaluate_reversible_hypothesis,
)
from agent_core.real_benchmark import run_paired_real_benchmark
from agent_core.real_tools import RealModelUnavailable
from agent_core.tools import vision_swin_tool
from agent_core.notion_real_suite import run_notion_real_comparison

AUDIT_LOG_PATH = ROOT_DIR / "data" / "hitl_audit_log.json"
NOTION_BENCH_PATH = ROOT_DIR / "data" / "notion_real_benchmark.json"
VALID_TARGET_IDS = set(range(1, 50))

DEFAULT_LINES = [
    "高□洛□歸法寺住持",
    "見性寂炤首□玄應者",
    "立□第十五□肅宗□子",
    "□□歲下元己未二月十",
    "□日甲子薨卒二十一日",
    "壬申茶□以三月□五日",
    "乙酉□舍利□於八德□",
]
DEFAULT_GT = ["麗", "西", "座", "朝", "王", "長", "乾", "統", "六", "毗", "十", "安", "塔", "山"]


def _build_real_inputs(text_lines: list, gt_list: list = None) -> tuple:
    vision_by_pos, damage_by_pos, target_ids_by_pos, gt_by_pos = {}, {}, {}, {}
    idx = 0
    for r_idx, line in enumerate(text_lines):
        for c_idx, ch in enumerate(line):
            if ch == "□":
                key = f"{r_idx}:{c_idx}"
                m_type = "MASK1" if (r_idx, c_idx) in {(2, 1), (3, 1), (4, 0)} else "MASK2"
                damage_by_pos[key] = m_type
                target_ids_by_pos[key] = idx + 1
                if gt_list and idx < len(gt_list):
                    gt_by_pos[key] = gt_list[idx]
                vision_by_pos[key] = vision_swin_tool(line, c_idx, m_type) if m_type == "MASK2" else []
                idx += 1
    return {
        "text_lines": text_lines,
        "vision_candidates_by_position": vision_by_pos,
        "damage_types_by_position": damage_by_pos,
        "target_ids_by_position": target_ids_by_pos,
    }, gt_by_pos


def _load_audit_records() -> list:
    if not AUDIT_LOG_PATH.exists():
        return []
    try:
        return json.loads(AUDIT_LOG_PATH.read_text(encoding="utf-8"))
    except Exception:
        return []


def _save_audit_record(record: dict) -> None:
    records = _load_audit_records()
    records.append(record)
    AUDIT_LOG_PATH.write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")


class EpiTextAgentRequestHandler(BaseHTTPRequestHandler):

    def _send_json(self, status_code: int, payload: dict) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self) -> None:
        self._send_json(200, {"ok": True})

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self._send_json(200, {
                "status": "healthy",
                "service": "epitext-agent-backend",
                "supervisor_version": os.getenv("SUPERVISOR_VERSION", "v2"),
                "llm_backend": os.getenv("LLM_BACKEND", "ollama"),
            })
            return

        if parsed.path == "/api/agent/benchmark":
            bench = run_before_after_benchmark()
            self._send_json(200, {
                "success": True,
                "benchmark_mode": "fixture_simulation",
                "benchmark": bench,
            })
            return

        if parsed.path == "/api/agent/hitl/records":
            self._send_json(200, {"success": True, "records": _load_audit_records()})
            return

        if parsed.path == "/api/agent/notion-benchmark":
            if NOTION_BENCH_PATH.exists():
                data = json.loads(NOTION_BENCH_PATH.read_text(encoding="utf-8"))
            else:
                data = run_notion_real_comparison()
                NOTION_BENCH_PATH.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
            self._send_json(200, {"success": True, "notion_benchmark": data})
            return

        self._send_json(404, {"success": False, "error": f"Not found: {parsed.path}"})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        content_len = int(self.headers.get("Content-Length", "0") or "0")
        raw_body = self.rfile.read(content_len).decode("utf-8") if content_len > 0 else "{}"
        try:
            data = json.loads(raw_body) if raw_body else {}
        except json.JSONDecodeError:
            self._send_json(400, {"success": False, "error": "Invalid JSON body"})
            return

        if parsed.path == "/api/agent/benchmark/real":
            rubbing_id = int(data.get("rubbing_id", 1))
            repeats = int(data.get("repeats", 3))
            text_lines = data.get("text_lines") or DEFAULT_LINES
            real_inputs, default_gt = _build_real_inputs(
                text_lines,
                DEFAULT_GT if text_lines == DEFAULT_LINES else None,
            )
            gt_by_pos = data.get("ground_truth_by_position") or default_gt
            try:
                report = run_paired_real_benchmark(
                    rubbing_id=rubbing_id,
                    title=data.get("title", "귀법사적소수좌현응묘지명"),
                    real_inputs=real_inputs,
                    ground_truth_by_position=gt_by_pos,
                    repeats=repeats,
                )
                self._send_json(200, {"success": True, "benchmark": report})
            except Exception as err:
                self._send_json(422, {"success": False, "error": str(err)})
            return

        if parsed.path == "/api/agent/run":
            rubbing_id = int(data.get("rubbing_id", 1))
            title = data.get("title", "귀법사적소수좌현응묘지명")
            text_lines = data.get("text_lines") or DEFAULT_LINES
            enable_ollama = bool(data.get("enable_ollama", False))
            mode = data.get("inference_mode") or "fixture"

            if mode == "real":
                try:
                    real_inputs, _ = _build_real_inputs(text_lines)
                    state = run_epitext_agent(
                        rubbing_id=rubbing_id,
                        title=title,
                        text_lines=real_inputs["text_lines"],
                        enable_ollama_commentary=enable_ollama,
                        inference_mode="real",
                        vision_candidates_by_position=real_inputs["vision_candidates_by_position"],
                        damage_types_by_position=real_inputs["damage_types_by_position"],
                        target_ids_by_position=real_inputs["target_ids_by_position"],
                    )
                except RealModelUnavailable as err:
                    self._send_json(422, {"success": False, "inference_mode": "real", "error": str(err)})
                    return
                except Exception as err:
                    self._send_json(500, {"success": False, "inference_mode": "real", "error": str(err)})
                    return
            else:
                state = run_epitext_agent(
                    rubbing_id=rubbing_id,
                    title=title,
                    text_lines=text_lines,
                    enable_ollama_commentary=enable_ollama,
                    inference_mode="fixture",
                )

            self._send_json(200, {
                "success": True,
                "execution_mode": "real" if mode == "real" else "mock",
                "inference_mode": "real" if mode == "real" else "fixture",
                "model_inference_executed": mode == "real",
                "result_status": "verified" if mode == "real" else "preview",
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
            return

        if parsed.path == "/api/agent/hitl/approve":
            target_id = data.get("target_id")
            selected_character = data.get("selected_character")
            if target_id is None or not isinstance(target_id, int) or target_id not in VALID_TARGET_IDS:
                self._send_json(400, {
                    "success": False,
                    "error": f"유효하지 않은 target_id입니다: {target_id}",
                })
                return
            if not selected_character:
                self._send_json(400, {"success": False, "error": "selected_character는 필수입니다."})
                return

            record = {
                "id": len(_load_audit_records()) + 1,
                "rubbing_id": data.get("rubbing_id", 1),
                "target_id": target_id,
                "selected_character": selected_character,
                "reliability": data.get("reliability", 95.0),
                "decision_type": data.get("decision_type", "approved"),
                "reviewer_note": data.get("reviewer_note", "사료 RAG 근거 확인 후 전문가 승인"),
                "approved_at": datetime.utcnow().isoformat(),
            }
            try:
                _save_audit_record(record)
            except Exception as err:
                self._send_json(500, {"success": False, "error": f"검수 기록 저장 실패: {err}"})
                return

            self._send_json(200, {
                "success": True,
                "message": f"'{selected_character}' 문자가 target_id={target_id} 복원 기록부에 영속 저장되었습니다.",
                "audit_record": record,
            })
            return

        if parsed.path == "/api/agent/diagnose-ocr":
            line_text = data.get("line_text", "□日由子薨卒二十一日")
            res = diagnose_and_reprocess_ocr_line(line_text)
            self._send_json(200, {"success": True, "diagnosis": res})
            return

        if parsed.path == "/api/agent/reversible-hypothesis":
            line_text = data.get("line_text", "□□歲下元己未二月十")
            cand_a = data.get("candidate_a", "天")
            cand_b = data.get("candidate_b", "乾")
            era = data.get("era", "고려")
            res = evaluate_reversible_hypothesis(line_text, cand_a, cand_b, era=era)
            self._send_json(200, {"success": True, "hypothesis_evaluation": res})
            return

        if parsed.path == "/api/agent/notion-benchmark/run":
            res = run_notion_real_comparison()
            NOTION_BENCH_PATH.write_text(json.dumps(res, ensure_ascii=False, indent=2), encoding="utf-8")
            self._send_json(200, {"success": True, "notion_benchmark": res})
            return

        self._send_json(404, {"success": False, "error": f"Unknown endpoint: {parsed.path}"})


def main() -> None:
    port = int(os.getenv("PORT", "8000"))
    server = HTTPServer(("0.0.0.0", port), EpiTextAgentRequestHandler)
    print(f"[EpiText-Agent Backend] Listening on http://localhost:{port} (Health: /health)")
    sys.stdout.flush()
    server.serve_forever()


if __name__ == "__main__":
    main()
