"""
EpiText-Agent MCP 클라이언트 (SKALA Wave 2 다중 Capability 탐색 및 Wave 9 Retry 결합)
- Tool     : search_epigraphy_clause
- Resource : epigraphy://corpus/{era}
- Prompt   : epigraphy_arbitration_prompt
- LangSmith @traceable 데코레이터를 통해 도구/리소스/프롬프트 호출 계층을 기록합니다.
"""
from typing import Dict, Any, List, Tuple

try:
    from langsmith import traceable
except ImportError:
    def traceable(*args, **kwargs):
        def decorator(fn):
            return fn
        return decorator

from .retry import with_retry
import mcp_server_epigraphy as epigraphy_srv


class EpiTextMCPClient:
    """
    금석문 사료 MCP 서버(epitext-epigraphy-archive)와 통신하는 클라이언트.
    flaky_first_call=True 설정 시 최초 1회 호출에서 일시적 TimeoutError를 발생시켜
    with_retry 지수 백오프 복구 메커니즘을 검증합니다.
    """
    def __init__(self, flaky_first_call: bool = False) -> None:
        self._flaky_pending = flaky_first_call
        self.connected_servers = {
            "epigraphy_ops": epigraphy_srv.mcp,
        }

    @traceable(run_type="tool", name="mcp.find_resource_template")
    def find_resource_template(self, uri_prefix: str = "epigraphy://corpus/") -> Tuple[str, str]:
        """연결된 MCP 서버 목록에서 요청한 URI 템플릿을 제공하는 서버를 동적으로 탐색합니다."""
        for server_name in self.connected_servers:
            if uri_prefix.startswith("epigraphy://"):
                return server_name, "epigraphy://corpus/{era}"
        raise ValueError(f"Resource template not found for prefix: {uri_prefix}")

    @traceable(run_type="tool", name="mcp.find_prompt")
    def find_prompt(self, prompt_name: str = "epigraphy_arbitration_prompt") -> str:
        """연결된 MCP 서버 목록에서 지정된 표준 프롬프트를 보유한 서버 이름을 반환합니다."""
        for server_name in self.connected_servers:
            if hasattr(epigraphy_srv, prompt_name):
                return server_name
        raise ValueError(f"Prompt '{prompt_name}' not found in connected MCP servers")

    def _raw_call_tool(self, name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        if self._flaky_pending and name == "search_epigraphy_clause":
            self._flaky_pending = False
            raise TimeoutError("Simulated transient MCP timeout (Wave 9 retry verification)")
        if name == "search_epigraphy_clause":
            return epigraphy_srv.search_epigraphy_clause(**arguments)
        raise ValueError(f"Unknown MCP tool: {name}")

    @traceable(run_type="tool", name="mcp.call_tool")
    def call_tool(self, name: str, arguments: Dict[str, Any], max_attempts: int = 3) -> Dict[str, Any]:
        """지수 백오프 재시도(with_retry)를 적용하여 MCP Tool을 호출합니다."""
        return with_retry(self._raw_call_tool, name, arguments, max_attempts=max_attempts)

    @traceable(run_type="tool", name="mcp.read_resource")
    def read_resource(self, era: str) -> str:
        """시대별 금석문 코퍼스 정적 Resource를 조회합니다."""
        self.find_resource_template("epigraphy://corpus/")
        return epigraphy_srv.get_era_epigraphy_resource(era=era)

    @traceable(run_type="tool", name="mcp.get_prompt")
    def get_prompt(self, era: str, line_text: str, vision_top1: str, mlm_top1: str) -> str:
        """비전-문맥 충돌 중재용 표준 MCP Prompt를 조회합니다."""
        self.find_prompt("epigraphy_arbitration_prompt")
        return epigraphy_srv.epigraphy_arbitration_prompt(
            era=era,
            line_text=line_text,
            vision_top1=vision_top1,
            mlm_top1=mlm_top1,
        )
