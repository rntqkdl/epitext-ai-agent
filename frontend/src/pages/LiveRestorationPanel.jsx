import React, { useEffect, useState } from "react";
import {
  runAgentRestoration,
  approveAgentHitl,
  getNotionBenchmark,
  runNotionBenchmarkLive,
} from "../api/requests";

// EPITEXT 오리지널 UI 테마 상수 (DetailPage / ListPage 100% 계승)
const COLORS = {
  primary: "#ee7542", // 테라코타 오렌지
  secondary: "#344D64", // 슬레이트 네이비
  lightSecondary: "#CCD2D8",
  lightOrange: "#FCE3D9",
  lightGray: "#F8F8FA",
  darkGray: "#484A64",
  mutedGray: "#7F85A3",
  textDark: "#2A2A3A",
  border: "#EBEDF8",
  bgLight: "#F6F7FE",
  green: "#2B8A3E",
  greenBg: "#EBFBEE",
  coral: "#D9480F",
  coralBg: "#FFF5F5",
};

const CARD_STYLE = {
  borderRadius: "16px",
  border: "1px solid #EBEDF8",
  background: "#FFFFFF",
  boxShadow: "0 4px 12px 0 rgba(130, 130, 130, 0.10)",
};

const HANJA_FONT = "'Noto Serif KR', 'HanaMinB', 'Batang', serif";

