# -*- coding: utf-8 -*-
"""
================================================================================
Ollama & Gemini 기반 한문 금석문 번역 및 사료 해설 엔진
================================================================================
모듈명: translation_engine.py (v2.0.0 - Ollama Local First)
목적: 로컬 Ollama(Qwen 2.5) 기반 금석문 번역 및 클라우드 LLM Fallback
================================================================================
"""
import os
import json
import logging
import re
import urllib.request
import urllib.error
from pathlib import Path
from typing import Dict, Optional

try:
    from google import genai
    from google.genai import types
    HAS_GEMINI = True
except ImportError:
    HAS_GEMINI = False
    logging.warning("[TRANSLATION] google-genai 패키지가 설치되지 않았습니다.")

# 프롬프트 로드
from .translation.prompts import SYSTEM_PROMPT, FEW_SHOT_EXAMPLES

# ================================================================================
# Logging Configuration
# ================================================================================
logger = logging.getLogger(__name__)

# ================================================================================
# Translation Engine
# ================================================================================
class TranslationEngine:
    """
    Gemini API 기반 한문 금석문 번역 엔진
    
    싱글톤 패턴으로 클라이언트를 한 번만 초기화하여 메모리 효율성 향상
    """
    
    def __init__(self, config_path: Optional[str] = None):
        """
        번역 엔진 초기화
        
        Args:
            config_path: 설정 파일 경로 (None이면 기본 경로 사용)
        """
        self.config = self._load_config(config_path)
        
        # Ollama 설정 (로컬 우선)
        models_cfg = self.config.get("models", {})
        self.ollama_base_url = os.getenv("OLLAMA_BASE_URL") or models_cfg.get("ollama_base_url", "http://localhost:11434")
        self.preferred_ollama_model = os.getenv("OLLAMA_MODEL", "qwen2.5:7b")
        
        # 클라우드 API 키 로드 (Fallback용)
        self.api_key = os.getenv("GEMINI_TRANSLATION_API_KEY") or os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            self.client = None
        else:
            if not HAS_GEMINI:
                self.client = None
            else:
                try:
                    self.client = genai.Client(api_key=self.api_key)
                    logger.info("[TRANSLATION] Gemini Client 초기화 완료 (Fallback용)")
                except Exception as e:
                    logger.error(f"[TRANSLATION] Client 초기화 실패: {e}")
                    self.client = None
    
    def _load_config(self, config_path: Optional[str]) -> Dict:
        """설정 파일 로드"""
        if config_path is None:
            config_path = str(Path(__file__).parent / "config" / "translation_config.json")
        
        with open(config_path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _call_ollama(self, model_name: str, user_prompt: str, system_prompt: str) -> Optional[str]:
        """로컬 Ollama API 호출"""
        try:
            url = f"{self.ollama_base_url.rstrip('/')}/api/generate"
            payload = {
                "model": model_name,
                "system": system_prompt,
                "prompt": user_prompt,
                "stream": False,
                "options": {
                    "temperature": 0.1,
                    "num_predict": 600,
                }
            }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"}
            )
            with urllib.request.urlopen(req, timeout=40) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                return data.get("response", "").strip()
        except Exception as e:
            logger.warning(f"[TRANSLATION] Ollama ({model_name}) 호출 실패: {e}")
            return None
    
    def translate(self, text: str) -> Dict:
        """
        한문 텍스트 번역 수행 (Ollama 로컬 우선 -> 클라우드 Gemini Fallback)
        
        Args:
            text: 번역할 한문 텍스트
            
        Returns:
            Dict: {
                'success': bool,
                'reading': str (음독),
                'entities': str (고유명사),
                'translation': str (최종 번역),
                'model': str (사용된 모델),
                'error': str (실패 시)
            }
        """
        if not text or not text.strip():
            return {"success": False, "error": "Empty input text"}
        
        # 프롬프트 구성
        user_prompt = f"""{FEW_SHOT_EXAMPLES}

<new_translation>

<input>{text}</input>

<output>"""
        
        model_candidates = self.config.get('models', {}).get('candidates', ["qwen2.5:7b", "qwen2.5:1.5b"])
        gen_config = self.config.get('models', {}).get('generation_config', {})
        
        # 1. Ollama 로컬 모델 우선 시도
        for model_name in model_candidates:
            if "gemini" not in model_name.lower():
                logger.info(f"[TRANSLATION] Ollama 모델 시도 중: {model_name}")
                raw_response = self._call_ollama(model_name, user_prompt, SYSTEM_PROMPT)
                if raw_response:
                    parsed = self._parse_full_result(raw_response)
                    if parsed and parsed.get("translation"):
                        parsed['success'] = True
                        parsed['model'] = f"ollama/{model_name}"
                        logger.info(f"[TRANSLATION] Ollama 번역 성공: {model_name}")
                        return parsed

        # 2. 클라우드 Gemini API Fallback
        if self.client:
            for model_name in model_candidates:
                if "gemini" in model_name.lower():
                    try:
                        logger.info(f"[TRANSLATION] Gemini Fallback 시도 중: {model_name}")
                        response = self.client.models.generate_content(
                            model=model_name,
                            contents=user_prompt,
                            config=types.GenerateContentConfig(
                                system_instruction=SYSTEM_PROMPT,
                                **gen_config
                            )
                        )
                        full_result = response.text.strip()
                        parsed = self._parse_full_result(full_result)
                        if parsed:
                            parsed['success'] = True
                            parsed['model'] = model_name
                            logger.info(f"[TRANSLATION] Gemini 번역 성공: {model_name}")
                            return parsed
                    except Exception as e:
                        logger.warning(f"[TRANSLATION] Gemini ({model_name}) 실패: {e}")
                        continue
        
        return {"success": False, "error": "All translation engines (Ollama & Gemini) failed"}
    
    def _parse_full_result(self, text: str) -> Optional[Dict]:
        """
        LLM 응답에서 음독, 고유명사, 번역을 모두 추출
        
        Args:
            text: LLM 응답 텍스트
            
        Returns:
            Optional[Dict]: 파싱된 결과 또는 None
        """
        try:
            # 정규표현식으로 각 섹션 추출
            # 예: [음독]: ... \n [고유명사 추출]: ...
            reading_match = re.search(r'\[음독\]:\s*(.*?)(?=\n\[|$)', text, re.DOTALL)
            entities_match = re.search(r'\[고유명사 추출\]:\s*(.*?)(?=\n\[|$)', text, re.DOTALL)
            translation_match = re.search(r'\[최종 번역\]:\s*(.*?)(?=\n\[|$|</output>)', text, re.DOTALL)
            
            # 최종 번역이 없으면 실패로 간주
            if not translation_match:
                logger.warning("[TRANSLATION] 최종 번역 섹션을 찾을 수 없습니다.")
                return None
            
            # 태그 제거 및 공백 정리
            def clean(s): 
                if not s:
                    return ""
                return s.replace("</output>", "").replace("</example>", "").strip()
            
            return {
                "reading": clean(reading_match.group(1)) if reading_match else "",
                "entities": clean(entities_match.group(1)) if entities_match else "",
                "translation": clean(translation_match.group(1))
            }
            
        except Exception as e:
            logger.error(f"[TRANSLATION] 파싱 중 에러: {e}")
            return None

# ================================================================================
# Global Accessor
# ================================================================================
_translation_engine = None

def get_translation_engine(config_path: Optional[str] = None) -> TranslationEngine:
    """
    번역 엔진 싱글톤 인스턴스 반환
    
    Args:
        config_path: 설정 파일 경로 (None이면 기본 경로 사용)
        
    Returns:
        TranslationEngine: 번역 엔진 인스턴스
    """
    global _translation_engine
    if _translation_engine is None:
        _translation_engine = TranslationEngine(config_path)
    return _translation_engine

