#!/usr/bin/env bash
# ==============================================================================
# EpiText-Agent Day 3 발표 및 실시간 시연 원클릭 기동 스크립트 (run_demo.sh)
# - 사용법:
#   1) 프리플라이트 점검 및 벤치마크만 실행 : bash run_demo.sh --verify
#   2) 전체 시연 서버(Backend + Frontend) 기동 : bash run_demo.sh
#   3) Legacy v1 파이프라인 토글 실행       : SUPERVISOR_VERSION=v1 bash run_demo.sh --verify
#   4) Fake 결정론 백엔드 토글 실행         : LLM_BACKEND=fake bash run_demo.sh --verify
# ==============================================================================
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

export LLM_BACKEND="${LLM_BACKEND:-ollama}"
export SUPERVISOR_VERSION="${SUPERVISOR_VERSION:-v2}"
export EPITEXT_EXECUTION_MODE="${EPITEXT_EXECUTION_MODE:-mock}"

PYTHON_BIN="/opt/homebrew/opt/python@3.11/bin/python3.11"
if [ ! -x "$PYTHON_BIN" ]; then
    PYTHON_BIN="$(which python3)"
fi

echo "=============================================================================="
echo " [EpiText-Agent] SKALA AI 서비스 개발 Mini-Project 시연 환경 점검"
echo "------------------------------------------------------------------------------"
echo " - 루트 경로          : $ROOT_DIR"
echo " - Python 인터프리터  : $PYTHON_BIN"
echo " - SUPERVISOR_VERSION : $SUPERVISOR_VERSION (v1: Legacy 선형 / v2: LangGraph 5-Node)"
echo " - LLM_BACKEND        : $LLM_BACKEND (fake / ollama / cloud)"
echo "=============================================================================="

# 1. 로컬 Ollama 상태 점검
if curl -s http://localhost:11434/api/tags >/dev/null 2>&1; then
    echo "[OK] 로컬 Ollama 서버(http://localhost:11434) 정상 실행 중"
else
    echo "[WARN] 로컬 Ollama 서버가 응답하지 않습니다. (Fake/오프라인 캐시 Fallback 활성화)"
fi

# 2. 단위 테스트 8종 및 Before/After 벤치마크 검증
echo ""
echo "[Step 1] 단위 테스트(8종) 및 Before/After 비교 벤치마크 검증 실행..."
"$PYTHON_BIN" -m unittest discover -s tests -v

echo ""
echo "[Step 2] 동일 입력(귀법사적소수좌현응묘지명 14자) Before/After 수치 요약:"
"$PYTHON_BIN" -c "
from agent_core import run_before_after_benchmark
b = run_before_after_benchmark()['summary']
print(f\"  - 복원 정확도 (14자 기준) : Before {b['before_accuracy_pct']}% -> After {b['after_accuracy_pct']}% (+{b['accuracy_gain_pct_p']}%p)\")
print(f\"  - 파이프라인 처리 지연    : Before {b['before_elapsed_ms']}ms -> After {b['after_elapsed_ms']}ms (-{b['latency_reduction_pct']}%)\")
print(f\"  - 1단계 비전 Unmasking    : {b['unmasked_step1_count']}자 문맥 선반영\")
print(f\"  - MCP 사료 RAG 구제       : {b['rag_rescued_count']}자 구제 (일시적 타임아웃 Retry 자동 복구: {b['mcp_recovered_calls']}회)\")
print(f\"  - 전문가 수동 검수(HITL)  : Before {b['before_manual_review_count']}건 -> After {b['after_hitl_review_count']}건 (-{b['review_workload_reduction_pct']}%)\")
print(f\"  - 외부 클라우드 API 비용  : Before \${b['before_cloud_api_cost_usd']} -> After \${b['after_local_ollama_cost_usd']} (로컬 Ollama 전환)\")
"

if [ "${1:-}" = "--verify" ]; then
    echo ""
    echo "=============================================================================="
    echo " [검증 완료] 모든 단위 테스트 및 벤치마크 검증이 정상 통과되었습니다."
    echo "=============================================================================="
    exit 0
fi

# 3. 프론트엔드(Vite) 기동 안내 및 실행
cleanup() {
    echo ""
    echo "[종료] 시연 프로세스를 정리합니다..."
    [ -n "${FE_PID:-}" ] && kill "$FE_PID" 2>/dev/null || true
    [ -n "${BE_PID:-}" ] && kill "$BE_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

if [ -d "$ROOT_DIR/frontend" ] && command -v npm >/dev/null 2>&1; then
    echo ""
    echo "[Step 3] Frontend (Vite, http://localhost:5173/agent-review) 기동 중..."
    (cd "$ROOT_DIR/frontend" && npm run dev -- --port 5173) &
    FE_PID=$!
fi

echo ""
echo "=============================================================================="
echo " 브라우저 시연 주소 :"
echo "  - 에이전트 검수함 (과제 2 메인) : http://localhost:5173/agent-review"
echo "  - 기존 복원 상세 (클러스터 뷰)  : http://localhost:5173/detail/1"
echo " 종료하려면 Ctrl + C 를 누르세요."
echo "=============================================================================="
wait
