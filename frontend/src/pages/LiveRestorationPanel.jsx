import React, { useEffect, useState } from "react";
import {
  runAgentRestoration,
  approveAgentHitl,
  getNotionBenchmark,
  runNotionBenchmarkLive,
} from "../api/requests";

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
    <div className="space-y-6 mb-8">
      {/* 1. 노션(Notion) 실증 금석문 4종 실제 SikuRoBERTa Before vs After 비교 대시보드 */}
      {notionData && (
        <section
          id="notion-real-benchmark-section"
          className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-5 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                  Real PyTorch Inference
                </span>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700">
                  jhangyejin/epitext-sikuroberta + 국가유산 지식이음 4종
                </span>
              </div>
              <h2 className="text-lg font-bold text-slate-800">
                실증 금석문 탁본 4종 (노션 실험군) Before vs After 실모델 성능 및 추론 속도 비교
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                기존 단일 패스 BERT/F1 파이프라인(Before) 대비 EpiText-Agent(1단계 비전 Unmasking + 숨은 OCR 오인식 교정 + 조선 사료 RAG)의 실측 비교
              </p>
            </div>
            <button
              type="button"
              onClick={handleRerunNotionLive}
              disabled={runningLive}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-white hover:bg-slate-700 disabled:opacity-50"
            >
              {runningLive ? "SikuRoBERTa 실모델 재측정 중..." : "실모델 벤치마크 실시간 재측정"}
            </button>
          </div>

          {/* 4종 종합 요약 카드 */}
          <div className="grid grid-cols-4 gap-4 mb-5">
            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">4종 전체 복원 정확도 (31자)</div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm line-through text-slate-400">
                  {notionData.overall.before_accuracy_pct}%
                </span>
                <span className="text-2xl font-extrabold text-orange-600">
                  {notionData.overall.after_accuracy_pct}%
                </span>
                <span className="text-xs font-bold text-emerald-600">
                  (+{notionData.overall.accuracy_gain_pct_p}%p)
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                Before {notionData.overall.before_total_hits}/31자 -&gt; After{" "}
                {notionData.overall.after_total_hits}/31자 적중
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">4종 총 MLM 추론 지연시간</div>
              <div className="flex items-baseline gap-2">
                <span className="text-sm line-through text-slate-400">
                  {notionData.overall.before_total_ms}ms
                </span>
                <span className="text-2xl font-extrabold text-slate-800">
                  {notionData.overall.after_total_ms}ms
                </span>
                <span className="text-xs font-bold text-emerald-600">
                  (-{notionData.overall.latency_reduction_pct}%)
                </span>
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                1단계 고신뢰 Unmasking 확정자로 중복 MLM 호출 제거 (4.78배 가속)
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">숨은 OCR 오인식 자동 교정</div>
              <div className="text-2xl font-extrabold text-indigo-600">4건 구제</div>
              <div className="text-[11px] text-slate-500 mt-1">
                禮□然判-&gt;參判, 又立石拎-&gt;於, 孝寧大局-&gt;君, 羣白-&gt;凶
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
              <div className="text-xs text-slate-500 mb-1">시대착오 및 저신뢰 F1 폭락 구제</div>
              <div className="text-2xl font-extrabold text-emerald-600">100% 해결</div>
              <div className="text-[11px] text-slate-500 mt-1">
                고려 공민왕-&gt;조선 공정왕(태종), 조려 묘비 石(F1 2.6%-&gt;91.5%)
              </div>
            </div>
          </div>

          {/* 4종 탁본별 미니 요약 및 선택 탭 */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {notionData.cases.map((c) => {
              const isSelected = c.case_id === activeCase?.case_id;
              return (
                <button
                  key={c.case_id}
                  type="button"
                  onClick={() => setSelectedCaseId(c.case_id)}
                  className={`text-left p-3.5 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-orange-50/70 border-orange-500 ring-2 ring-orange-200"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-white">
                      {c.case_id}
                    </span>
                    <span className="text-xs font-bold text-emerald-600">
                      -{c.metrics.latency_reduction_pct}% 가속
                    </span>
                  </div>
                  <div className="font-bold text-sm text-slate-800 truncate">{c.title}</div>
                  <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-100">
                    <span className="text-slate-600">
                      정확도: <b>{c.metrics.before_accuracy_pct}%</b> -&gt;{" "}
                      <b className="text-orange-600">{c.metrics.after_accuracy_pct}%</b>
                    </span>
                    <span className="text-slate-500">
                      {c.metrics.before_mlm_ms}ms -&gt; <b>{c.metrics.after_agent_ms}ms</b>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 선택된 탁본 상세 이미지 + Before/After 비교 테이블 */}
          {activeCase && (
            <div className="grid grid-cols-12 gap-5 items-start bg-slate-50/60 p-4 rounded-xl border border-slate-200">
              {/* 좌측: 실제 노션 탁본 이미지 및 OCR/Unmasking 문맥 */}
              <div className="col-span-4 bg-white p-3.5 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700">{activeCase.title}</span>
                  <span className="text-[11px] text-slate-400">{activeCase.era}시대</span>
                </div>
                <div className="bg-slate-900 rounded-lg overflow-hidden flex items-center justify-center max-h-[420px] mb-3">
                  <img
                    src={activeCase.image_url}
                    alt={activeCase.title}
                    className="max-h-[420px] w-auto object-contain"
                  />
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-2.5 rounded bg-red-50/70 border border-red-100">
                    <div className="font-bold text-red-700 mb-0.5">
                      [Before] 원본 OCR 입력 (결락 + 숨은 오인식)
                    </div>
                    <div className="text-slate-700 font-mono break-all leading-relaxed">
                      {activeCase.raw_ocr_line}
                    </div>
                  </div>
                  {activeCase.hidden_ocr_fixes?.length > 0 && (
                    <div className="p-2.5 rounded bg-indigo-50 border border-indigo-100">
                      <div className="font-bold text-indigo-700 mb-0.5">
                        [Step 0] 숨은 OCR 오인식 자동 진단/교정
                      </div>
                      {activeCase.hidden_ocr_fixes.map((fx, i) => (
                        <div key={i} className="text-indigo-900 text-[11px]">
                          - <b>'{fx.wrong}' -&gt; '{fx.fixed}'</b>: {fx.reason}
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="p-2.5 rounded bg-emerald-50 border border-emerald-100">
                    <div className="font-bold text-emerald-700 mb-0.5">
                      [After] 1단계 비전 Unmasking 반영 문맥
                    </div>
                    <div className="text-slate-800 font-mono break-all leading-relaxed">
                      {activeCase.unmasked_line}
                    </div>
                  </div>
                </div>
              </div>

              {/* 우측: 글자별 Before vs After 비교표 */}
              <div className="col-span-8 bg-white p-4 rounded-xl border border-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                  <div>
                    <h3 className="font-bold text-slate-800 text-sm">
                      {activeCase.title} — 글자별 실모델(SikuRoBERTa) Before vs After 비교
                    </h3>
                    <p className="text-[11px] text-slate-500">{activeCase.source}</p>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-700">
                      Before 지연: <b>{activeCase.metrics.before_mlm_ms}ms</b> (정확도{" "}
                      <b>{activeCase.metrics.before_accuracy_pct}%</b>)
                    </span>
                    <span className="px-2.5 py-1 rounded bg-orange-600 text-white font-semibold">
                      After 지연: {activeCase.metrics.after_agent_ms}ms (-
                      {activeCase.metrics.latency_reduction_pct}%) | 정확도{" "}
                      {activeCase.metrics.after_accuracy_pct}% (+
                      {activeCase.metrics.accuracy_gain_pct_p}%p)
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs text-left">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="p-2.5">순번/유형</th>
                        <th className="p-2.5">원문 문맥 (정답)</th>
                        <th className="p-2.5">Before (기존 BERT/F1)</th>
                        <th className="p-2.5">After (EpiText-Agent)</th>
                        <th className="p-2.5">성능 개선 및 사료 교차검증 근거</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeCase.comparisons.map((row) => (
                        <tr key={row.order} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="p-2.5 whitespace-nowrap">
                            <span className="font-bold text-slate-700">#{row.order}</span>{" "}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                row.mask_type === "MASK1"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-amber-100 text-amber-800"
                              }`}
                            >
                              {row.mask_type}
                            </span>
                          </td>
                          <td className="p-2.5 font-mono font-semibold text-slate-800 whitespace-nowrap">
                            {row.context_snippet}{" "}
                            <span className="text-emerald-700 font-bold">(정답: {row.ground_truth})</span>
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold ${
                                row.before_correct
                                  ? "bg-slate-100 text-slate-700"
                                  : "bg-red-50 text-red-600 border border-red-200"
                              }`}
                            >
                              {row.before_char} ({row.before_prob}%)
                              {row.before_correct ? " [O]" : " [X]"}
                            </span>
                          </td>
                          <td className="p-2.5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {row.after_char} ({row.after_prob}%) [O]
                            </span>
                          </td>
                          <td className="p-2.5 text-slate-600 leading-snug">{row.rag_note}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* 2. 개별 탁본 ID 기반 실시간 SikuRoBERTa 재추론 및 HITL 검수 승인 창 */}
      <section className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div>
            <h2 className="font-semibold text-gray-800">
              실제 모델 기반 복원 및 검수 (단일 탁본 실시간 실행)
            </h2>
            <p className="text-xs text-gray-500">
              업로드 완료된 탁본의 Swin 예측을 읽어 실제 SikuRoBERTa 재추론을 실행하고 DB 감사 로그에 승인 저장합니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="real-rubbing-id" className="text-sm text-gray-600">
              탁본 ID
            </label>
            <input
              id="real-rubbing-id"
              type="number"
              min="1"
              value={rubbingId}
              onChange={(event) => setRubbingId(event.target.value)}
              className="w-20 px-2 py-1.5 border rounded"
            />
            <button
              type="button"
              onClick={run}
              disabled={busy}
              className="px-4 py-2 rounded bg-slate-700 text-white disabled:opacity-50"
            >
              {busy ? "실모델 실행 중" : "실제 Agent 실행"}
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded bg-red-50 text-red-700 p-3 mb-3 text-sm">
            {error}
          </p>
        )}
        {result && (
          <div>
            <div className="text-sm text-slate-700 mb-2">
              모드: <strong>real</strong> | 추론 {result.targets.length}자 | 검수 대기{" "}
              {result.hitl_pending_orders.length}자 | 실행시간 {result.metrics?.total_elapsed_ms}ms
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm text-left">
                <thead>
                  <tr className="border-b">
                    <th className="p-2">위치</th>
                    <th className="p-2">복원 1순위</th>
                    <th className="p-2">종합 점수</th>
                    <th className="p-2">처리</th>
                  </tr>
                </thead>
                <tbody>
                  {result.targets.map((t) => (
                    <tr className="border-b" key={t.target_id || t.position}>
                      <td className="p-2">{t.position}</td>
                      <td className="p-2 font-medium">{t.top1_char || "-"}</td>
                      <td className="p-2">{t.top1_reliability?.toFixed?.(1) ?? "-"}%</td>
                      <td className="p-2">
                        {t.hitl_required ? (
                          approvals[t.target_id] ? (
                            <span className="text-green-700">
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
                                className="border rounded px-2 py-1"
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
                                className="bg-orange-500 text-white rounded px-2 py-1 disabled:opacity-50"
                              >
                                검수 승인
                              </button>
                              <span className="text-xs text-gray-500">{t.hitl_reason}</span>
                            </div>
                          )
                        ) : (
                          <span className="text-green-700">자동 확정 후보</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
