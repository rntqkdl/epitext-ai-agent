import apiClient from "./client";

/**
 * 날짜 포맷팅 (YYYY-MM-DD -> YYYY.MM.DD)
 */
export const formatDate = (dateString) => {
  if (!dateString) return "-";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
};

/**
 * 처리 시간 포맷팅 (초 -> X분 Y초)
 */
export const formatProcessingTime = (seconds) => {
  if (!seconds) return "-";
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}분 ${secs}초`;
};

/**
 * 탁본 목록 조회
 * @param {string|null} status - 필터링할 상태 ("completed", "in_progress" 등)
 * @returns {Promise} 탁본 목록 데이터
 */
export const getRubbingList = async (status = null) => {
  try {
    const params = status ? { status } : {};
    const response = await apiClient.get("/api/rubbings", { params });

    // 백엔드가 이미 포맷팅된 데이터를 반환하므로 그대로 사용
    // 필요시 추가 변환만 수행
    console.log("📦 백엔드 응답 데이터:", response.data);
    const formattedData = (response.data || []).map((item) => ({
      id: item.id,
      status: item.status || "처리중",
      date: item.created_at || "-",
      restorationStatus: item.restoration_status || "-",
      processingTime: item.processing_time || "-",
      damageLevel: item.damage_level || "-",
      inspectionStatus: item.inspection_status || "-",
      reliability: item.average_reliability || "-",
      is_completed: item.is_completed || false,
      image_url: item.image_url,
      filename: item.filename,
      index: item.index, // 테이블 번호
    }));
    console.log("✅ 변환된 데이터:", formattedData);

    return formattedData;
  } catch (error) {
    console.error("Failed to fetch rubbings:", error);
    throw error;
  }
};

/**
 * 탁본 상세 정보 조회
 * @param {number} id - 탁본 ID
 * @returns {Promise} 탁본 상세 정보
 */
export const getRubbingDetail = async (id) => {
  try {
    const response = await apiClient.get(`/api/rubbings/${id}`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch rubbing detail:", error);
    throw error;
  }
};

/**
 * 탁본 통계 조회
 * @param {number} id - 탁본 ID
 * @returns {Promise} 탁본 통계 정보
 */
export const getRubbingStatistics = async (id) => {
  try {
    const response = await apiClient.get(`/api/rubbings/${id}/statistics`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch rubbing statistics:", error);
    throw error;
  }
};

/**
 * 복원 대상 목록 조회
 * @param {number} id - 탁본 ID
 * @returns {Promise} 복원 대상 목록
 */
export const getRestorationTargets = async (id) => {
  try {
    const response = await apiClient.get(`/api/rubbings/${id}/restoration-targets`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch restoration targets:", error);
    throw error;
  }
};

/**
 * 후보 한자 목록 조회
 * @param {number} rubbingId - 탁본 ID
 * @param {number} targetId - 복원 대상 ID
 * @returns {Promise} 후보 한자 목록
 */
export const getCandidates = async (rubbingId, targetId) => {
  try {
    const response = await apiClient.get(`/api/rubbings/${rubbingId}/targets/${targetId}/candidates`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch candidates:", error);
    throw error;
  }
};

/**
 * 유추 근거 데이터 조회
 * @param {number} rubbingId - 탁본 ID
 * @param {number} targetId - 복원 대상 ID
 * @returns {Promise} 유추 근거 데이터
 */
export const getReasoning = async (rubbingId, targetId) => {
  try {
    const response = await apiClient.get(`/api/rubbings/${rubbingId}/targets/${targetId}/reasoning`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch reasoning:", error);
    throw error;
  }
};

/**
 * 검수 결과 저장
 * @param {number} rubbingId - 탁본 ID
 * @param {number} targetId - 복원 대상 ID
 * @param {string} selectedCharacter - 선택된 한자
 * @param {number} selectedCandidateId - 선택된 후보 ID
 * @returns {Promise} 검수 결과
 */
export const inspectTarget = async (rubbingId, targetId, selectedCharacter, selectedCandidateId) => {
  try {
    const response = await apiClient.post(`/api/rubbings/${rubbingId}/targets/${targetId}/inspect`, {
      selected_character: selectedCharacter,
      selected_candidate_id: selectedCandidateId,
    });
    return response.data;
  } catch (error) {
    console.error("Failed to inspect target:", error);
    throw error;
  }
};

/**
 * 복원 완료 처리
 * @param {number[]} selectedIds - 복원 완료할 탁본 ID 배열
 * @returns {Promise} 처리 결과
 */
export const completeRubbings = async (selectedIds) => {
  try {
    const response = await apiClient.post("/api/rubbings/complete", {
      selected_ids: selectedIds,
    });
    return response.data;
  } catch (error) {
    console.error("Failed to complete rubbings:", error);
    throw error;
  }
};

/**
 * 탁본 이미지 업로드
 * @param {File} file - 업로드할 이미지 파일
 * @returns {Promise} 업로드 결과
 */
export const uploadRubbing = async (file) => {
  try {
    const formData = new FormData();
    formData.append("file", file);

    const response = await apiClient.post("/api/rubbings/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return response.data;
  } catch (error) {
    console.error("Failed to upload rubbing:", error);
    throw error;
  }
};

/**
 * 탁본 원본 파일 다운로드
 * @param {number} id - 탁본 ID
 * @param {string} filename - 다운로드할 파일명
 * @returns {Promise} 다운로드 결과
 */
export const downloadRubbing = async (id, filename) => {
  try {
    const response = await apiClient.get(`/api/rubbings/${id}/download`, {
      responseType: "blob", // 파일 다운로드를 위해 blob 타입 사용
    });

    // Blob을 다운로드 링크로 변환
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return { success: true };
  } catch (error) {
    console.error("Failed to download rubbing:", error);
    throw error;
  }
};

/**
 * 번역 조회
 * @param {number} rubbingId - 탁본 ID
 * @param {number} targetId - 복원 대상 ID
 * @returns {Promise} 번역 결과
 */
export const getTranslation = async (rubbingId, targetId) => {
  try {
    const response = await apiClient.get(`/api/rubbings/${rubbingId}/targets/${targetId}/translation`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch translation:", error);
    throw error;
  }
};

/**
 * 번역 미리보기 (선택된 한자로 실시간 번역)
 * @param {number} rubbingId - 탁본 ID
 * @param {number} targetId - 복원 대상 ID
 * @param {string} selectedCharacter - 선택된 한자
 * @returns {Promise} 번역 결과
 */
export const previewTranslation = async (rubbingId, targetId, selectedCharacter) => {
  try {
    const response = await apiClient.post(`/api/rubbings/${rubbingId}/targets/${targetId}/preview-translation`, {
      selected_character: selectedCharacter,
    });
    return response.data;
  } catch (error) {
    console.error("Failed to preview translation:", error);
    throw error;
  }
};
