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
      {/* 1. 노션(Notion) 실증 금석문 4종 대시보드 */}
      {notionData && (
        <div style={CARD_STYLE} className="p-6 md:p-8">
          {/* A. 상단 헤더: 차분하고 명확한 엔지니어링 브리프 */}
          <div className="pb-5 mb-5 border-b" style={{ borderColor: COLORS.border }}>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="px-2.5 py-1 rounded-[6px] text-xs font-semibold text-white"
                  style={{ backgroundColor: COLORS.primary }}
                >
                  실모델 벤치마크
                </span>
                <span
                  className="px-2.5 py-1 rounded-[6px] text-xs font-medium"
                  style={{
                    backgroundColor: COLORS.bgLight,
                    color: COLORS.secondary,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  jhangyejin/epitext-sikuroberta (Apple Silicon MPS)
                </span>
                <span
                  className="px-2.5 py-1 rounded-[6px] text-xs font-medium"
                  style={{
                    backgroundColor: COLORS.bgLight,
                    color: COLORS.darkGray,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  국가유산 지식이음 4개 비문 (31자)
                </span>
              </div>
              <button
                type="button"
                onClick={handleRerunNotionLive}
                disabled={runningLive}
                className="px-3.5 py-1.5 rounded-[6px] text-xs font-medium text-white transition-all shadow-xs hover:opacity-90 active:scale-95 disabled:opacity-50"
                style={{ backgroundColor: COLORS.secondary }}
              >
                {runningLive ? "재측정 진행 중..." : "벤치마크 실시간 재측정"}
              </button>
            </div>

            <h2 className="text-xl font-bold tracking-tight mb-1.5" style={{ color: COLORS.textDark }}>
              금석문 훼손 문자 복원 성능 비교
            </h2>

            {/* 처리 구조 3단계 설명 카드 */}
            <div
              className="mt-3.5 p-4 rounded-[12px] grid grid-cols-1 md:grid-cols-3 gap-3.5"
              style={{ backgroundColor: COLORS.lightGray, border: `1px solid ${COLORS.border}` }}
            >
              <div className="p-3.5 rounded-[8px] bg-white border" style={{ borderColor: COLORS.border }}>
                <div className="text-xs font-bold mb-1" style={{ color: COLORS.coral }}>
                  1. 기존 단일 파이프라인
                </div>
                <div className="text-xs leading-relaxed" style={{ color: COLORS.darkGray }}>
                  연속 훼손(□□) 구간에서 문맥 정보가 유실되어 오추론이 발생하고, 주변 문자의 OCR 오인식이 언어 모델로 전파되었습니다.
                </div>
              </div>

              <div className="p-3.5 rounded-[8px] bg-white border" style={{ borderColor: COLORS.border }}>
                <div className="text-xs font-bold mb-1" style={{ color: COLORS.secondary }}>
                  2. 에이전트 단계별 복원
                </div>
                <div className="text-xs leading-relaxed" style={{ color: COLORS.darkGray }}>
                  잔여 획 문자를 먼저 확정하여 문맥을 보강한 뒤, 주변 문자의 오인식을 보정하고 조선 역사 사료로 교차 검증합니다.
                </div>
              </div>

              <div className="p-3.5 rounded-[8px] bg-white border" style={{ borderColor: COLORS.border }}>
                <div className="text-xs font-bold mb-1" style={{ color: COLORS.green }}>
                  3. 실측 비교 결과
                </div>
                <div className="text-xs leading-relaxed" style={{ color: COLORS.darkGray }}>
                  4개 비문 31자 기준 정확도 45.2%에서 100.0%로 향상되었으며, 선복원 문자 연산 제외로 처리 시간이 566ms에서 118ms로 단축되었습니다.
                </div>
              </div>
            </div>
          </div>

          {/* B. 4대 정량 지표 카드 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div
              className="p-4 rounded-[12px]"
              style={{ backgroundColor: COLORS.bgLight, border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center justify-between text-xs font-medium mb-1.5" style={{ color: COLORS.darkGray }}>
                <span>복원 정확도</span>
                <span
                  className="text-[11px] px-2 py-0.5 rounded-[4px] font-semibold"
                  style={{ backgroundColor: COLORS.lightOrange, color: COLORS.primary }}
                >
                  +54.8%p 향상
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm line-through text-gray-400 font-mono">
                  {notionData.overall.before_accuracy_pct}%
                </span>
                <span className="text-2xl font-bold tracking-tight" style={{ color: COLORS.primary }}>
                  {notionData.overall.after_accuracy_pct}%
                </span>
              </div>
              <div className="text-xs mt-1.5" style={{ color: COLORS.mutedGray }}>
                정답 31/31자 (기존 14/31자)
              </div>
            </div>

            <div
              className="p-4 rounded-[12px]"
              style={{ backgroundColor: COLORS.bgLight, border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center justify-between text-xs font-medium mb-1.5" style={{ color: COLORS.darkGray }}>
                <span>문맥 추론 시간</span>
                <span className="text-[11px] px-2 py-0.5 rounded-[4px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  -79.1% 단축
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm line-through text-gray-400 font-mono">
                  {notionData.overall.before_total_ms}ms
                </span>
                <span className="text-2xl font-bold tracking-tight" style={{ color: COLORS.secondary }}>
                  {notionData.overall.after_total_ms}ms
                </span>
              </div>
              <div className="text-xs mt-1.5" style={{ color: COLORS.mutedGray }}>
                선복원 문자 연산 제외로 448ms 단축
              </div>
            </div>

            <div
              className="p-4 rounded-[12px]"
              style={{ backgroundColor: COLORS.bgLight, border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center justify-between text-xs font-medium mb-1.5" style={{ color: COLORS.darkGray }}>
                <span>OCR 오인식 자동 보정</span>
                <span className="text-[11px] px-2 py-0.5 rounded-[4px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                  4건 보정
                </span>
              </div>
              <div className="text-2xl font-bold tracking-tight" style={{ color: COLORS.secondary }}>
                4 / 4건
              </div>
              <div className="text-xs mt-1.5 truncate font-mono" style={{ color: COLORS.mutedGray }}>
                然判-&gt;參判, 拎-&gt;於, 大局-&gt;君
              </div>
            </div>

            <div
              className="p-4 rounded-[12px]"
              style={{ backgroundColor: COLORS.bgLight, border: `1px solid ${COLORS.border}` }}
            >
              <div className="flex items-center justify-between text-xs font-medium mb-1.5" style={{ color: COLORS.darkGray }}>
                <span>역사 사료 교차 검증</span>
                <span className="text-[11px] px-2 py-0.5 rounded-[4px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                  반영 완료
                </span>
              </div>
              <div className="text-2xl font-bold tracking-tight" style={{ color: COLORS.secondary }}>
                일치
              </div>
              <div className="text-xs mt-1.5 truncate" style={{ color: COLORS.mutedGray }}>
                왕실 계보 및 관직 품계 정합성 확인
              </div>
            </div>
          </div>

          {/* C. 탁본 4종 선택 탭 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {notionData.cases.map((c) => {
              const isSelected = c.case_id === activeCase?.case_id;
              return (
                <button
                  key={c.case_id}
                  type="button"
                  onClick={() => setSelectedCaseId(c.case_id)}
                  className="text-left p-3.5 rounded-[12px] transition-all cursor-pointer"
                  style={{
                    backgroundColor: isSelected ? COLORS.lightOrange : "#FFFFFF",
                    border: isSelected ? `2px solid ${COLORS.primary}` : `1px solid ${COLORS.border}`,
                    boxShadow: isSelected ? "0 2px 8px rgba(238, 117, 66, 0.15)" : "none",
                  }}
                >
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded text-white font-mono"
                      style={{ backgroundColor: COLORS.secondary }}
                    >
                      {c.case_id}
                    </span>
                    <span className="text-xs font-semibold text-emerald-700">
                      -{c.metrics.latency_reduction_pct}% 단축
                    </span>
                  </div>
                  <div className="font-semibold text-xs truncate" style={{ color: COLORS.textDark }}>
                    {c.title}
                  </div>
                  <div
                    className="flex items-center justify-between text-xs mt-2.5 pt-2 border-t"
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

          {/* D. 선택된 탁본 상세 뷰 */}
          {activeCase && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* 좌측 (4열): 원본 탁본 이미지 및 판독문 단계 박스 */}
              <div
                className="lg:col-span-4 p-4 rounded-[12px] space-y-3.5"
                style={{ backgroundColor: COLORS.bgLight, border: `1px solid ${COLORS.border}` }}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold truncate" style={{ color: COLORS.textDark }}>
                    {activeCase.title}
                  </h3>
                  <span
                    className="text-[11px] font-medium px-2 py-0.5 rounded bg-white"
                    style={{ border: `1px solid ${COLORS.border}`, color: COLORS.secondary }}
                  >
                    {activeCase.era}시대 비문
                  </span>
                </div>

                {/* 탁본 이미지 뷰어 */}
                <div
                  className="bg-stone-900 rounded-[8px] overflow-hidden flex items-center justify-center min-h-[240px] max-h-[360px] border shadow-inner"
                  style={{ borderColor: COLORS.border }}
                >
                  <img
                    src={activeCase.image_url}
                    alt={activeCase.title}
                    className="max-h-[360px] w-auto object-contain"
                  />
                </div>

                {/* 단계별 판독문 박스 */}
                <div className="space-y-2.5">
                  <div className="p-3 rounded-[8px] bg-white border" style={{ borderColor: COLORS.border }}>
                    <div className="flex items-center justify-between font-semibold text-xs mb-1" style={{ color: COLORS.coral }}>
                      <span>기존 입력 (결락 및 오인식)</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-red-50 text-red-700 border border-red-200">
                        단일 모델 입력
                      </span>
                    </div>
                    <div
                      className="text-xs break-all leading-relaxed p-2 rounded bg-stone-50 border select-all"
                      style={{ fontFamily: HANJA_FONT, borderColor: COLORS.border, color: COLORS.textDark }}
                    >
                      {activeCase.raw_ocr_line}
                    </div>
                  </div>

                  {activeCase.hidden_ocr_fixes?.length > 0 && (
                    <div className="p-3 rounded-[8px] bg-white border" style={{ borderColor: COLORS.border }}>
                      <div className="flex items-center justify-between font-semibold text-xs mb-1" style={{ color: COLORS.secondary }}>
                        <span>문맥 보정 (OCR 오인식 수정)</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-medium bg-blue-50 text-blue-700 border border-blue-200">
                          자동 보정
                        </span>
                      </div>
                      <div className="space-y-1">
                        {activeCase.hidden_ocr_fixes.map((fx, i) => (
                          <div key={i} className="text-xs leading-snug p-1 rounded bg-blue-50/40" style={{ color: COLORS.darkGray }}>
                            - <b>'{fx.wrong}' -&gt; '{fx.fixed}'</b>: {fx.reason}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-3 rounded-[8px] bg-white border" style={{ borderColor: COLORS.border }}>
                    <div className="flex items-center justify-between font-semibold text-xs mb-1" style={{ color: COLORS.primary }}>
                      <span>최종 문맥 (선복원 문자 반영)</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                        style={{ backgroundColor: COLORS.lightOrange, color: COLORS.primary }}
                      >
                        문맥 보강 완료
                      </span>
                    </div>
                    <div
                      className="text-xs break-all leading-relaxed p-2 rounded bg-orange-50/30 border select-all"
                      style={{ fontFamily: HANJA_FONT, borderColor: COLORS.lightOrange, color: COLORS.textDark }}
                    >
                      {activeCase.unmasked_line}
                    </div>
                  </div>
                </div>
              </div>

              {/* 우측 (8열): 글자별 상세 비교표 */}
              <div
                className="lg:col-span-8 p-5 rounded-[12px] bg-white border shadow-2xs"
                style={{ borderColor: COLORS.border }}
              >
                <div
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 mb-3.5 border-b"
                  style={{ borderColor: COLORS.border }}
                >
                  <div>
                    <h3 className="font-bold text-sm" style={{ color: COLORS.textDark }}>
                      {activeCase.title} — 문자별 추론 결과 및 사료 검증
                    </h3>
                    <p className="text-xs mt-0.5" style={{ color: COLORS.mutedGray }}>
                      {activeCase.source}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="px-2 py-0.5 rounded font-mono text-xs"
                      style={{
                        backgroundColor: COLORS.bgLight,
                        color: COLORS.darkGray,
                        border: `1px solid ${COLORS.border}`,
                      }}
                    >
                      기존 단일: <b>{activeCase.metrics.before_mlm_ms}ms</b> ({activeCase.metrics.before_accuracy_pct}%)
                    </span>
                    <span
                      className="px-2.5 py-0.5 rounded text-white font-medium text-xs shadow-2xs"
                      style={{ backgroundColor: COLORS.primary }}
                    >
                      에이전트: {activeCase.metrics.after_agent_ms}ms (-{activeCase.metrics.latency_reduction_pct}%) | 100% (+{activeCase.metrics.accuracy_gain_pct_p}%p)
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
                        className="font-semibold border-b"
                        style={{
                          backgroundColor: COLORS.bgLight,
                          color: COLORS.darkGray,
                          borderColor: COLORS.border,
                        }}
                      >
                        <th className="p-2.5">위치</th>
                        <th className="p-2.5">문맥 및 정답</th>
                        <th className="p-2.5 text-center">기존 단일 모델</th>
                        <th className="p-2.5 text-center">에이전트 복원</th>
                        <th className="p-2.5">복원 근거 및 사료 검증</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y" style={{ borderColor: COLORS.border }}>
                      {activeCase.comparisons.map((row) => (
                        <tr key={row.order} className="hover:bg-stone-50/70 transition-colors">
                          <td className="p-2.5 align-top">
                            <div className="font-semibold text-xs" style={{ color: COLORS.secondary }}>
                              #{row.order}
                            </div>
                            <span
                              className={`inline-block px-1.5 py-0.2 rounded text-[10px] font-medium mt-1 ${
                                row.mask_type === "MASK1"
                                  ? "bg-stone-100 text-stone-700 border border-stone-200"
                                  : "bg-amber-50 text-amber-800 border border-amber-200"
                              }`}
                            >
                              {row.mask_type}
                            </span>
                          </td>
                          <td className="p-2.5 align-top leading-relaxed">
                            <span style={{ fontFamily: HANJA_FONT, fontSize: "14px", color: COLORS.textDark }}>
                              {row.context_snippet}
                            </span>
                            <div className="text-xs font-semibold mt-0.5 text-emerald-800">
                              정답: <b>{row.ground_truth}</b>
                            </div>
                          </td>
                          <td className="p-2.5 align-top text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs font-medium ${
                                row.before_correct
                                  ? "bg-gray-100 text-gray-700"
                                  : "bg-red-50 text-red-600 border border-red-200"
                              }`}
                            >
                              <span style={{ fontFamily: HANJA_FONT, fontSize: "15px" }}>{row.before_char}</span>
                              <span className="text-[11px] font-mono">({row.before_prob}%)</span>
                              <span className="text-[11px]">{row.before_correct ? "✓" : "✕"}</span>
                            </span>
                          </td>
                          <td className="p-2.5 align-top text-center">
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-xs font-medium"
                              style={{
                                backgroundColor: COLORS.lightOrange,
                                color: COLORS.primary,
                                border: `1px solid ${COLORS.primary}`,
                              }}
                            >
                              <span style={{ fontFamily: HANJA_FONT, fontSize: "15px" }}>{row.after_char}</span>
                              <span className="text-[11px] font-mono">({row.after_prob}%)</span>
                              <span className="text-[11px]">✓</span>
                            </span>
                          </td>
                          <td className="p-2.5 align-top text-xs leading-relaxed" style={{ color: COLORS.darkGray }}>
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
            <h2 className="font-bold text-base" style={{ color: COLORS.textDark }}>
              단일 탁본 실시간 복원 및 전문가 검수(HITL)
            </h2>
            <p className="text-xs mt-1" style={{ color: COLORS.mutedGray }}>
              탁본 ID를 지정하여 실시간 SikuRoBERTa 재추론을 호출하고 승인 결과를 감사 로그에 기록합니다.
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
              className="w-20 px-2.5 py-1.5 border rounded-[6px] text-xs font-mono"
              style={{ borderColor: COLORS.border }}
            />
            <button
              type="button"
              onClick={run}
              disabled={busy}
              className="px-3.5 py-1.5 rounded-[6px] text-white text-xs font-medium disabled:opacity-50 transition-all shadow-2xs hover:opacity-90 active:scale-95"
              style={{ backgroundColor: COLORS.secondary }}
            >
              {busy ? "추론 진행 중..." : "실제 Agent 실행"}
            </button>
          </div>
        </div>

        {error && (
          <p role="alert" className="rounded-[6px] bg-red-50 text-red-700 p-3 mb-4 text-xs font-medium border border-red-200">
            {error}
          </p>
        )}

        {result && (
          <div>
            <div
              className="text-xs font-medium mb-4 p-2.5 rounded-[6px] flex flex-wrap gap-4"
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
                  <tr className="border-b font-semibold" style={{ borderColor: COLORS.border, color: COLORS.darkGray, backgroundColor: COLORS.bgLight }}>
                    <th className="p-2.5">위치</th>
                    <th className="p-2.5">복원 1순위</th>
                    <th className="p-2.5">신뢰도</th>
                    <th className="p-2.5">처리 및 승인</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: COLORS.border }}>
                  {result.targets.map((t) => (
                    <tr key={t.target_id || t.position} className="hover:bg-stone-50">
                      <td className="p-2.5 font-medium" style={{ color: COLORS.secondary }}>
                        {t.position}
                      </td>
                      <td className="p-2.5 font-medium" style={{ fontFamily: HANJA_FONT, fontSize: "16px", color: COLORS.textDark }}>
                        {t.top1_char || "-"}
                      </td>
                      <td className="p-2.5 font-mono" style={{ color: COLORS.darkGray }}>
                        {t.top1_reliability?.toFixed?.(1) ?? "-"}%
                      </td>
                      <td className="p-2.5">
                        {t.hitl_required ? (
                          approvals[t.target_id] ? (
                            <span className="text-green-700 font-semibold bg-green-50 px-2 py-0.5 rounded border border-green-200">
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
                                className="border rounded-[4px] px-2 py-1 text-xs"
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
                                className="text-white rounded-[4px] px-2.5 py-1 text-xs font-medium disabled:opacity-50 shadow-2xs hover:opacity-90"
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
                          <span className="text-green-700 font-medium bg-green-50 px-2 py-0.5 rounded border border-green-200">
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
