"""
Real inference integration for EpiText-Agent.

In real mode, Swin V2 predictions are read from the uploaded rubbing's stored
MASK2 candidate rows (produced from the actual image crops during upload), and
SikuRoBERTa MLM is executed again before/after Step-1 unmasking.
"""
from __future__ import annotations

import json
import re
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List


ROOT_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = ROOT_DIR / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

MASK_TOKEN_RE = re.compile(r"\[MASK\d*\]")


class RealModelUnavailable(RuntimeError):
    """Raised when real inference cannot run safely without falling back to mocks."""


def clean_line(line: str) -> str:
    line = MASK_TOKEN_RE.sub("□", line or "")
    return line.replace("，", "").replace("。", "").replace(" ", "").strip()


def normalized_lines(raw_lines: List[str]) -> List[str]:
    return [clean_line(line) for line in raw_lines if clean_line(line)]


@lru_cache(maxsize=1)
def _mlm_predictor():
    try:
        from ai_modules.nlp_engine import load_nlp_config
        from ai_modules.nlp.mlm_predictor import MLMPredictor
        import torch
    except Exception as exc:
        raise RealModelUnavailable(f"MLM dependencies are not installed: {exc}") from exc

    config = load_nlp_config()
    device = "cuda" if torch.cuda.is_available() else ("mps" if hasattr(torch.backends, "mps") and torch.backends.mps.is_available() else "cpu")
    predictor = MLMPredictor(config, device)
    try:
        predictor.load_model()
    except Exception as exc:
        raise RealModelUnavailable(f"Failed to load SikuRoBERTa MLM model: {exc}") from exc
    return predictor


def predict_real_mlm(line_text: str, char_index: int, era: str = "고려") -> List[Dict[str, Any]]:
    """Run the configured SikuRoBERTa model for one masked character in line_text."""
    del era
    line = clean_line(line_text)
    if char_index < 0 or char_index >= len(line):
        raise ValueError(f"char_index {char_index} out of range for line of length {len(line)}")
    if line[char_index] != "□":
        raise ValueError(f"Expected mask symbol at index {char_index}, got '{line[char_index]}'")

    mask_Positions = [idx for idx, ch in enumerate(line) if ch == "□"]
    mask_ordinal = mask_Positions.index(char_index)
    masked_text = line.replace("□", "[MASK]")
    all_predictions = _mlm_predictor().predict_masks(masked_text)
    if mask_ordinal >= len(all_predictions):
        raise RealModelUnavailable(
            f"MLM returned {len(all_predictions)} mask predictions for {len(mask_Positions)} masks"
        )
    non_char_tokens = {"。", "，", "、", "；", "：", "？", "！", "[UNK]", "[PAD]", "[CLS]", "[SEP]"}
    filtered = [
        {"token": item["token"], "probability": float(item["probability"])}
        for item in all_predictions[mask_ordinal]
        if item.get("token") not in non_char_tokens and not str(item.get("token", "")).startswith("[")
    ]
    return filtered or [
        {"token": item["token"], "probability": float(item["probability"])}
        for item in all_predictions[mask_ordinal]
    ]


def extract_text_lines_from_rubbing(rubbing: Any) -> List[str]:
    if not rubbing or not getattr(rubbing, "details", None):
        raise RealModelUnavailable("Rubbing has no OCR detail text")
    raw_content = rubbing.details[0].text_content
    if not raw_content:
        raise RealModelUnavailable("Rubbing OCR text_content is empty")
    try:
        lines = json.loads(raw_content) if raw_content.lstrip().startswith("[") else raw_content.splitlines()
    except Exception:
        lines = raw_content.splitlines()
    cleaned = normalized_lines([str(line) for line in lines])
    if not cleaned:
        raise RealModelUnavailable("Rubbing contains no usable text lines")
    return cleaned


def prepare_saved_predictions(rubbing: Any) -> Dict[str, Any]:
    """Extract aligned OCR lines, target IDs, damage types, and saved Swin candidates."""
    text_lines = extract_text_lines_from_rubbing(rubbing)
    vision_by_pos: Dict[str, List[Dict[str, Any]]] = {}
    damage_by_pos: Dict[str, str] = {}
    target_ids_by_pos: Dict[str, int] = {}

    db_targets = sorted(
        list(getattr(rubbing, "restoration_targets", []) or []),
        key=lambda item: (item.row_index or 0, item.char_index or 0, item.id or 0),
    )
    if not db_targets:
        raise RealModelUnavailable("Rubbing has no saved restoration_targets")

    for target in db_targets:
        if target.row_index is None or target.char_index is None:
            raise RealModelUnavailable(f"RestorationTarget {target.id} is missing row_index/char_index")
        r_idx = int(target.row_index)
        c_idx = int(target.char_index)
        if r_idx < 0 or r_idx >= len(text_lines) or c_idx < 0 or c_idx >= len(text_lines[r_idx]):
            raise RealModelUnavailable(
                f"Target {target.id} coordinates ({r_idx}, {c_idx}) are outside OCR text lines"
            )
        if text_lines[r_idx][c_idx] != "□":
            raise RealModelUnavailable(
                f"Target {target.id} at ({r_idx}, {c_idx}) does not point to a mask in '{text_lines[r_idx]}'"
            )

        key = f"{r_idx}:{c_idx}"
        target_ids_by_pos[key] = int(target.id)
        damage_type = "MASK1" if target.damage_type == "완전_훼손" else "MASK2"
        damage_by_pos[key] = damage_type

        swin_candidates = [
            cand for cand in (getattr(target, "candidates", []) or [])
            if getattr(cand, "stroke_match", None) is not None
        ]
        swin_candidates.sort(
            key=lambda cand: (
                getattr(cand, "rank_vision", None) is None,
                getattr(cand, "rank_vision", 9999) or 9999,
                -float(cand.stroke_match),
            )
        )
        vision_by_pos[key] = [
            {
                "token": cand.character,
                "probability": round(float(cand.stroke_match) / 100.0, 4),
            }
            for cand in swin_candidates
        ]
        if damage_type == "MASK2" and not vision_by_pos[key]:
            raise RealModelUnavailable(f"MASK2 target {target.id} at {key} has no saved Swin stroke_match")

    mask_positions = {
        f"{r_idx}:{c_idx}"
        for r_idx, line in enumerate(text_lines)
        for c_idx, ch in enumerate(line)
        if ch == "□"
    }
    if set(target_ids_by_pos.keys()) != mask_positions:
        raise RealModelUnavailable(
            f"Saved target coordinates {sorted(target_ids_by_pos)} do not match OCR masks {sorted(mask_positions)}"
        )

    return {
        "text_lines": text_lines,
        "vision_candidates_by_position": vision_by_pos,
        "damage_types_by_position": damage_by_pos,
        "target_ids_by_position": target_ids_by_pos,
    }
