"""
EpiText-Agent Core Package
"""
from .state import RubbingAgentState, MaskTargetState
from .deps import SupervisorDeps, build_supervisor_deps, get_singleton_deps, fake_commentary_llm
from .mcp_client import EpiTextMCPClient
from .retry import with_retry, GLOBAL_RETRY_METRICS
from .tools import (
    diagnose_and_reprocess_ocr_line,
    evaluate_reversible_hypothesis,
)
from .graph import (
    build_epitext_agent_graph,
    run_epitext_agent,
    run_legacy_pipeline,
    run_before_after_benchmark,
)

__all__ = [
    "RubbingAgentState",
    "MaskTargetState",
    "SupervisorDeps",
    "build_supervisor_deps",
    "get_singleton_deps",
    "fake_commentary_llm",
    "EpiTextMCPClient",
    "with_retry",
    "GLOBAL_RETRY_METRICS",
    "diagnose_and_reprocess_ocr_line",
    "evaluate_reversible_hypothesis",
    "build_epitext_agent_graph",
    "run_epitext_agent",
    "run_legacy_pipeline",
    "run_before_after_benchmark",
]
