import axios from "axios";

// Axios 기본 인스턴스 생성
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  // AI 파이프라인 실행 시간이 길 수 있으므로 타임아웃 제거 (무제한)
  timeout: 0, // 0 = 무제한
  headers: {
    "Content-Type": "application/json",
  },
});

export default apiClient;
