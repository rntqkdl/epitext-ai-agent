"""
EpiText-Agent 의존성 주입(Dependency Injection) 컨테이너 (SKALA Wave 10, 13, 14 패턴 적용)
- 노드 함수가 전역 상태나 하드코딩된 도구에 암묵적으로 의존하지 않도록,
  SupervisorDeps 데이터클래스에 비전 도구, 문맥 도구, MCP 클라이언트, 사학 해설 LLM 백엔드,
  파이프라인 버전(SUPERVISOR_VERSION=v1|v2)을 담아 주입합니다.
- 환경변수 하나로 백엔드(LLM_BACKEND=fake|ollama|cloud)와 파이프라인 버전(v1/v2)이 무중단 전환됩니다.
"""
import os
from dataclasses import dataclass
from typing import Callable, Any, Optional

from .mcp_client import EpiTextMCPClient
from .tools import (
    vision_swin_tool,
    context_mlm_tool,
    epigraphy_rag_tool,
    ollama_historical_commentary_tool,
)


def fake_commentary_llm(
    line_text: str,
    target_char: str,
    scholarly_conflicts: Optional[list] = None,
    era: str = "고려",
    model: str = "fake-deterministic",
) -> str:
    """테스트 및 오프라인 검증용 결정론적(Fake) 사학 해설 생성기 (비용 0, 지연 0ms)."""
    if scholarly_conflicts and len(scholarly_conflicts) >= 2:
        c1, c2 = scholarly_conflicts[0], scholarly_conflicts[1]
        return (
            f"[FakeLLM 결정론 해설] '{line_text}' 구절은 {c1.get('institution')}의 "
            f"'{c1.get('char')}'({c1.get('rationale')}) 설과 {c2.get('institution')}의 "
            f"'{c2.get('char')}'({c2.get('rationale')}) 설이 대립하므로 원석 잔획 대조가 필요합니다."
        )
    return f"[FakeLLM 결정론 해설] {era}시대 금석문 용례에 따라 '{target_char}' 판독이 타당합니다."


@dataclass
class SupervisorDeps:
    """LangGraph 노드 및 파이프라인에 주입되는 통합 의존성 컨테이너"""
    vision_fn: Callable[..., Any]           # Swin V2 잔여 획 추론 함수
    mlm_fn: Callable[..., Any]              # SikuRoBERTa 문맥 추론 함수
    rag_fn: Callable[..., Any]              # 금석문 사료 RAG 조회 함수
    commentary_fn: Callable[..., str]       # 학설 이견 사학 해설 LLM 함수 (fake / ollama / cloud)
    mcp_client: EpiTextMCPClient            # 금석문 사료 MCP 클라이언트 (Tool/Resource/Prompt)
    llm_backend: str = "ollama"             # "fake" | "ollama" | "cloud"
    version: str = "v2"                     # "v1" (Legacy 선형) | "v2" (LangGraph 5-Node 에이전트)
    execution_mode: str = "mock"            # "mock" (고정 프로파일) | "real" (실제 가중치)


_SINGLETON_DEPS: Optional[SupervisorDeps] = None


def build_supervisor_deps(
    llm_backend: Optional[str] = None,
    version: Optional[str] = None,
    execution_mode: Optional[str] = None,
    flaky_mcp: bool = False,
) -> SupervisorDeps:
    """환경변수 또는 인자에 맞춰 SupervisorDeps 인스턴스를 생성합니다."""
    backend = (llm_backend or os.getenv("LLM_BACKEND", "ollama")).lower()
    ver = (version or os.getenv("SUPERVISOR_VERSION", "v2")).lower()
    mode = (execution_mode or os.getenv("EPITEXT_EXECUTION_MODE", "mock")).lower()

    mcp_client = EpiTextMCPClient(flaky_first_call=flaky_mcp)

    if backend == "fake":
        commentary_fn = fake_commentary_llm
    else:
        commentary_fn = ollama_historical_commentary_tool

    def _mcp_backed_rag(surrounding_line: str, candidate_chars: list, era: str = "고려") -> dict:
        try:
            return mcp_client.call_tool(
                "search_epigraphy_clause",
                {
                    "surrounding_line": surrounding_line,
                    "candidate_chars": candidate_chars,
                    "era": era,
                },
            )
        except Exception:
            return epigraphy_rag_tool(surrounding_line, candidate_chars, era)

    return SupervisorDeps(
        vision_fn=vision_swin_tool,
        mlm_fn=context_mlm_tool,
        rag_fn=_mcp_backed_rag,
        commentary_fn=commentary_fn,
        mcp_client=mcp_client,
        llm_backend=backend,
        version=ver,
        execution_mode=mode,
    )


def get_singleton_deps() -> SupervisorDeps:
    """서버 수명 동안 1회만 생성하여 공유하는 싱글턴 의존성 번들 (Wave 1 패턴)"""
    global _SINGLETON_DEPS
    if _SINGLETON_DEPS is None:
        _SINGLETON_DEPS = build_supervisor_deps()
    return _SINGLETON_DEPS
