"""
EpiText-Agent 상태 스키마 정의 (LangGraph StateGraph 전용)
"""
from typing import TypedDict, List, Dict, Any, Optional


class MaskTargetState(TypedDict):
    """개별 훼손 문자(MASK1 / MASK2)의 복원 상태 및 추론 근거"""
    order: int                                  # 문장 내 마스크 순번
    row_index: int                              # 행 번호 (0-based)
    char_index: int                             # 열 번호 (0-based)
    position: str                               # "1행 2자" 형식
    mask_type: str                              # "MASK2"(부분 훼손) 또는 "MASK1"(완전 훼손)
    surrounding_line: str                       # 해당 행의 원본 문자열 (예: "高□洛□歸法寺住持")
    unmasked_line: str                          # 1차 비전 Unmasking 반영 후 문자열
    vision_top_k: List[Dict[str, Any]]          # Swin V2 예측 결과 [{"token": "麗", "probability": 0.94}, ...]
    mlm_initial_top_k: List[Dict[str, Any]]     # (Before 비교용) Unmasking 전 1회성 MLM 결과
    mlm_refined_top_k: List[Dict[str, Any]]     # (After) Unmasking 후 보강된 문맥 기반 MLM 결과
    is_unmasked_in_step1: bool                  # 1단계에서 고신뢰 비전 결과로 선반영되었는지 여부
    conflict_detected: bool                     # 비전 1순위와 문맥 1순위 충돌 또는 교집합 부재 여부
    rag_evidence: Optional[Dict[str, Any]]      # 사료 RAG 검색 근거 (출처, 해설, 용례, 학설 이견)
    final_candidates: List[Dict[str, Any]]      # 최종 결합 상위 후보 리스트 (DB Candidate 호환)
    top1_char: Optional[str]                    # 최종 1순위 복원 한자
    top1_reliability: float                     # 최종 1순위 신뢰도 (0.0 ~ 100.0)
    hitl_required: bool                         # 전문가 승인(HITL) 필요 여부
    hitl_reason: Optional[str]                  # 전문가 검수가 필요한 사유 ("신뢰도 80% 미만", "학설 이견 존재" 등)


class RubbingAgentState(TypedDict):
    """LangGraph 전체 파이프라인 상태 스키마"""
    rubbing_id: int                             # 대상 탁본 ID
    title: str                                  # 탁본 제목 (예: "귀법사적소수좌현응묘지명")
    inferred_era: str                           # 시대 분류 ("삼국", "고려", "조선")
    text_lines: List[str]                       # 입력 판독 텍스트 행 리스트 ('□' 포함)
    swin_image_path: Optional[str]              # 전처리된 Swin 입력 이미지 경로
    ocr_results: List[Dict[str, Any]]           # OCR 검출 결과 리스트
    targets: List[MaskTargetState]              # 복원 대상 마스크 리스트
    triage_route: str                           # "fast_pass", "vision_first_loop", "mlm_only"
    unmasked_count: int                         # 1단계 비전 선복원(Unmasking) 성공 글자 수
    rag_rescued_count: int                      # 교집합 부재/충돌에서 사료 RAG로 구제된 글자 수
    hitl_pending_orders: List[int]              # 전문가 승인이 필요한 target order 목록
    agent_logs: List[str]                       # 단계별 에이전트 의사결정 추적 로그
    metrics: Dict[str, Any]                     # 추론 시간(ms), 도구 호출 수, 정확도 비교 지표
