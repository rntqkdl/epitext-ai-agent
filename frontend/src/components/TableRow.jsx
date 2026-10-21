import React from "react";
import { downloadRubbing } from "../api/requests";

const StatusBadge = ({ status }) => {
  const statusConfig = {
    처리중: { color: "#484A64", bgColor: "#484A64" },
    우수: { color: "#50D192", bgColor: "#50D192" },
    양호: { color: "#FCDB65", bgColor: "#FCDB65" },
    미흡: { color: "#F87563", bgColor: "#F87563" },
  };

  const config = statusConfig[status] || statusConfig["처리중"];

  return (
    <div className="flex items-center gap-2">
      <div className="w-[8px] h-[8px] rounded-full flex-shrink-0" style={{ backgroundColor: config.bgColor }} />
      <span className="text-xs font-medium text-[#484a64]">{status}</span>
    </div>
  );
};

const ActionButton = ({ type, disabled = false, status, borderColor = "#fafbfd", onClick }) => {
  // 최종 결과 버튼은 "처리중" 상태일 때만 비활성화
  // 복원 시각화 버튼은 "처리중" 상태일 때만 비활성화
  const isDisabled = disabled;

  return (
    <button
      className={`px-[10px] py-2 rounded-[4px] flex items-center gap-1 text-xs font-medium transition-colors bg-white border ${
        isDisabled
          ? `border-[${borderColor}] text-[#fbddd0] cursor-not-allowed`
          : `border-[${borderColor}] text-primary-orange hover:bg-gray-50`
      }`}
      style={{
        borderColor: borderColor,
      }}
      disabled={isDisabled}
      onClick={onClick}
    >
      {type === "result" ? (
        <svg className="w-[14px] h-[14px]" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
      ) : (
        <svg className="w-[14px] h-[14px]" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
        </svg>
      )}
      <span>{type === "result" ? "최종 결과" : "복원 시각화"}</span>
    </button>
  );
};

const TableRow = ({ row, index, isSelected, onSelect, onViewDetail }) => {
  const { id, status, date, restorationStatus, processingTime, damageLevel, inspectionStatus, reliability, filename } = row;

  // 원본 파일 다운로드 핸들러
  const handleDownload = async (e) => {
    e.stopPropagation(); // 행 클릭 이벤트 방지
    try {
      const downloadFilename = filename || `rubbing_${id}.jpg`;
      await downloadRubbing(id, downloadFilename);
    } catch (err) {
      console.error("다운로드 실패:", err);
      alert("파일 다운로드에 실패했습니다.");
    }
  };

  // 복원 시각화 버튼은 현재 구현되지 않았으므로 모든 경우에 비활성화
  const isRestoreDisabled = true;

  // 최종 결과 버튼 border 색상 (활성화 시 #ebedf8, 비활성화 시 #fafbfd)
  const resultBorderColor = status === "처리중" ? "#fafbfd" : "#ebedf8";
  // 탁본 복원 버튼 border 색상 (활성화 시 #ebedf8, 비활성화 시 #fafbfd)
  const restoreBorderColor = isRestoreDisabled ? "#fafbfd" : "#ebedf8";

  return (
    <div className="px-4 py-2 bg-white transition-colors" style={{ borderBottom: "1px solid #F6F7FE" }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 flex-1">
          {/* Checkbox */}
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onSelect}
              className="w-4 h-4 rounded border-gray-300 text-[#ee7542] focus:ring-[#ee7542] cursor-pointer"
            />
          </div>

          {/* Table Data */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            {/* 번호 - 1부터 시작하는 인덱스 */}
            <span className="text-xs font-medium text-gray-600 w-[52px]">{index + 1}</span>

            {/* 처리 일시 */}
            <span className="text-xs font-medium text-gray-600 w-[80px]">{date}</span>

            {/* 원본 파일 */}
            <div className="w-[64px]">
              <button
                onClick={handleDownload}
                className="text-primary-orange hover:opacity-80 transition-opacity cursor-pointer"
                title="원본 파일 다운로드"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>

            {/* 상태 */}
            <div className="w-[64px]">
              <StatusBadge status={status} />
            </div>

            {/* 복원 현황 */}
            <span className="text-xs text-gray-500 w-[124px]">{restorationStatus}</span>

            {/* 처리 시간 */}
            <span className="text-xs text-gray-700 w-[100px]">{processingTime}</span>

            {/* 탁본 손상 정도 */}
            <span className="text-xs font-medium text-gray-600 w-[100px]">{damageLevel}</span>

            {/* 검수 현황 */}
            <span className="text-xs text-gray-500 w-[100px]">{inspectionStatus}</span>

            {/* 평균 신뢰도 */}
            <span className="text-xs text-gray-500 w-[100px]">{reliability}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <ActionButton
            type="result"
            disabled={status === "처리중"}
            status={status}
            borderColor={resultBorderColor}
            onClick={() => status !== "처리중" && onViewDetail && onViewDetail(row)}
          />
          <ActionButton type="restore" disabled={isRestoreDisabled} status={status} borderColor={restoreBorderColor} />
        </div>
      </div>
    </div>
  );
};

export default TableRow;