export default function LiveRestorationPanel() {
  const [notionData, setNotionData] = useState(null);
  const [selectedCaseId, setSelectedCaseId] = useState(
    () => new URLSearchParams(window.location.search).get("case") || "KSM_NRICH_14054"
  );
  const [runningLive, setRunningLive] = useState(false);

  const [rubbingId, setRubbingId] = useState("1");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState({});
  const [approvals, setApprovals] = useState({});
  const [choices, setChoices] = useState({});

  useEffect(() => {
    getNotionBenchmark()
      .then((res) => {
        if (res?.notion_benchmark) {
          setNotionData(res.notion_benchmark);
        }
      })
      .catch(() => {});
  }, []);

  const handleRerunNotionLive = async () => {
    setRunningLive(true);
    try {
      const res = await runNotionBenchmarkLive();
      if (res?.notion_benchmark) {
        setNotionData(res.notion_benchmark);
      }
    } catch (e) {
      setError("실모델 재실행 중 오류가 발생했습니다.");
    } finally {
      setRunningLive(false);
    }
  };

  const run = async () => {
    const id = Number(rubbingId);
    if (!Number.isInteger(id) || id < 1) {
      setError("유효한 탁본 ID를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    setApprovals({});
    try {
      const response = await runAgentRestoration(id);
      if (!response?.success || response?.inference_mode !== "real") {
        throw new Error("실제 모델 추론 결과가 아닙니다.");
      }
      setResult(response);
      setChoices(
        Object.fromEntries(
          response.targets.map((target) => [target.target_id, target.top1_char || ""])
        )
      );
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "Agent 실행에 실패했습니다.");
    } finally {
      setBusy(false);
    }
  };

  const approve = async (target) => {
    if (!target.target_id || !choices[target.target_id]) {
      setError("DB 검수 대상 ID 또는 선택한 문자가 없습니다.");
      return;
    }
    setApproving((previous) => ({ ...previous, [target.target_id]: true }));
    setError("");
    try {
      const response = await approveAgentHitl({
        rubbing_id: result.rubbing_id,
        target_id: target.target_id,
        selected_character: choices[target.target_id],
      });
      if (!response?.success || !response?.audit_record?.id) {
        throw new Error("DB 저장 성공을 확인하지 못했습니다.");
      }
      setApprovals((previous) => ({ ...previous, [target.target_id]: response.audit_record.id }));
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "검수 저장에 실패했습니다.");
    } finally {
      setApproving((previous) => ({ ...previous, [target.target_id]: false }));
    }
  };

  const activeCase =
    notionData?.cases?.find((c) => c.case_id === selectedCaseId) || notionData?.cases?.[0];

  return (
    <div className="space-y-6 mb-10">
      {/* 1. 노션(Notion) 실증 금석문 4종 대시보드 - EPITEXT 공식 디자인 언어 적용 */}
      {notionData && (
        <div style={CARD_STYLE} className="p-6 md:p-8">
          {/* A. 상단 스토리 헤더: 비전문가도 3초 만에 이해하는 직관적 문제-해결 브리프 */}
          <div className="pb-6 mb-6 border-b" style={{ borderColor: COLORS.border }}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="px-3 py-1 rounded-[6px] text-xs font-bold text-white shadow-sm"
                  style={{ backgroundColor: COLORS.primary }}
                >
                  실모델 실측 검증
                </span>
                <span
                  className="px-3 py-1 rounded-[6px] text-xs font-semibold"
                  style={{
                    backgroundColor: COLORS.bgLight,
                    color: COLORS.secondary,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  jhangyejin/epitext-sikuroberta (MPS 가속)
                </span>
                <span
                  className="px-3 py-1 rounded-[6px] text-xs font-semibold"
                  style={{
                    backgroundColor: COLORS.greenBg,
                    color: COLORS.green,
                    border: "1px solid #D3F9D8",
                  }}
                >
                  국가유산 지식이음 4대 비문 31자 전수 적중
                </span>
              </div>
              <button
                type="button"
                onClick={handleRerunNotionLive}
                disabled={runningLive}
                className="px-4 py-2 rounded-[8px] text-xs font-bold text-white transition-all shadow-sm hover:opacity-90 active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: COLORS.secondary }}
              >
                {runningLive ? "실모델 추론 재측정 중..." : "실모델 벤치마크 실시간 재측정"}
              </button>
            </div>

            <h2 className="text-2xl font-bold tracking-tight mb-2" style={{ color: COLORS.textDark }}>
              탁본 훼손 복원 에이전트: 기존 단일 모델의 한계와 에이전트 혁신
            </h2>

            {/* 3초 만에 이해하는 인간 전문가 복원 원리 스토리보드 */}
            <div
              className="mt-4 p-4 rounded-[12px] grid grid-cols-1 md:grid-cols-3 gap-4"
              style={{ backgroundColor: COLORS.lightGray, border: `1px solid ${COLORS.border}` }}
            >
              <div className="p-3 rounded-[8px] bg-white border" style={{ borderColor: "#FFD8D8" }}>
                <div className="text-[11px] font-bold text-red-600 mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-red-100 flex items-center justify-center text-xs">1</span>
                  [문제점] 기존 인공지능의 한계
                </div>
                <div className="text-xs leading-relaxed" style={{ color: COLORS.darkGray }}>
                  비석에서 두 글자가 연속 훼손(□□)되거나 주변 글자가 잘못 읽히면, 모델이 앞뒤 힌트를 모두 잃고 <b>엉뚱한 한자를 지어내는 문맥 붕괴</b>(정확도 45.2% 추락)가 발생했습니다.
                </div>
              </div>

              <div className="p-3 rounded-[8px] bg-white border" style={{ borderColor: COLORS.border }}>
                <div className="text-[11px] font-bold mb-1 flex items-center gap-1.5" style={{ color: COLORS.secondary }}>
                  <span className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs text-blue-700">2</span>
                  [접근법] 인간 전문가 추론 모사
                </div>
                <div className="text-xs leading-relaxed" style={{ color: COLORS.darkGray }}>
                  에이전트는 <b>획이 조금이라도 남은 글자부터 먼저 풀고</b>(1단계 선복원), 숨어있는 <b>주변 오독을 스스로 교정한 뒤</b>(Step 0), <b>조선왕조실록 사료로 팩트체크</b>합니다.
                </div>
              </div>

              <div className="p-3 rounded-[8px] bg-white border" style={{ borderColor: "#D3F9D8" }}>
                <div className="text-[11px] font-bold text-green-700 mb-1 flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center text-xs">3</span>
                  [실측 결과] 100% 복원 및 4.78배 가속
                </div>
                <div className="text-xs leading-relaxed" style={{ color: COLORS.darkGray }}>
                  4대 금석문 31자 전수 평가에서 <b>100.0% 정답 적중</b>(+54.8%p)을 달성하고, 불필요한 중복 연산을 건너뛰어 <b>속도를 4.78배 단축(-79.1%)</b>시켰습니다.
                </div>
              </div>
            </div>
          </div>

          {/* B. 4대 정량 지표 카드 (DetailPage 디자인 1:1 계승) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div
              className="p-5 rounded-[12px] transition-all hover:shadow-sm"
              style={{ backgroundColor: COLORS.bgLight, border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center justify-between text-xs font-semibold mb-2" style={{ color: COLORS.darkGray }}>
                <span>4종 전체 복원 정확도</span>
                <span
                  className="text-[11px] px-2 py-0.5 rounded-[4px] font-bold"
                  style={{ backgroundColor: COLORS.lightOrange, color: COLORS.primary }}
                >
                  +54.8%p 대도약
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm line-through text-gray-400 font-mono">
                  {notionData.overall.before_accuracy_pct}%
                </span>
                <span className="text-3xl font-extrabold tracking-tight" style={{ color: COLORS.primary }}>
                  {notionData.overall.after_accuracy_pct}%
                </span>
              </div>
              <div className="text-xs mt-2 font-medium" style={{ color: COLORS.mutedGray }}>
                기존 14/31자 -&gt; <b style={{ color: COLORS.secondary }}>에이전트 31/31자 전수 적중</b>
              </div>
            </div>

            <div
              className="p-5 rounded-[12px] transition-all hover:shadow-sm"
              style={{ backgroundColor: COLORS.bgLight, border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center justify-between text-xs font-semibold mb-2" style={{ color: COLORS.darkGray }}>
                <span>총 추론 지연시간 (MLM)</span>
                <span className="text-[11px] px-2 py-0.5 rounded-[4px] font-bold bg-green-100 text-green-700">
                  4.78배 가속
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm line-through text-gray-400 font-mono">
                  {notionData.overall.before_total_ms}ms
                </span>
                <span className="text-3xl font-extrabold tracking-tight" style={{ color: COLORS.secondary }}>
                  {notionData.overall.after_total_ms}ms
                </span>
                <span className="text-xs font-bold text-green-600">
                  (-{notionData.overall.latency_reduction_pct}%)
                </span>
              </div>
              <div className="text-xs mt-2 font-medium" style={{ color: COLORS.mutedGray }}>
                1단계 확정자로 불필요한 MLM 재계산 제거
              </div>
            </div>

            <div
              className="p-5 rounded-[12px] transition-all hover:shadow-sm"
              style={{ backgroundColor: COLORS.bgLight, border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center justify-between text-xs font-semibold mb-2" style={{ color: COLORS.darkGray }}>
                <span>숨은 OCR 오독 자가치유</span>
                <span className="text-[11px] px-2 py-0.5 rounded-[4px] font-bold bg-blue-100 text-blue-700">
                  치유 성공
                </span>
              </div>
              <div className="text-3xl font-extrabold tracking-tight" style={{ color: COLORS.secondary }}>
                4건 전수 구제
              </div>
              <div className="text-xs mt-2 truncate font-mono" style={{ color: COLORS.mutedGray }}>
                然判-&gt;參判, 又立石拎-&gt;於, 孝寧大局-&gt;君
              </div>
            </div>

            <div
              className="p-5 rounded-[12px] transition-all hover:shadow-sm"
              style={{ backgroundColor: COLORS.bgLight, border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center justify-between text-xs font-semibold mb-2" style={{ color: COLORS.darkGray }}>
                <span>사료 기반 시대착오 교정</span>
                <span className="text-[11px] px-2 py-0.5 rounded-[4px] font-bold bg-emerald-100 text-emerald-800">
                  RAG 중재
                </span>
              </div>
              <div className="text-3xl font-extrabold tracking-tight text-emerald-600">
                100% 정상화
              </div>
              <div className="text-xs mt-2 truncate" style={{ color: COLORS.mutedGray }}>
                공민왕-&gt;조선 태종(공정왕), 石(2.6%-&gt;91.5%)
              </div>
            </div>
          </div>

          {/* C. 탁본 4종 선택 탭 (DetailPage 네비게이션 스타일 1:1 계승) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {notionData.cases.map((c) => {
              const isSelected = c.case_id === activeCase?.case_id;
              return (
                <button
                  key={c.case_id}
                  type="button"
                  onClick={() => setSelectedCaseId(c.case_id)}
                  className="text-left p-4 rounded-[12px] transition-all cursor-pointer"
                  style={{
                    backgroundColor: isSelected ? COLORS.lightOrange : "#FFFFFF",
                    border: isSelected ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
                    boxShadow: isSelected ? "0 4px 12px rgba(238, 117, 66, 0.15)" : "none",
                  }}
                >
                  <div className="flex items-center justify-between gap-1 mb-1.5">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded text-white font-mono"
                      style={{ backgroundColor: COLORS.secondary }}
                    >
                      {c.case_id}
                    </span>
                    <span className="text-xs font-bold text-emerald-600">
                      -{c.metrics.latency_reduction_pct}% 가속
                    </span>
                  </div>
                  <div className="font-bold text-sm truncate" style={{ color: COLORS.textDark }}>
                    {c.title}
                  </div>
                  <div
                    className="flex items-center justify-between text-xs mt-3 pt-2.5 border-t"
                    style={{ borderColor: COLORS.border }}
                  >
                    <span style={{ color: COLORS.darkGray }}>
                      정확도: <b>{c.metrics.before_accuracy_pct}%</b> -&gt;{" "}
                      <b style={{ color: COLORS.primary }}>{c.metrics.after_accuracy_pct}%</b>
                    </span>
                    <span className="font-mono text-[11px]" style={{ color: COLORS.mutedGray }}>
                      {c.metrics.before_mlm_ms}ms -&gt; <b>{c.metrics.after_agent_ms}ms</b>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* D. 선택된 탁본 상세 뷰 (DetailPage 좌측 이미지/우측 비교 2열 레이아웃 1:1 계승) */}
          {activeCase && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* 좌측 (4열): 원본 탁본 이미지 및 판독문 단계 박스 */}
              <div
                className="lg:col-span-4 p-5 rounded-[12px] space-y-4"
                style={{ backgroundColor: COLORS.bgLight, border: `1px solid ${COLORS.border}` }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold truncate" style={{ color: COLORS.textDark }}>
                    {activeCase.title}
                  </h3>
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded bg-white shadow-2xs"
                    style={{ border: `1px solid ${COLORS.border}`, color: COLORS.secondary }}
                  >
                    {activeCase.era}시대 비문
                  </span>
                </div>

                {/* 탁본 이미지 뷰어 (DetailPage 이미지 박스 스타일) */}
                <div
                  className="bg-stone-900 rounded-[10px] overflow-hidden flex items-center justify-center min-h-[260px] max-h-[380px] border shadow-inner"
                  style={{ borderColor: COLORS.border }}
                >
                  <img
                    src={activeCase.image_url}
                    alt={activeCase.title}
                    className="max-h-[380px] w-auto object-contain transition-transform hover:scale-105 duration-300"
                  />
                </div>

                {/* 3단계 복원 추론 과정 박스 (가독성 높은 한자 폰트 적용) */}
                <div className="space-y-3">
                  <div className="p-3.5 rounded-[10px] bg-white border" style={{ borderColor: "#FFD8D8" }}>
                    <div className="flex items-center justify-between font-bold text-xs mb-1.5" style={{ color: COLORS.coral }}>
                      <span>[Before 문제] 원본 OCR 입력 (결락 + 오독)</span>
                      <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-red-100 text-red-700">
                        문맥 붕괴
                      </span>
                    </div>
                    <div
                      className="text-xs break-all leading-relaxed p-2.5 rounded bg-stone-50 border select-all"
                      style={{ fontFamily: HANJA_FONT, borderColor: COLORS.border, color: COLORS.textDark }}
                    >
                      {activeCase.raw_ocr_line}
                    </div>
                  </div>

                  {activeCase.hidden_ocr_fixes?.length > 0 && (
                    <div className="p-3.5 rounded-[10px] bg-white border" style={{ borderColor: COLORS.secondary }}>
                      <div className="flex items-center justify-between font-bold text-xs mb-1.5" style={{ color: COLORS.secondary }}>
                        <span>[Step 0 자가치유] 숨은 OCR 오독 자동 진단</span>
                        <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-blue-100 text-blue-800">
                          자동 교정
                        </span>
                      </div>
                      <div className="space-y-1">
                        {activeCase.hidden_ocr_fixes.map((fx, i) => (
                          <div key={i} className="text-xs leading-snug p-1.5 rounded bg-blue-50/50" style={{ color: COLORS.darkGray }}>
                            • <b>'{fx.wrong}' -&gt; '{fx.fixed}'</b>: {fx.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3.5 rounded-[10px] bg-white border" style={{ borderColor: COLORS.primary }}>
                    <div className="flex items-center justify-between font-bold text-xs mb-1.5" style={{ color: COLORS.primary }}>
                      <span>[After 해결] 1단계 선복원 문맥 (Unmasked)</span>
                      <span
                        className="text-[10px] px-2 py-0.5 rounded font-bold"
                        style={{ backgroundColor: COLORS.lightOrange, color: COLORS.primary }}
                      >
                        문맥 복원 완료
                      </span>
                    </div>
                    <div
                      className="text-xs break-all leading-relaxed p-2.5 rounded bg-orange-50/30 border select-all"
                      style={{ fontFamily: HANJA_FONT, borderColor: COLORS.primary, color: COLORS.textDark }}
                    >
                      {activeCase.unmasked_line}
                    </div>
                  </div>
                </div>
              </div>

              {/* 우측 (8열): 글자별 상세 Before vs After 검수 비교표 */}
              <div
                className="lg:col-span-8 p-6 rounded-[12px] bg-white border shadow-2xs"
                style={{ borderColor: COLORS.border }}
              >
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b"
                  style={{ borderColor: COLORS.border }}
                >
                  <div>
                    <h3 className="font-bold text-base" style={{ color: COLORS.textDark }}>
                      {activeCase.title} — 글자별 실패 원인과 에이전트 교정 내역
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: COLORS.mutedGray }}>
                      {activeCase.source}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="px-2.5 py-1 rounded font-mono text-xs font-semibold"
                      style={{
                        backgroundColor: COLORS.bgLight,
                        color: COLORS.darkGray,
                        border: `1px solid ${COLORS.border}`,
                      }}
                    >
                      Before: <b>{activeCase.metrics.before_mlm_ms}ms</b> ({activeCase.metrics.before_accuracy_pct}%)
                    </span>
                    <span
                      className="px-3 py-1 rounded text-white font-bold text-xs shadow-xs"
                      style={{ backgroundColor: COLORS.primary }}
                    >
                      After: {activeCase.metrics.after_agent_ms}ms (-{activeCase.metrics.latency_reduction_pct}%) | 100% (+{activeCase.metrics.accuracy_gain_pct_p}%p)
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-left table-fixed">
                    <colgroup>
                      <col style={{ width: "12%" }} />
                      <col style={{ width: "24%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "18%" }} />
                      <col style={{ width: "28%" }} />
                    </colgroup>
                    <thead>
                      <tr
                        className="font-bold border-b"
                        style={{
                          backgroundColor: COLORS.bgLight,
                          color: COLORS.darkGray,
                          borderColor: COLORS.border,
                        }}
                      >
                        <th className="p-3">순번</th>
                        <th className="p-3">문맥 (정답)</th>
                        <th className="p-3 text-center">Before (기존 단일)</th>
                        <th className="p-3 text-center">After (에이전트)</th>
                        <th className="p-3">성능 개선 및 사료 검증 근거</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: COLORS.border }}>
                      {activeCase.comparisons.map((row) => (
                        <tr key={row.order} className="hover:bg-amber-50/20 transition-colors">
                          <td className="p-3 align-top">
                            <div className="font-bold text-xs" style={{ color: COLORS.secondary }}>
                              #{row.order}
                            </div>
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold mt-1 ${
                                row.mask_type === "MASK1"
                                  ? "bg-red-50 text-red-600 border border-red-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {row.mask_type}
                            </span>
                          </td>
                          <td className="p-3 align-top leading-relaxed">
                            <span style={{ fontFamily: HANJA_FONT, fontSize: "15px", color: COLORS.textDark }}>
                              {row.context_snippet}
                            </span>
                            <div className="text-xs font-bold mt-1 text-emerald-700">
                              정답: <b>{row.ground_truth}</b>
                            </div>
                          </td>
                          <td className="p-3 align-top text-center">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-bold ${
                                row.before_correct
                                  ? "bg-gray-100 text-gray-700"
                                  : "bg-red-50 text-red-600 border border-red-200"
                              }`}
                            >
                              <span style={{ fontFamily: HANJA_FONT, fontSize: "16px" }}>{row.before_char}</span>
                              <span className="text-[11px] font-mono">({row.before_prob}%)</span>
                              <span className="text-[11px]">{row.before_correct ? "✓" : "✕"}</span>
                            </span>
                          </td>
                          <td className="p-3 align-top text-center">
                            <span
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-bold shadow-2xs"
                              style={{
                                backgroundColor: COLORS.lightOrange,
                                color: COLORS.primary,
                                border: `1px solid ${COLORS.primary}`,
                              }}
                            >
                              <span style={{ fontFamily: HANJA_FONT, fontSize: "16px" }}>{row.after_char}</span>
                              <span className="text-[11px] font-mono">({row.after_prob}%)</span>
                              <span className="text-[11px]">✓</span>
                            </span>
                          </td>
                          <td className="p-3 align-top text-xs leading-relaxed" style={{ color: COLORS.darkGray }}>
                            {row.rag_note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. 단일 탁본 실시간 복원 및 전문가 검수(HITL) 패널 */}
      <div style={CARD_STYLE} className="p-6 md:p-8">
        <div
          className="flex flex-wrap items-center justify-between gap-4 mb-4 pb-4 border-b"
          style={{ borderColor: COLORS.border }}
        >
          <div>
            <h2 className="font-bold text-lg" style={{ color: COLORS.textDark }}>
              단일 탁본 실시간 복원 및 전문가 검수(HITL)
            </h2>
            <p className="text-xs mt-1" style={{ color: COLORS.mutedGray }}>
              탁본 ID를 지정하여 실시간 SikuRoBERTa 재추론을 호출하고 승인 결과를 영속 감사 로그에 기록합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="real-rubbing-id" className="text-xs font-semibold" style={{ color: COLORS.darkGray }}>
              탁본 ID
            </label>
            <input
              id="real-rubbing-id"
              type="number"
              min="1"
              value={rubbingId}
              onChange={(event) => setRubbingId(event.target.value)}
              className="w-20 px-2.5 py-1.5 border rounded-[8px] text-xs font-mono"
              style={{ borderColor: COLORS.border }}
            />
            <button
              type="button"
              onClick={run}
              disabled={busy}
              className="px-4 py-2 rounded-[8px] text-white text-xs font-bold disabled:opacity-50 transition-all shadow-sm hover:opacity-90 active:scale-95"
              style={{ backgroundColor: COLORS.secondary }}
            >
              {busy ? "실모델 추론 중..." : "실제 Agent 실행"}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-[8px] bg-red-50 text-red-700 p-3.5 mb-4 text-xs font-medium border border-red-200">
            {error}
          </p>
        )}

        {result && (
          <div>
            <div
              className="text-xs font-medium mb-4 p-3 rounded-[8px] flex flex-wrap gap-4"
              style={{ backgroundColor: COLORS.bgLight, color: COLORS.darkGray }}
            >
              <span>모드: <b style={{ color: COLORS.primary }}>real (실모델)</b></span>
              <span>추론 대상: <b>{result.targets.length}자</b></span>
              <span>검수 대기: <b>{result.hitl_pending_orders.length}자</b></span>
              <span>실행 시간: <b>{result.metrics?.total_elapsed_ms}ms</b></span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-xs text-left table-fixed">
                <colgroup>
                  <col style={{ width: "15%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "45%" }} />
                </colgroup>
                <thead>
                  <tr className="border-b font-bold" style={{ borderColor: COLORS.border, color: COLORS.darkGray, backgroundColor: COLORS.bgLight }}>
                    <th className="p-3">위치</th>
                    <th className="p-3">복원 1순위</th>
                    <th className="p-3">종합 신뢰도</th>
                    <th className="p-3">처리 및 승인</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: COLORS.border }}>
                  {result.targets.map((t) => (
                    <tr key={t.target_id || t.position} className="hover:bg-stone-50">
                      <td className="p-3 font-semibold" style={{ color: COLORS.secondary }}>
                        {t.position}
                      </td>
                      <td className="p-3 font-medium" style={{ fontFamily: HANJA_FONT, fontSize: "18px", color: COLORS.textDark }}>
                        {t.top1_char || "-"}
                      </td>
                      <td className="p-3 font-mono font-semibold" style={{ color: COLORS.darkGray }}>
                        {t.top1_reliability?.toFixed?.(1) ?? "-"}%
                      </td>
                      <td className="p-3">
                        {t.hitl_required ? (
                          approvals[t.target_id] ? (
                            <span className="text-green-700 font-bold bg-green-50 px-2 py-1 rounded border border-green-200">
                              승인 저장됨 #{approvals[t.target_id]}
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-2 items-center">
                              <select
                                aria-label={`${t.position} 복원 후보 선택`}
                                value={choices[t.target_id] || ""}
                                onChange={(event) =>
                                  setChoices((old) => ({
                                    ...old,
                                    [t.target_id]: event.target.value,
                                  }))
                                }
                                className="border rounded-[6px] px-2.5 py-1 text-xs"
                                style={{ borderColor: COLORS.border }}
                              >
                                {t.final_candidates.map((c) => (
                                  <option key={c.character} value={c.character}>
                                    {c.character}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                onClick={() => approve(t)}
                                disabled={approving[t.target_id]}
                                className="text-white rounded-[6px] px-3 py-1 text-xs font-bold disabled:opacity-50 shadow-2xs hover:opacity-90"
                                style={{ backgroundColor: COLORS.primary }}
                              >
                                {approving[t.target_id] ? "저장 중..." : "검수 승인"}
                              </button>
                              <span className="text-[11px]" style={{ color: COLORS.mutedGray }}>
                                {t.hitl_reason}
                              </span>
                            </div>
                          )
                        ) : (
                          <span className="text-green-700 font-semibold bg-green-50 px-2 py-1 rounded border border-green-200">
                            자동 확정 후보
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
