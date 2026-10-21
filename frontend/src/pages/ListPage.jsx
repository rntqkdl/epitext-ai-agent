import React, { useState, useEffect, useCallback } from "react";
import TableRow from "../components/TableRow";
import { getRubbingList } from "../api/requests";
import { menuToStatus } from "../utils/statusMapper";

const ListPage = ({ onUploadClick, onComplete, onViewDetail, activeMenu }) => {
  const [rubbings, setRubbings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRows, setSelectedRows] = useState([]);
  const [selectAll, setSelectAll] = useState(false);

  // 탁본 목록 데이터 로드
  const loadRubbings = useCallback(async () => {
    setIsLoading(true);
    try {
      const status = menuToStatus(activeMenu);
      const data = await getRubbingList(status);
      setRubbings(data || []);
      console.log(`✅ Loaded ${data?.length || 0} rubbings for menu: ${activeMenu}, status: ${status}`);
    } catch (error) {
      console.error("Failed to load rubbings:", error);
      setRubbings([]);
      // 에러 메시지 표시 (선택사항)
      if (error.response) {
        console.error("API Error:", error.response.status, error.response.data);
      } else if (error.request) {
        console.error("Network Error: 백엔드 서버에 연결할 수 없습니다.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeMenu]);

  useEffect(() => {
    loadRubbings();
  }, [loadRubbings]);

  // rubbings가 변경될 때 selectAll 상태 업데이트
  useEffect(() => {
    if (rubbings.length === 0) {
      setSelectAll(false);
    } else {
      setSelectAll(selectedRows.length === rubbings.length && rubbings.length > 0);
    }
  }, [selectedRows, rubbings]);

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedRows([]);
    } else {
      setSelectedRows(rubbings.map((row) => row.id));
    }
    setSelectAll(!selectAll);
  };

  const handleRowSelect = (id) => {
    if (selectedRows.includes(id)) {
      setSelectedRows(selectedRows.filter((rowId) => rowId !== id));
    } else {
      setSelectedRows([...selectedRows, id]);
    }
  };

  const handleComplete = async () => {
    if (selectedRows.length > 0) {
      await onComplete(selectedRows);
      setSelectedRows([]);
      setSelectAll(false);
      // 데이터 새로고침
      await loadRubbings();
    }
  };

  const isCompleteButtonDisabled = selectedRows.length === 0;

  // 로딩 중일 때 표시
  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center" style={{ backgroundColor: "#F8F8FA" }}>
        <div className="text-gray-600">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto" style={{ backgroundColor: "#F8F8FA" }}>
      <div className="p-12 min-h-screen" style={{ backgroundColor: "#F8F8FA" }}>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-700 mb-4">탁본 복원 목록</h1>

          <div className="flex flex-col gap-2">
            {/* Summary and Actions */}
            <div className="flex items-end justify-between mb-4">
              <div className="flex items-end gap-2">
                <span className="text-base font-medium text-gray-600">전체</span>
                <span className="text-lg font-semibold text-[#ee7542]">
                  {rubbings.length}
                  <span className="text-base text-gray-600 ml-1">건</span>
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Refresh Icon */}
                <button className="h-9 w-9 border border-gray-300 rounded-lg flex items-center justify-center hover:bg-gray-50 transition-colors">
                  <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                </button>

                {/* 복원 완료 버튼 - 항상 표시 */}
                <button
                  onClick={handleComplete}
                  disabled={isCompleteButtonDisabled}
                  className={`h-9 px-3 rounded-[6px] flex items-center gap-1 transition-colors ${
                    isCompleteButtonDisabled
                      ? "bg-[#fce3d9] text-white cursor-not-allowed opacity-100"
                      : "bg-primary-orange text-white hover:bg-[#d66438]"
                  }`}
                  style={isCompleteButtonDisabled ? { opacity: 1 } : {}}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-bold">복원 완료</span>
                </button>

                {/* Add Button */}
                <button
                  onClick={onUploadClick}
                  className="h-9 bg-[#ee7542] text-white px-3 rounded-md flex items-center gap-1.5 hover:bg-[#d66438] transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm font-bold">탁본 해석 추가</span>
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="border border-gray-200 rounded-lg overflow-hidden" style={{ minWidth: "1184px" }}>
              {/* Table Header */}
              <div className="px-4 py-2" style={{ backgroundColor: "#EEEEEE" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    {/* Checkbox */}
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="w-4 h-4 rounded border-gray-300 text-[#ee7542] focus:ring-[#ee7542] cursor-pointer"
                      />
                    </div>

                    {/* Table Headers */}
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      <div className="flex items-center gap-1 cursor-pointer w-[52px] hover:text-gray-700">
                        <span className="text-xs font-medium text-gray-500">번호</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      <div className="flex items-center gap-1 cursor-pointer w-[80px] hover:text-gray-700">
                        <span className="text-xs font-medium text-gray-500">처리 일시</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      <div className="text-xs font-medium text-gray-500 w-[64px]">원본 파일</div>
                      <div className="flex items-center gap-1 cursor-pointer w-[64px] hover:text-gray-700">
                        <span className="text-xs font-medium text-gray-500">상태</span>
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                      <div className="text-xs font-medium text-gray-500 w-[124px]">복원 현황</div>
                      <div className="text-xs font-medium text-gray-500 w-[100px]">처리 시간</div>
                      <div className="text-xs font-medium text-gray-500 w-[100px]">탁본 손상 정도</div>
                      <div className="text-xs font-medium text-gray-500 w-[100px]">검수 현황</div>
                      <div className="text-xs font-medium text-gray-500 w-[100px]">평균 신뢰도</div>
                    </div>
                  </div>

                  {/* Action Buttons Header */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs font-medium text-gray-500 w-20">최종 결과</span>
                    <span className="text-xs font-medium text-gray-500 w-24">복원 시각화</span>
                  </div>
                </div>
              </div>

              {/* Table Body */}
              <div>
                {rubbings.map((row, index) => (
                  <TableRow
                    key={row.id}
                    row={row}
                    index={index}
                    isSelected={selectedRows.includes(row.id)}
                    onSelect={() => handleRowSelect(row.id)}
                    onViewDetail={onViewDetail}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ListPage;
