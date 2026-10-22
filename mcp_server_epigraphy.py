"""
EpiText-Agent 금석문 사료 아카이브 MCP 서버 (SKALA Wave 2 표준화 적용)
- Tool     : search_epigraphy_clause (손상 구절 및 후보 한자 기반 동적 사료 대조)
- Resource : epigraphy://corpus/{era} (삼국, 고려, 조선 시대별 정적 금석문 사료 원문 조회)
- Prompt   : epigraphy_arbitration_prompt (비전-문맥 충돌 및 학설 이견 중재 표준 프롬프트)
"""
import json
from pathlib import Path
from typing import List, Dict, Any
from pydantic import BaseModel, Field

try:
    from fastmcp import FastMCP
    mcp = FastMCP(name="epitext-epigraphy-archive")
except ImportError:
    class _FallbackFastMCP:
        """fastmcp 미설치 환경에서도 동일한 데코레이터와 레지스트리를 제공하는 호환 레이어"""
        def __init__(self, name: str) -> None:
            self.name = name
            self.tools: Dict[str, Any] = {}
            self.resources: Dict[str, Any] = {}
            self.prompts: Dict[str, Any] = {}

        def tool(self):
            def decorator(fn):
                self.tools[fn.__name__] = fn
                return fn
            return decorator

        def resource(self, uri_template: str):
            def decorator(fn):
                self.resources[uri_template] = fn
                return fn
            return decorator

        def prompt(self):
            def decorator(fn):
                self.prompts[fn.__name__] = fn
                return fn
            return decorator

        def run(self, **kwargs) -> None:
            pass

    mcp = _FallbackFastMCP(name="epitext-epigraphy-archive")

CORPUS_PATH = Path(__file__).parent / "data" / "epigraphy_corpus.json"


class EpigraphySearchResult(BaseModel):
    doc_id: str = Field(description="사료 문서 고유 ID")
    title: str = Field(description="금석문 사료 명칭")
    era: str = Field(description="시대 (삼국 / 고려 / 조선)")
    year: str = Field(default="", description="건립/찬술 연대")
    source: str = Field(description="출전 기관 및 데이터베이스")
    pattern: str = Field(default="", description="결락 포함 원문 구절")
    restored: str = Field(default="", description="사료 대조 복원 구절")
    verified_chars: List[str] = Field(default_factory=list, description="사료에서 검증된 후보 한자")
    target_chars: List[str] = Field(default_factory=list, description="사료 기준 결락 위치 한자")
    commentary: str = Field(description="사료 고증 해설")
    scholarly_conflicts: List[Dict[str, str]] = Field(default_factory=list, description="기관별 판독 학설 이견")
    grounding_score: float = Field(description="사료 근거 일치 점수 (0.0 ~ 1.0)")


def _load_corpus_data() -> Dict[str, Any]:
    if not CORPUS_PATH.exists():
        return {"records": []}
    return json.loads(CORPUS_PATH.read_text(encoding="utf-8"))


@mcp.tool()
def search_epigraphy_clause(
    surrounding_line: str,
    candidate_chars: List[str],
    era: str = "고려",
) -> Dict[str, Any]:
    """손상된 금석문 행과 비전/문맥 후보 한자를 입력받아 동시대 사료 용례 및 학설 이견을 조회합니다."""
    corpus = _load_corpus_data()
    records = corpus.get("records", [])
    era_records = [r for r in records if r.get("era") == era] or records

    best_match = None
    best_score = 0
    clean_line = surrounding_line.replace("，", "").replace("。", "").strip()

    for rec in era_records:
        for clause in rec.get("clauses", []):
            keywords = clause.get("context_keywords", [])
            matched_kw = sum(1 for kw in keywords if kw in clean_line)
            if clause.get("pattern") == clean_line:
                matched_kw += 5

            if matched_kw > best_score:
                best_score = matched_kw
                result_obj = EpigraphySearchResult(
                    doc_id=rec.get("doc_id", "UNKNOWN"),
                    title=rec.get("title", ""),
                    era=rec.get("era", era),
                    year=rec.get("year", ""),
                    source=rec.get("source", ""),
                    pattern=clause.get("pattern", ""),
                    restored=clause.get("restored", ""),
                    verified_chars=[c for c in candidate_chars if c in clause.get("target_chars", [])],
                    target_chars=clause.get("target_chars", []),
                    commentary=clause.get("commentary", ""),
                    scholarly_conflicts=clause.get("scholarly_conflicts", []),
                    grounding_score=min(0.98, 0.70 + 0.05 * matched_kw),
                )
                best_match = result_obj.model_dump()

    if best_match:
        return best_match

    return EpigraphySearchResult(
        doc_id="NONE",
        title="일치 사료 미발견",
        era=era,
        source="국사편찬위원회 금석문 통합 검색",
        commentary="동시대 금석문 코퍼스에서 직접 일치하는 관용구가 발견되지 않아 전문가 수기 고증이 요구됨.",
        grounding_score=0.0,
    ).model_dump()


@mcp.resource("epigraphy://corpus/{era}")
def get_era_epigraphy_resource(era: str) -> str:
    """특정 시대(삼국, 고려, 조선)의 금석문 사료 레코드 원문(정적 Resource)을 반환합니다."""
    corpus = _load_corpus_data()
    records = [r for r in corpus.get("records", []) if r.get("era") == era]
    if not records:
        return f"# Epigraphy Corpus Not Found\n\nNo records registered for era: {era}"
    lines = [f"# {era}시대 금석문 사료 코퍼스 ({len(records)}건)"]
    for rec in records:
        lines.append(f"## [{rec.get('doc_id')}] {rec.get('title')} ({rec.get('year')})")
        lines.append(f"- 출전: {rec.get('source')}")
        lines.append(f"- 전문: {rec.get('full_text')}")
    return "\n".join(lines)


@mcp.prompt()
def epigraphy_arbitration_prompt(
    era: str,
    line_text: str,
    vision_top1: str,
    mlm_top1: str,
) -> str:
    """비전 후보와 문맥 후보가 충돌할 때 사료 근거를 대조하는 표준 중재 프롬프트."""
    return f"""다음 금석문 결락 구간의 모델 간 판독 불일치에 대해 표준 사료 고증 절차를 수행하세요.

## 판독 대상 정보
- 시대 분류: {era}
- 원문 구절: {line_text}
- 시각 잔여 획 1순위(Swin V2): {vision_top1}
- 문맥 언어 모델 1순위(SikuRoBERTa): {mlm_top1}

## 표준 고증 절차 (반드시 순서대로 수행)
1. search_epigraphy_clause Tool을 호출하여 해당 구절의 금석문 용례와 검증 한자를 확인하세요.
2. epigraphy://corpus/{era} Resource를 참조하여 당대 관직명, 지명, 연호 표기 관례를 대조하세요.
3. 기관 간 학설 이견(scholarly_conflicts)이 존재할 경우 단일 정답을 강제하지 말고 양측 근거를 병기하여 HITL 검수로 분류하세요.
"""


if __name__ == "__main__":
    try:
        mcp.run(show_banner=False)
    except TypeError:
        mcp.run()
