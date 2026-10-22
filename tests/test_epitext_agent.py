"""
EpiText-Agent 단위 및 통합 테스트 스위트 (unittest & pytest 겸용)
1. 3대 시대(삼국, 고려, 조선) 자동 진단 테스트
2. 연속 손상('□□') 구간 1단계 비전 Iterative Unmasking -> 2단계 문맥 재추론 테스트
3. 비전-문맥 교집합 부재 시 사료 RAG 후보 구제(茶毗, 首座, 鄒牟王) 테스트
4. 학설 이견 및 저신뢰 항목 HITL 게이트 분류 테스트
5. SupervisorDeps 의존성 주입 및 LLM_BACKEND(fake/ollama) 교체 테스트
6. MCP 서버/클라이언트 3대 Capability(Tool/Resource/Prompt) 및 with_retry 복구 테스트
7. SUPERVISOR_VERSION(v1 legacy / v2 agent) 무중단 버전 토글 테스트
8. 동일 입력 Before/After 비교 벤치마크(run_before_after_benchmark) 지표 검증
"""
import unittest
from agent_core import (
    build_supervisor_deps,
    EpiTextMCPClient,
    GLOBAL_RETRY_METRICS,
    diagnose_and_reprocess_ocr_line,
    evaluate_reversible_hypothesis,
    run_epitext_agent,
    run_before_after_benchmark,
)
from agent_core.tools import detect_era_from_text


