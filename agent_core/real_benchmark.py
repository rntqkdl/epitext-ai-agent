"""
Paired decision-stage benchmark using real model outputs.

This benchmark intentionally excludes OCR and Swin crop inference time when those
steps are already stored on a Rubbing row; it measures only the restoration
decision stage (single-pass MLM intersection vs. Agent unmasking + re-MLM + RAG).
"""
from __future__ import annotations

import statistics
import time
from typing import Any, Dict, List, Optional, Tuple

from .graph import run_epitext_agent
from .nodes import _calc_f1
from .real_tools import predict_real_mlm


def run_original_decision_once(real_inputs: Dict[str, Any]) -> Tuple[float, Dict[str, Optional[str]]]:
    t0 = time.perf_counter()
    predictions: Dict[str, Optional[str]] = {}
    for r_idx, line in enumerate(real_inputs["text_lines"]):
        for c_idx, ch in enumerate(line):
            if ch != "□":
                continue
            key = f"{r_idx}:{c_idx}"
            mlm_preds = predict_real_mlm(line, c_idx)
            swin_preds = real_inputs["vision_candidates_by_position"].get(key, [])
            mlm_map = {p["token"]: round(p["probability"] * 100, 1) for p in mlm_preds}
            swin_map = {p["token"]: round(p["probability"] * 100, 1) for p in swin_preds}
            intersection = set(mlm_map) & set(swin_map)

            candidates = [
                {"character": token, "reliability": _calc_f1(swin_map[token], mlm_map[token])}
                for token in intersection
            ]
            candidates.extend(
                {"character": token, "reliability": score}
                for token, score in mlm_map.items()
                if token not in intersection
            )
            candidates.sort(key=lambda item: item["reliability"], reverse=True)
            predictions[key] = candidates[0]["character"] if candidates else None
    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    return elapsed_ms, predictions


def run_paired_real_benchmark(
    rubbing_id: int,
    title: str,
    real_inputs: Dict[str, Any],
    ground_truth_by_position: Optional[Dict[str, str]] = None,
    repeats: int = 3,
) -> Dict[str, Any]:
    if repeats < 1 or repeats > 10:
        raise ValueError("repeats must be between 1 and 10")

    # Warm up the MLM singleton outside timed runs.
    first_pos = next(iter(real_inputs["target_ids_by_position"]))
    r0, c0 = (int(part) for part in first_pos.split(":"))
    predict_real_mlm(real_inputs["text_lines"][r0], c0)

    before_times: List[float] = []
    after_times: List[float] = []
    before_pred: Dict[str, Optional[str]] = {}
    after_state: Dict[str, Any] = {}

    for _ in range(repeats):
        b_ms, before_pred = run_original_decision_once(real_inputs)
        before_times.append(b_ms)

        t0 = time.perf_counter()
        after_state = run_epitext_agent(
            rubbing_id=rubbing_id,
            title=title,
            text_lines=real_inputs["text_lines"],
            inference_mode="real",
            vision_candidates_by_position=real_inputs["vision_candidates_by_position"],
            damage_types_by_position=real_inputs["damage_types_by_position"],
            target_ids_by_position=real_inputs["target_ids_by_position"],
        )
        after_times.append(round((time.perf_counter() - t0) * 1000, 2))

    after_pred = {
        f"{t['row_index']}:{t['char_index']}": t["top1_char"]
        for t in after_state["targets"]
    }
    accuracy: Dict[str, Any] = {"ground_truth_provided": bool(ground_truth_by_position)}
    if ground_truth_by_position:
        keys = [k for k in after_pred if k in ground_truth_by_position]
        before_hits = sum(1 for k in keys if before_pred.get(k) == ground_truth_by_position[k])
        after_hits = sum(1 for k in keys if after_pred.get(k) == ground_truth_by_position[k])
        total = len(keys)
        accuracy.update({
            "evaluated_positions": total,
            "before_top1_hits": before_hits,
            "after_top1_hits": after_hits,
            "before_top1_accuracy_pct": round((before_hits / total) * 100, 1) if total else None,
            "after_top1_accuracy_pct": round((after_hits / total) * 100, 1) if total else None,
        })

    return {
        "benchmark_mode": "real_decision_stage",
        "scope_note": "OCR and Swin image crop inference are precomputed on the rubbing; timings cover MLM/decision stages after warm-up.",
        "repeats": repeats,
        "before_decision_ms": {
            "runs": before_times,
            "mean": round(statistics.mean(before_times), 2),
            "median": round(statistics.median(before_times), 2),
        },
        "after_agent_decision_ms": {
            "runs": after_times,
            "mean": round(statistics.mean(after_times), 2),
            "median": round(statistics.median(after_times), 2),
        },
        "accuracy": accuracy,
        "before_predictions": before_pred,
        "after_predictions": after_pred,
    }
