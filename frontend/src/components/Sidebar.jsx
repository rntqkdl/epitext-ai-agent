import React, { useState } from "react";
import EpitextLogo from "../../epitext logo.svg";

const Sidebar = ({ activeMenu, setActiveMenu }) => {
  const [isDataManagementOpen, setIsDataManagementOpen] = useState(true);

  return (
    <div className="w-40 h-screen bg-[#e2ddda] overflow-y-auto flex-shrink-0">
      {/* Logo */}
      <div className="px-3 py-4">
        <img src={EpitextLogo} alt="EPITEXT" className="h-6" />
      </div>

      {/* Navigation */}
      <nav>
        {/* 데이터 관리 */}
        <div>
          <div
            className={`px-4 py-[12px] cursor-pointer flex items-center justify-between transition-colors ${
              activeMenu === "데이터 관리" || isDataManagementOpen
                ? "bg-[#e2ddda] border-r-2 border-[#ee7542] text-[#ee7542]"
                : "text-gray-700 hover:bg-gray-100"
            }`}
            onClick={() => setIsDataManagementOpen(!isDataManagementOpen)}
          >
            <span className="text-[15px] font-semibold">데이터 관리</span>
            <svg
              className={`w-4 h-4 transition-transform ${isDataManagementOpen ? "rotate-180" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {isDataManagementOpen && (
            <div className="bg-[#eeeeee] flex flex-col gap-[8px]">
              <div className="px-6 pb-[8px] pt-[12px]">
                <span className="text-[12px] font-semibold text-[#a18e7c]">탁본 업로드</span>
              </div>
              <div
                className={`pl-8 pr-0 py-[12px] cursor-pointer transition-colors ${
                  activeMenu === "전체 기록" ? "border-r-2 border-[#ee7542] text-[#ee7542] font-medium" : "text-[#2a2a3a] font-medium"
                }`}
                onClick={() => setActiveMenu("전체 기록")}
              >
                <span className="text-[14px] leading-[16px]">전체 기록</span>
              </div>
              <div
                className={`pl-8 pr-0 py-[12px] cursor-pointer transition-colors ${
                  activeMenu === "복원 진행중" ? "border-r-2 border-[#ee7542] text-[#ee7542] font-medium" : "text-[#2a2a3a] font-medium"
                }`}
                onClick={() => setActiveMenu("복원 진행중")}
              >
                <span className="text-[14px] leading-[16px]">복원 진행중</span>
              </div>
              <div
                className={`pl-8 pr-0 py-[12px] cursor-pointer transition-colors ${
                  activeMenu === "복원 완료" ? "border-r-2 border-[#ee7542] text-[#ee7542] font-medium" : "text-[#2a2a3a] font-medium"
                }`}
                onClick={() => setActiveMenu("복원 완료")}
              >
                <span className="text-[14px] leading-[16px]">복원 완료</span>
              </div>
              <div className="px-6 pb-[8px] pt-[12px]">
                <span className="text-[12px] font-semibold text-[#a18e7c]">탁본 데이터</span>
              </div>
              <div className="pl-8 pr-0 py-[12px] cursor-pointer transition-colors">
                <span className="text-[14px] leading-[16px] font-medium text-[#2a2a3a]">원본 이미지 관리</span>
              </div>
              <div className="pl-8 pr-0 py-[12px] cursor-pointer transition-colors">
                <span className="text-[14px] leading-[16px] font-medium text-[#2a2a3a]">결과물 보관함</span>
              </div>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
};

export default Sidebar;
