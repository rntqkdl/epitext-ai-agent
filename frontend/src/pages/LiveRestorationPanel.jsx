import React, { useState } from "react";
import { runAgentRestoration, approveAgentHitl } from "../api/requests";

/** Live panel: never displays fixture benchmark data as real inference. */
export default function LiveRestorationPanel() {
  const [rubbingId, setRubbingId] = useState("1");
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState({});
  const [approvals, setApprovals] = useState({});
  const [choices, setChoices] = useState({});

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
      setChoices(Object.fromEntries(response.targets.map((target) => [
        target.target_id, target.top1_char || "",
      ])));
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

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold text-gray-800">실제 모델 기반 복원 및 검수</h2>
          <p className="text-xs text-gray-500">업로드 완료된 탁본의 Swin 예측을 읽어 실제 SikuRoBERTa 재추론을 실행합니다.</p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="real-rubbing-id" className="text-sm text-gray-600">탁본 ID</label>
          <input id="real-rubbing-id" type="number" min="1" value={rubbingId}
            onChange={(event) => setRubbingId(event.target.value)} className="w-20 px-2 py-1.5 border rounded" />
          <button type="button" onClick={run} disabled={busy}
            className="px-4 py-2 rounded bg-slate-700 text-white disabled:opacity-50">
            {busy ? "실모델 실행 중" : "실제 Agent 실행"}
          </button>
        </div>
      </div>
      {error && <p role="alert" className="rounded bg-red-50 text-red-700 p-3 mb-3 text-sm">{error}</p>}
      {result && (
        <div>
          <div className="text-sm text-slate-700 mb-2">
            모드: <strong>real</strong> | 추론 {result.targets.length}자 | 검수 대기 {result.hitl_pending_orders.length}자
            | 실행시간 {result.metrics?.total_elapsed_ms}ms (모델 로딩 여부에 따라 달라짐)
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-left">
              <thead><tr className="border-b"><th className="p-2">위치</th><th className="p-2">복원 1순위</th><th className="p-2">종합 점수</th><th className="p-2">처리</th></tr></thead>
              <tbody>{result.targets.map((t) => (
                <tr className="border-b" key={t.target_id || t.position}>
                  <td className="p-2">{t.position}</td><td className="p-2 font-medium">{t.top1_char || "-"}</td>
                  <td className="p-2">{t.top1_reliability?.toFixed?.(1) ?? "-"}%</td>
                  <td className="p-2">
                    {t.hitl_required ? (
                      approvals[t.target_id] ? <span className="text-green-700">승인 저장됨 #{approvals[t.target_id]}</span> :
                      <div className="flex flex-wrap gap-2 items-center">
                        <select aria-label={`${t.position} 복원 후보 선택`} value={choices[target_id_key(t)] || ""}
                          onChange={(event) => setChoices((old) => ({ ...old, [t.target_id]: event.target.value }))}
                          className="border rounded px-2 py-1">
                          {t.final_candidates.map((c) => <option key={c.character} value={c.character}>{c.character}</option>)}
                        </select>
                        <button type="button" onClick={() => approve(t)} disabled={approving[t.target_id]}
                          className="bg-orange-500 text-white rounded px-2 py-1 disabled:opacity-50">검수 승인</button>
                        <span className="text-xs text-gray-500">{t.hitl_reason}</span>
                      </div>
                    ) : <span className="text-green-700">자동 확정 후보</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}

function target_id_key(t) {
  return t.target_id;
}
