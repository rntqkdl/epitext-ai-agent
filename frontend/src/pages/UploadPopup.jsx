import React, { useState, useRef } from "react";
import { uploadRubbing } from "../api/requests";

const UploadPopup = ({ onClose, onComplete }) => {
  const [uploadState, setUploadState] = useState("preset"); // 'preset', 'uploading', 'processing', 'complete', 'error'
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadedRubbing, setUploadedRubbing] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const fileInputRef = useRef(null);
  const dragAreaRef = useRef(null);

  // 드래그 앤 드롭 핸들러
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const files = Array.from(e.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  // 파일 선택 핸들러
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files).filter((file) => file.type.startsWith("image/"));
    if (files.length > 0) {
      handleFiles(files);
    }
  };

  // 파일 추가 버튼 클릭
  const handleAddButtonClick = () => {
    fileInputRef.current?.click();
  };

  // 파일 처리 및 업로드 시작
  const handleFiles = async (files) => {
    if (files.length > 0) {
      const file = files[0]; // 첫 번째 파일만 사용
      setUploadedFile(file);
      setErrorMessage(null);
      await startUpload(file);
    }
  };

  // 실제 업로드 및 처리
  const startUpload = async (file) => {
    try {
      setUploadState("uploading");
      setUploadProgress(0);

      // 파일 업로드 (FormData)
      const response = await uploadRubbing(file);
      
      setUploadProgress(50);
      setUploadedRubbing(response);
      
      // 업로드 완료, 이제 AI 처리 중
      setUploadState("processing");
      setUploadProgress(75);
      
      // 백엔드에서 동기적으로 처리하므로 응답이 오면 완료
      // 실제로는 비동기 처리일 수 있으므로 상태 확인 필요
      setUploadState("complete");
      setUploadProgress(100);
      
    } catch (error) {
      console.error("업로드 실패:", error);
      setUploadState("error");
      setErrorMessage(
        error.response?.data?.error || 
        error.message || 
        "파일 업로드에 실패했습니다."
      );
    }
  };

  // 취소 버튼 (업로드 중일 때만)
  const handleCancel = () => {
    if (uploadState === "uploading" || uploadState === "processing") {
      // 업로드 취소는 실제로는 서버에서 처리 중이므로 완료될 때까지 기다려야 함
      // 여기서는 상태만 리셋
      setUploadState("preset");
      setUploadProgress(0);
      setUploadedFile(null);
      setUploadedRubbing(null);
    }
  };

  // 파일 삭제 (X 버튼)
  const handleDeleteFile = () => {
    setUploadState("preset");
    setUploadProgress(0);
    setTimeRemaining(0);
    setUploadedFile(null);
  };

  // 완료 버튼 클릭
  const handleFinish = () => {
    if (uploadState === "complete" && uploadedRubbing && onComplete) {
      // 업로드된 탁본 정보를 전달
      onComplete(uploadedRubbing);
    }
    onClose();
  };

  return (
    <>
      {/* 오버레이 */}
      <div className="fixed inset-0 bg-black bg-opacity-30 z-40" onClick={onClose} />

      {/* 팝업 */}
      <div className="fixed right-[32px] top-[59px] w-[500px] h-[822px] bg-white rounded-[16px] z-50 overflow-hidden shadow-lg">
        {/* 헤더 */}
        <div className="relative h-[88px] border-b border-[#ebedf8]">
          <button onClick={onClose} className="absolute left-[40px] top-[32px] w-6 h-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M15 18L9 12L15 6" stroke="#2A2A3A" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <h2 className="absolute left-1/2 top-[46px] transform -translate-x-1/2 -translate-y-1/2 text-[20px] font-semibold text-[#2a2a3a]">
            탁본 이미지 업로드
          </h2>

          <button onClick={onClose} className="absolute right-[40px] top-[34px] w-6 h-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6L18 18" stroke="#2A2A3A" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* 컨텐츠 */}
        <div className="p-[40px] flex flex-col h-[calc(100%-88px)]">
          <div className="flex-1">
            {/* Preset 상태: 드래그 앤 드롭 영역 */}
            {uploadState === "preset" && (
              <>
                <div
                  ref={dragAreaRef}
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-[#c0c5dc] rounded-[8px] h-[200px] flex flex-col items-center justify-center mb-4 cursor-pointer hover:border-[#7f85a3] transition-colors"
                  onClick={handleAddButtonClick}
                >
                  <div className="w-[72px] h-[72px] mb-4">
                    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M36 12L48 24H42V48H30V24H24L36 12Z"
                        fill="#C0C5DC"
                        stroke="#C0C5DC"
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path d="M24 24H48M36 12V48" stroke="#C0C5DC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <p className="text-[16px] font-medium text-[#2a2a3a]">이미지 끌어다 놓기</p>
                </div>

                {/* 숨겨진 파일 입력 */}
                <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileSelect} className="hidden" />

                {/* 추가 버튼 */}
                <div className="flex justify-center mb-[283px]">
                  <button onClick={handleAddButtonClick} className="w-6 h-6 hover:opacity-70 transition-opacity">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <circle cx="12" cy="12" r="10" stroke="#2A2A3A" strokeWidth="2" />
                      <path d="M12 8V16M8 12H16" stroke="#2A2A3A" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>
              </>
            )}

            {/* Uploading 상태: 파일 업로드 중 */}
            {(uploadState === "uploading" || uploadState === "processing") && (
              <div className="border border-[#c0c5dc] rounded-[8px] h-[80px] relative mb-4 overflow-hidden">
                {/* 진행 바 배경 */}
                <div className="bg-[#FCE3D9] h-full rounded-l-[8px] transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                {/* 텍스트 및 버튼 */}
                <div className="absolute inset-0 flex items-center justify-between px-6">
                  <div className="flex flex-col">
                    <p className="text-[14px] font-semibold text-[#2a2a3a]">
                      {uploadState === "uploading" ? "업로드 중..." : "AI 처리 중..."}
                    </p>
                    <p className="text-[12px] font-semibold text-[#7f85a3]">
                      {uploadState === "uploading" 
                        ? "파일을 서버에 업로드하고 있습니다..."
                        : "전처리 → OCR → NLP → Swin → 복원 로직 실행 중..."}
                    </p>
                  </div>
                  {(uploadState === "uploading") && (
                    <button onClick={handleCancel} className="w-6 h-6 hover:opacity-70 transition-opacity flex-shrink-0">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" stroke="#2A2A3A" strokeWidth="2" />
                        <path d="M15 9L9 15M9 9L15 15" stroke="#2A2A3A" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Error 상태 */}
            {uploadState === "error" && (
              <div className="border border-red-300 rounded-[8px] h-[80px] relative mb-4 flex items-center justify-between px-6 bg-red-50">
                <div className="flex flex-col">
                  <p className="text-[14px] font-semibold text-red-600">업로드 실패</p>
                  <p className="text-[12px] text-red-500">{errorMessage}</p>
                </div>
                <button onClick={handleDeleteFile} className="w-6 h-6 hover:opacity-70 transition-opacity flex-shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="#DC2626" strokeWidth="2" />
                    <path d="M15 9L9 15M9 9L15 15" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}

            {/* Complete 상태: 업로드 완료 표시 */}
            {uploadState === "complete" && uploadedFile && (
              <div className="border border-[#c0c5dc] rounded-[8px] h-[80px] relative mb-4 flex items-center justify-between px-6">
                <div className="flex flex-col">
                  <p className="text-[14px] font-semibold text-[#2a2a3a]">{uploadedFile.name}</p>
                  <p className="text-[12px] font-semibold text-[#7f85a3]">Upload Completed</p>
                </div>
                <button onClick={handleDeleteFile} className="w-6 h-6 hover:opacity-70 transition-opacity flex-shrink-0">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="12" cy="12" r="10" stroke="#2A2A3A" strokeWidth="2" />
                    <path d="M15 9L9 15M9 9L15 15" stroke="#2A2A3A" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}
          </div>

          {/* 완료 버튼 - 하단 고정 */}
          <button
            onClick={handleFinish}
            disabled={uploadState !== "complete"}
            className={`w-full h-[48px] rounded-[6px] flex items-center justify-center transition-colors mt-auto ${
              uploadState === "complete"
                ? "bg-[#ee7542] hover:bg-[#d66438]"
                : "bg-gray-300 cursor-not-allowed"
            }`}
          >
            <span className={`text-[16px] font-bold ${uploadState === "complete" ? "text-white" : "text-gray-500"}`}>
              {uploadState === "complete" ? "완료" : uploadState === "processing" ? "처리 중..." : "완료"}
            </span>
          </button>
        </div>
      </div>
    </>
  );
};

export default UploadPopup;