class TestEpiTextAgentSuite(unittest.TestCase):

    def test_01_detect_era_three_dynasties(self):
        """삼국, 고려, 조선 3개 시대 텍스트 단서 기반 시대 분류 검증"""
        self.assertEqual(detect_era_from_text(["惟昔始祖鄒□王之創基也"]), "삼국")
        self.assertEqual(detect_era_from_text(["高□洛□歸法寺住持"]), "고려")
        self.assertEqual(detect_era_from_text(["有明朝鮮國資憲大夫吏□判書"]), "조선")

    def test_02_iterative_unmasking_consecutive_masks(self):
        """연속 2글자 손상('□□')에서 1단계 비전 선복원 후 2단계 문맥 추론 성공 검증"""
        # 고려 연호 '乾統', 삼국 국명 '北夫餘', 조선 간지 '己巳'
        state_goryeo = run_epitext_agent(1, "고려테스트", ["□□歲下元己未二月十"])
        self.assertEqual(state_goryeo["targets"][0]["top1_char"], "乾")
        self.assertEqual(state_goryeo["targets"][1]["unmasked_line"], "乾□歲下元己未二月十")
        self.assertEqual(state_goryeo["targets"][1]["top1_char"], "統")

        state_joseon = run_epitext_agent(2, "조선테스트", ["維歲次□□三月朔十五日"])
        self.assertEqual(state_joseon["inferred_era"], "조선")
        self.assertEqual(state_joseon["targets"][0]["top1_char"], "己")
        self.assertEqual(state_joseon["targets"][1]["top1_char"], "巳")

    def test_03_rag_arbitration_rescues_vision_candidates(self):
        """일반 MLM에서 누락된 고유명사/불교용어('茶毗'의 '毗', '鄒牟王'의 '牟') RAG 구제 검증"""
        state = run_epitext_agent(1, "다비테스트", ["壬申茶□以三月□五日"])
        target_bi = state["targets"][0]
        self.assertTrue(target_bi["conflict_detected"])
        self.assertEqual(target_bi["top1_char"], "毗")
        self.assertGreaterEqual(state["rag_rescued_count"], 1)

        state_ancient = run_epitext_agent(3, "광개토비", ["惟昔始祖鄒□王之創基也"])
        self.assertEqual(state_ancient["inferred_era"], "삼국")
        self.assertEqual(state_ancient["targets"][0]["top1_char"], "牟")

    def test_04_hitl_gate_scholarly_conflict_filtering(self):
        """사료 내 학설 이견 존재 시 HITL 검수 대상으로 정확히 분류되는지 검증"""
        state = run_epitext_agent(
            rubbing_id=1,
            title="학설이견테스트",
            text_lines=["高□洛□歸法寺住持", "贈諡文□公忠孝之傳"],
        )
        # 1행 2자('麗')는 이견 없음 -> hitl_required == False
        self.assertFalse(state["targets"][0]["hitl_required"])
        # 1행 4자('西' vs '國')는 학설 이견 존재 -> hitl_required == True
        self.assertTrue(state["targets"][1]["hitl_required"])
        self.assertIn("사료 판독 학설 이견 존재", state["targets"][1]["hitl_reason"])

    def test_05_dependency_injection_and_fake_llm_backend(self):
        """SupervisorDeps 의존성 주입 및 LLM_BACKEND='fake' 전환 시 결정론 해설 생성 검증"""
        fake_deps = build_supervisor_deps(llm_backend="fake", version="v2")
        state = run_epitext_agent(
            rubbing_id=10,
            title="조선묘지명",
            text_lines=["有明朝鮮國資憲大夫吏□判書", "贈諡文□公忠孝之傳"],
            enable_ollama_commentary=True,
            deps=fake_deps,
        )
        self.assertEqual(state["metrics"]["llm_backend"], "fake")
        rag_ev = state["targets"][1]["rag_evidence"]
        self.assertIsNotNone(rag_ev)
        self.assertIn("[FakeLLM 결정론 해설]", rag_ev.get("ollama_commentary", ""))

    def test_06_mcp_capabilities_and_transient_retry(self):
        """MCP 서버/클라이언트 Tool, Resource, Prompt 3대 기능 및 일시적 타임아웃 Retry 복구 검증"""
        GLOBAL_RETRY_METRICS.reset()
        mcp_client = EpiTextMCPClient(flaky_first_call=True)

        # 1) Tool 호출 (최초 1회 TimeoutError 발생 후 with_retry로 자동 복구)
        res = mcp_client.call_tool(
            "search_epigraphy_clause",
            {"surrounding_line": "高□洛□歸法寺住持", "candidate_chars": ["麗", "西"], "era": "고려"},
        )
        self.assertEqual(res["doc_id"], "KSE_GORYEO_001")
        self.assertEqual(GLOBAL_RETRY_METRICS.total_retries, 1)
        self.assertEqual(GLOBAL_RETRY_METRICS.recovered_calls, 1)

        # 2) Resource 조회
        resource_md = mcp_client.read_resource("조선")
        self.assertIn("KSE_JOSEON_001", resource_md)

        # 3) Prompt 조회
        prompt_txt = mcp_client.get_prompt("고려", "高□洛□歸法寺住持", "西", "陽")
        self.assertIn("search_epigraphy_clause Tool", prompt_txt)

    def test_07_supervisor_version_toggle_v1_vs_v2(self):
        """SUPERVISOR_VERSION=v1(Legacy 선형)과 v2(LangGraph Agent) 무중단 토글 검증"""
        lines = ["□□歲下元己未二月十"]
        deps_v1 = build_supervisor_deps(version="v1")
        deps_v2 = build_supervisor_deps(version="v2")

        state_v1 = run_epitext_agent(1, "버전토글", lines, deps=deps_v1)
        state_v2 = run_epitext_agent(1, "버전토글", lines, deps=deps_v2)

        self.assertEqual(state_v1["triage_route"], "legacy_v1_linear")
        self.assertEqual(state_v2["triage_route"], "vision_first_loop")
        # v1에서는 연속 손상 뒷글자가 오답('載' 또는 '年'), v2에서는 Unmasking 덕분에 '統'(정답)
        self.assertIn(state_v1["targets"][1]["top1_char"], ["載", "年"])
        self.assertEqual(state_v2["targets"][1]["top1_char"], "統")

    def test_08_before_after_benchmark_metrics(self):
        """동일 입력 14자에 대한 Before/After 비교 수치 및 Retry/비용 지표 검증"""
        bench = run_before_after_benchmark()
        summary = bench["summary"]
        self.assertEqual(summary["total_damaged_chars"], 14)
        self.assertGreater(summary["after_accuracy_pct"], summary["before_accuracy_pct"])
        self.assertLess(summary["after_elapsed_ms"], summary["before_elapsed_ms"])
        self.assertEqual(summary["after_local_ollama_cost_usd"], 0.0)
        self.assertEqual(summary["mcp_recovered_calls"], 1)

    def test_09_hidden_ocr_error_diagnosis_and_reprocessing(self):
        """결락 표시가 없는 숨은 OCR 오인식('甲' -> '由') 탐지 및 재처리 루프 검증"""
        res = diagnose_and_reprocess_ocr_line("□日由子薨卒二十一日")
        self.assertEqual(res["original_ocr_line"], "□日由子薨卒二十一日")
        self.assertEqual(res["reprocessed_line"], "□日甲子薨卒二十一日")
        self.assertEqual(len(res["suspect_ocr_tokens"]), 1)
        self.assertEqual(res["suspect_ocr_tokens"][0]["ocr_char"], "由")
        self.assertEqual(res["suspect_ocr_tokens"][0]["reprocessed_char"], "甲")
        self.assertEqual(res["restored_mask_char"], "六")
        self.assertEqual(res["transitions"]["error_to_correct"], 1)
        self.assertEqual(res["transitions"]["correct_to_error"], 0)

    def test_10_reversible_hypothesis_retraction(self):
        """원본 문맥 보존 및 잘못된 선행 가설('天') 철회 후 대안 가설('乾') 채택 검증"""
        res = evaluate_reversible_hypothesis("□□歲下元己未二月十", candidate_a="天", candidate_b="乾", era="고려")
        self.assertEqual(res["preserved_original_line"], "□□歲下元己未二月十")
        self.assertEqual(res["retracted_count"], 1)
        self.assertEqual(res["hypotheses"][0]["status"], "retracted")
        self.assertEqual(res["selected_hypothesis"]["assumed_char"], "乾")
        self.assertEqual(res["selected_hypothesis"]["dependent_top1"], "統")


if __name__ == "__main__":
    unittest.main()
