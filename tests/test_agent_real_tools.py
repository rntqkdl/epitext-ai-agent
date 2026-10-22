"""Regression tests without downloading model weights or using external services."""
import unittest
from types import SimpleNamespace
from agent_core.real_tools import normalized_lines, predict_real_mlm, prepare_saved_predictions, RealModelUnavailable
import agent_core.real_tools as real_tools


def _candidate(char, score, rank=1):
    return SimpleNamespace(character=char, stroke_match=score, rank_vision=rank)


def _rubbing(valid=True):
    target = SimpleNamespace(
        id=44, row_index=0, char_index=(1 if valid else 3),
        position="1행 2자", damage_type="부분_훼손",
        candidates=[_candidate("乾", 88.6), _candidate("天", 4.2, 2)],
    )
    return SimpleNamespace(
        details=[SimpleNamespace(text_content='["乾□歲"]')],
        restoration_targets=[target],
    )


class TestAgentRealTools(unittest.TestCase):
    def test_normalize_mask_token_width(self):
        self.assertEqual(normalized_lines(["高[MASK2]洛[MASK1]"]), ["高□洛□"])

    def test_read_real_swin_from_db(self):
        inputs = prepare_saved_predictions(_rubbing())
        self.assertEqual(inputs["target_ids_by_position"], {"0:1": 44})
        self.assertEqual(inputs["damage_types_by_position"]["0:1"], "MASK2")
        self.assertEqual(inputs["vision_candidates_by_position"]["0:1"][0]["token"], "乾")
        self.assertAlmostEqual(inputs["vision_candidates_by_position"]["0:1"][0]["probability"], 0.886)

    def test_refuses_invalid_target_coordinates(self):
        with self.assertRaises(RealModelUnavailable):
            prepare_saved_predictions(_rubbing(valid=False))

    def test_real_mlm_selects_requested_mask(self):
        class Predictor:
            def predict_masks(self, text):
                assert text == "[MASK][MASK]歲"
                return [[{"token": "乾", "probability": 0.89}],
                        [{"token": "統", "probability": 0.91}]]
        orig = real_tools._mlm_predictor
        try:
            real_tools._mlm_predictor = lambda: Predictor()
            self.assertEqual(predict_real_mlm("□□歲", 1)[0]["token"], "統")
        finally:
            real_tools._mlm_predictor = orig

    def test_real_mlm_refuses_unmasked_target(self):
        with self.assertRaises(ValueError):
            predict_real_mlm("乾□歲", 0)


if __name__ == "__main__":
    unittest.main()
