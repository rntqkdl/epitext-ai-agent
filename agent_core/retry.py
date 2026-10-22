"""
EpiText-Agent 지수 백오프 재시도(Retry) 유틸리티 (SKALA Wave 9 패턴 적용)
- MCP 서버 조회 및 로컬 Ollama/클라우드 LLM 호출 시 일시적 타임아웃(Transient Timeout)을 복구합니다.
- Before/After 비교를 위해 누적 재시도 횟수(retry_count)와 복구 지연을 계측합니다.
"""
import time
import logging
from typing import Callable, TypeVar, Any, Dict

logger = logging.getLogger(__name__)
T = TypeVar("T")


class RetryMetrics:
    """실행 중 발생한 재시도 횟수 및 복구 성공 여부를 추적하는 카운터"""
    def __init__(self) -> None:
        self.total_retries: int = 0
        self.recovered_calls: int = 0
        self.failed_calls: int = 0

    def reset(self) -> None:
        self.total_retries = 0
        self.recovered_calls = 0
        self.failed_calls = 0

    def to_dict(self) -> Dict[str, int]:
        return {
            "total_retries": self.total_retries,
            "recovered_calls": self.recovered_calls,
            "failed_calls": self.failed_calls,
        }


GLOBAL_RETRY_METRICS = RetryMetrics()


def with_retry(
    fn: Callable[..., T],
    *args: Any,
    max_attempts: int = 3,
    base_delay_sec: float = 0.02,
    **kwargs: Any,
) -> T:
    """
    일시적 예외(TimeoutError, ConnectionError 등) 발생 시 지수 백오프로 재시도합니다.
    """
    last_err: Exception | None = None
    for attempt in range(1, max_attempts + 1):
        try:
            result = fn(*args, **kwargs)
            if attempt > 1:
                GLOBAL_RETRY_METRICS.recovered_calls += 1
            return result
        except (TimeoutError, ConnectionError, OSError) as err:
            last_err = err
            if attempt >= max_attempts:
                GLOBAL_RETRY_METRICS.failed_calls += 1
                raise
            GLOBAL_RETRY_METRICS.total_retries += 1
            delay = base_delay_sec * (2 ** (attempt - 1))
            logger.warning(
                f"[Retry] {getattr(fn, '__name__', 'callable')} 일시적 오류 ({err}) -> "
                f"{attempt}/{max_attempts}회 재시도 대기 ({delay*1000:.1f}ms)"
            )
            time.sleep(delay)
    if last_err:
        raise last_err
    raise RuntimeError("Unreachable retry state")
