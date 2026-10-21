import apiClient from "./client";

const FALLBACK_RUBBINGS = [
  {
    id: 1,
    index: 1,
    status: "우수",
    date: "2026.10.21",
    restorationStatus: "69자 / 복원 대상 14자",
    processingTime: "0분 1초",
    damageLevel: "20.3%",
    inspectionStatus: "10자 완료 (HITL 4자 대기)",
    reliability: "89.6%",
    is_completed: false,
    image_url: "/귀법사적소수좌현응묘지명.png",
    filename: "귀법사적소수좌현응묘지명.png",
  },
];

const FALLBACK_DETAIL = {
  id: 1,
  filename: "귀법사적소수좌현응묘지명.png",
  image_url: "/귀법사적소수좌현응묘지명.png",
  processed_at: "2026-10-21 15:30",
  total_processing_time: 1,
  font_types: ["해서체"],
  damage_percentage: 20.3,
  statistics: {
    total_characters: 69,
    restoration_targets: 14,
    partial_damage: 11,
    complete_damage: 3,
    restoration_percentage: 20.3,
  },
  text_content: [
    "高□洛□歸法寺住持",
    "見性寂炤首□玄應者",
    "立□第十五□肅宗□子",
    "□□歲下元己未二月十",
    "□日甲子薨卒二十一日",
    "壬申茶□以三月□五日",
    "乙酉□舍利□於八德□",
  ],
  text_content_with_punctuation: [
    "高□洛□歸法寺住持,",
    "見性寂炤首□玄應者,",
    "立□第十五□肅宗□子.",
    "□□歲下元己未二月十",
    "□日甲子薨卒, 二十一日",
    "壬申茶□, 以三月□五日",
    "乙酉, □舍利□於八德□.",
  ],
};

const FALLBACK_TARGETS = [
  { id: 1, position: "1행 2자", row_index: 0, char_index: 1, damage_type: "MASK2", inspection: { selected_character: "麗", selected_candidate_id: 101, reliability: 87.7 } },
  { id: 2, position: "1행 4자", row_index: 0, char_index: 3, damage_type: "MASK2", inspection: { selected_character: "西", selected_candidate_id: 201, reliability: 91.8 } },
  { id: 3, position: "2행 6자", row_index: 1, char_index: 5, damage_type: "MASK2", inspection: { selected_character: "座", selected_candidate_id: 301, reliability: 93.6 } },
  { id: 4, position: "3행 2자", row_index: 2, char_index: 1, damage_type: "MASK1", inspection: null },
  { id: 5, position: "3행 6자", row_index: 2, char_index: 5, damage_type: "MASK2", inspection: { selected_character: "王", selected_candidate_id: 501, reliability: 91.1 } },
  { id: 6, position: "3행 9자", row_index: 2, char_index: 8, damage_type: "MASK2", inspection: null },
  { id: 7, position: "4행 1자", row_index: 3, char_index: 0, damage_type: "MASK2", inspection: { selected_character: "乾", selected_candidate_id: 701, reliability: 93.1 } },
  { id: 8, position: "4행 2자", row_index: 3, char_index: 1, damage_type: "MASK1", inspection: { selected_character: "統", selected_candidate_id: 801, reliability: 89.2 } },
  { id: 9, position: "5행 1자", row_index: 4, char_index: 0, damage_type: "MASK1", inspection: null },
  { id: 10, position: "6행 4자", row_index: 5, char_index: 3, damage_type: "MASK2", inspection: { selected_character: "毗", selected_candidate_id: 1001, reliability: 94.6 } },
  { id: 11, position: "6행 8자", row_index: 5, char_index: 7, damage_type: "MASK2", inspection: { selected_character: "十", selected_candidate_id: 1101, reliability: 90.2 } },
  { id: 12, position: "7행 3자", row_index: 6, char_index: 2, damage_type: "MASK2", inspection: { selected_character: "安", selected_candidate_id: 1201, reliability: 85.9 } },
  { id: 13, position: "7행 6자", row_index: 6, char_index: 5, damage_type: "MASK2", inspection: { selected_character: "塔", selected_candidate_id: 1301, reliability: 89.2 } },
  { id: 14, position: "7행 10자", row_index: 6, char_index: 9, damage_type: "MASK2", inspection: { selected_character: "山", selected_candidate_id: 1401, reliability: 94.8 } },
];

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
    console.warn("백엔드 미연결 상태: 내장 금석문 데이터를 반환합니다.");
    return FALLBACK_RUBBINGS;
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
    return FALLBACK_DETAIL;
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
    return FALLBACK_DETAIL.statistics;
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
    return FALLBACK_TARGETS;
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
    const t = FALLBACK_TARGETS.find((item) => item.id === targetId);
    const mainChar = t?.inspection?.selected_character || "朝";
    const mainRel = t?.inspection?.reliability || 84.4;
    const list = [
      { id: targetId * 100 + 1, character: mainChar, stroke_match: 88.6, context_match: mainRel, reliability: mainRel, rank_vision: 1, rank_nlp: 1, model_type: "both" },
      { id: targetId * 100 + 2, character: "統", stroke_match: 72.4, context_match: 89.2, reliability: 79.9, rank_vision: 2, rank_nlp: 2, model_type: "both" },
      { id: targetId * 100 + 3, character: "國", stroke_match: 64.0, context_match: 58.0, reliability: 60.8, rank_vision: 3, rank_nlp: 3, model_type: "both" },
      { id: targetId * 100 + 4, character: "元", stroke_match: 55.0, context_match: 48.0, reliability: 51.3, rank_vision: 4, rank_nlp: 4, model_type: "both" },
      { id: targetId * 100 + 5, character: "惟", stroke_match: 32.0, context_match: 34.0, reliability: 33.0, rank_vision: 5, rank_nlp: 5, model_type: "both" },
    ];
    return { top5: list, all: list };
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
    return {
      imgUrl: "/귀법사적소수좌현응묘지명.png",
      vision: [
        { character: "乾", stroke_match: 88.6, score: 0.886 },
        { character: "統", stroke_match: 72.4, score: 0.724 },
        { character: "國", stroke_match: 64.0, score: 0.64 },
      ],
      nlp: [
        { character: "乾", context_match: 93.1, score: 0.931 },
        { character: "統", context_match: 89.2, score: 0.892 },
        { character: "惟", context_match: 34.0, score: 0.34 },
      ],
    };
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

/**
 * AI 에이전트 Before vs After 벤치마크 및 사료 교차검증 결과 조회
 */
export const getAgentBenchmark = async () => {
  try {
    const response = await apiClient.get("/api/agent/benchmark");
    return response.data;
  } catch (error) {
    console.error("Failed to fetch agent benchmark:", error);
    throw error;
  }
};

/**
 * AI 에이전트 HITL 전문가 승인 처리
 */
export const approveAgentHitl = async (payload) => {
  try {
    const response = await apiClient.post("/api/agent/hitl/approve", payload);
    return response.data;
  } catch (error) {
    console.error("Failed to approve agent HITL:", error);
    throw error;
  }
};
