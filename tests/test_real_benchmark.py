import unittest
from agent_core import real_benchmark
from agent_core.real_benchmark import run_original_decision_once


class TestRealBenchmark(unittest.TestCase):
    def test_original_decision_uses_real_model_outputs(self):
        orig = real_benchmark.predict_real_mlm
        try:
            real_benchmark.predict_real_mlm = lambda line, col: [
                {"token": "水", "probability": 0.7}, {"token": "山", "probability": 0.3},
            ]
            inputs = {
                "text_lines": ["八德□"],
                "vision_candidates_by_position": {
                    "0:2": [
                        {"token": "山", "probability": 0.95},
                        {"token": "院", "probability": 0.05},
                    ]
                },
            }
            elapsed, predictions = run_original_decision_once(inputs)
            self.assertGreaterEqual(elapsed, 0)
            self.assertEqual(predictions["0:2"], "水")  # original intersection/NLP rule favors MLM
        finally:
            real_benchmark.predict_real_mlm = orig


if __name__ == "__main__":
    unittest.main()
