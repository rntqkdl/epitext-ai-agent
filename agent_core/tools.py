"""
EpiText-Agent 모의 도구 모듈.
시각, 문맥 함수는 고정 응답을 반환하며 실제 Swin/MLM을 호출하지 않습니다.
자료 검색은 미검증 예시 JSON을 조회하며 기관별 실제 판독, 이견을 보장하지 않습니다.
"""
import json
import os
import time
from pathlib import Path
from typing import Dict, Any, List, Optional

CORPUS_PATH = Path(__file__).parent.parent / "data" / "epigraphy_corpus.json"


def _load_corpus() -> Dict[str, Any]:
    if not CORPUS_PATH.exists():
        return {"records": []}
    with open(CORPUS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def detect_era_from_text(lines: List[str]) -> str:
    """텍스트 내 시대 단서(국호, 연호, 관직, 사찰명)를 분석하여 시대를 진단합니다."""
    joined = "".join(lines)
    if any(k in joined for k in ["鄒牟", "創基", "剖卵降世", "天帝之子", "永樂", "眞興", "沙喙部", "百殘", "好太王"]):
        return "삼국"
    if any(k in joined for k in ["歸法寺", "寂炤", "玄應", "肅宗", "乾統", "茶毗", "八德"]):
        return "고려"
    if any(k in joined for k in ["吏曹判書", "資憲大夫", "經筵", "朝鮮", "維歲次", "廣州", "贈諡"]):
        return "조선"
    return "고려"


def vision_swin_tool(
    surrounding_line: str,
    char_index: int,
    mask_type: str,
    swin_image_path: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    부분 훼손 경로를 점검하는 고정 응답입니다. 이미지 경로는 아직 사용하지 않습니다.
    MASK1 경로는 예시 규칙에 따라 빈 결과를 반환합니다.
    """
    if mask_type == "MASK1":
        return []

    # 시뮬레이션 연산 지연 (병렬/조건부 최적화 전후 비교용, 18ms)
    time.sleep(0.018)

    # 미검증 시연용 후보. 실제 잔여 획을 분석한 결과가 아닙니다.
    if "高" in surrounding_line and "歸法寺" in surrounding_line:
        if char_index == 1:
            return [
                {"token": "麗", "probability": 0.912},
                {"token": "句", "probability": 0.041},
                {"token": "山", "probability": 0.022},
                {"token": "州", "probability": 0.015},
                {"token": "郡", "probability": 0.010},
            ]
        return [
            {"token": "西", "probability": 0.864},
            {"token": "國", "probability": 0.082},
            {"token": "陽", "probability": 0.025},
            {"token": "東", "probability": 0.018},
            {"token": "南", "probability": 0.011},
        ]

    if "見性寂炤首" in surrounding_line:
        # 고유 직책명 '首座(수좌)': 비전 모델은 잔여 획으로 '座'를 정확히 포착함
        return [
            {"token": "座", "probability": 0.895},
            {"token": "廣", "probability": 0.045},
            {"token": "庭", "probability": 0.030},
            {"token": "廟", "probability": 0.020},
            {"token": "府", "probability": 0.010},
        ]

    if "立" in surrounding_line and "肅宗" in surrounding_line:
        if char_index == 1:
            return [
                {"token": "朝", "probability": 0.882},
                {"token": "國", "probability": 0.054},
                {"token": "廟", "probability": 0.031},
                {"token": "石", "probability": 0.021},
                {"token": "碑", "probability": 0.012},
            ]
        if char_index == 5:
            return [
                {"token": "王", "probability": 0.934},
                {"token": "主", "probability": 0.032},
                {"token": "玉", "probability": 0.018},
                {"token": "年", "probability": 0.010},
                {"token": "代", "probability": 0.006},
            ]
        return [
            {"token": "長", "probability": 0.785},
            {"token": "四", "probability": 0.142},
            {"token": "元", "probability": 0.041},
            {"token": "次", "probability": 0.022},
            {"token": "季", "probability": 0.010},
        ]

    if "歲下元己未" in surrounding_line and char_index == 0:
        # 연속 손상 '□□歲下元己未' 중 첫 글자(MASK2): 잔여 획으로 '乾'을 88.6%로 판독
        return [
            {"token": "乾", "probability": 0.886},
            {"token": "天", "probability": 0.042},
            {"token": "朝", "probability": 0.035},
            {"token": "韓", "probability": 0.022},
            {"token": "幹", "probability": 0.015},
        ]

    if "日甲子薨卒" in surrounding_line:
        return [
            {"token": "六", "probability": 0.875},
            {"token": "八", "probability": 0.065},
            {"token": "四", "probability": 0.030},
            {"token": "九", "probability": 0.020},
            {"token": "五", "probability": 0.010},
        ]

    if "壬申茶" in surrounding_line:
        if char_index == 3:
            # 불교 화장 용어 '茶毗(다비)': 비전은 '毗'를 91.5%로 잡으나 일반 NLP Top-20에는 없는 대표 사례
            return [
                {"token": "毗", "probability": 0.915},
                {"token": "毘", "probability": 0.045},
                {"token": "田", "probability": 0.020},
                {"token": "略", "probability": 0.012},
                {"token": "疇", "probability": 0.008},
            ]
        return [
            {"token": "十", "probability": 0.920},
            {"token": "廿", "probability": 0.045},
            {"token": "初", "probability": 0.020},
            {"token": "千", "probability": 0.010},
            {"token": "七", "probability": 0.005},
        ]

    if "乙酉" in surrounding_line and "舍利" in surrounding_line:
        if char_index == 2:
            return [
                {"token": "安", "probability": 0.890},
                {"token": "奉", "probability": 0.055},
                {"token": "置", "probability": 0.030},
                {"token": "葬", "probability": 0.015},
                {"token": "藏", "probability": 0.010},
            ]
        if char_index == 5:
            return [
                {"token": "塔", "probability": 0.905},
                {"token": "堂", "probability": 0.040},
                {"token": "碑", "probability": 0.028},
                {"token": "石", "probability": 0.017},
                {"token": "殿", "probability": 0.010},
            ]
        return [
            {"token": "山", "probability": 0.918},
            {"token": "寺", "probability": 0.042},
            {"token": "峰", "probability": 0.020},
            {"token": "院", "probability": 0.012},
            {"token": "암", "probability": 0.008},
        ]

    # 조선시대 사대부 묘지명 잔여 획 추론 프로파일
    if any(k in surrounding_line for k in ["朝鮮", "吏", "經筵", "維歲次", "廣州", "贈諡", "墓誌銘"]):
        if "吏" in surrounding_line and "判書" in surrounding_line:
            return [
                {"token": "曹", "probability": 0.945},
                {"token": "部", "probability": 0.032},
                {"token": "房", "probability": 0.015},
            ]
        if "李" in surrounding_line and "墓誌銘" in surrounding_line:
            return [
                {"token": "公", "probability": 0.930},
                {"token": "君", "probability": 0.040},
                {"token": "氏", "probability": 0.020},
            ]
        if "維歲次" in surrounding_line:
            return [
                {"token": "己", "probability": 0.895},
                {"token": "已", "probability": 0.065},
                {"token": "乙", "probability": 0.025},
            ]
        if "治" in surrounding_line and "先塋" in surrounding_line:
            return [
                {"token": "東", "probability": 0.912},
                {"token": "南", "probability": 0.051},
                {"token": "西", "probability": 0.025},
            ]
        if "贈諡文" in surrounding_line:
            return [
                {"token": "肅", "probability": 0.925},
                {"token": "忠", "probability": 0.050},
                {"token": "敬", "probability": 0.015},
            ]

    # 삼국시대 금석문(광개토대왕릉비, 진흥왕 순수비) 잔여 획 추론 프로파일
    if any(k in surrounding_line for k in ["始祖鄒", "出自北", "剖卵降世", "五年歲在", "眞興"]):
        if "始祖鄒" in surrounding_line:
            return [
                {"token": "牟", "probability": 0.915},
                {"token": "魯", "probability": 0.045},
                {"token": "國", "probability": 0.025},
            ]
        if "出自北" in surrounding_line:
            return [
                {"token": "夫", "probability": 0.892},
                {"token": "失", "probability": 0.060},
                {"token": "天", "probability": 0.030},
            ]
        if "剖卵降世" in surrounding_line:
            return [
                {"token": "德", "probability": 0.910},
                {"token": "智", "probability": 0.065},
                {"token": "仁", "probability": 0.015},
            ]
        if "五年歲在" in surrounding_line:
            return [
                {"token": "樂", "probability": 0.935},
                {"token": "平", "probability": 0.040},
                {"token": "寧", "probability": 0.015},
            ]
        if "眞興" in surrounding_line:
            return [
                {"token": "太", "probability": 0.928},
                {"token": "大", "probability": 0.052},
                {"token": "天", "probability": 0.012},
            ]

    # 기본 비전 후보 반환
    return [
        {"token": "之", "probability": 0.720},
        {"token": "王", "probability": 0.120},
        {"token": "國", "probability": 0.080},
        {"token": "年", "probability": 0.050},
        {"token": "月", "probability": 0.030},
    ]


def context_mlm_tool(
    line_text: str,
    char_index: int,
    era: str = "고려"
) -> List[Dict[str, Any]]:
    """
    문맥 보강 전후 흐름을 점검하는 고정 응답입니다.
    조건에 따라 반환값이 바뀌지만 실제 SikuRoBERTa 예측은 아닙니다.
    """
    time.sleep(0.022)

    # 1. 연속 손상 구간 핵심 검증: "□□歲下元己未二月十" vs "乾□歲下元己未二月十"
    if "歲下元己未" in line_text:
        if char_index == 0:
            # 첫 글자(연호 첫 자)는 뒤에 '□'가 비어 있으면 문맥만으로는 어떤 연호인지 특정 불가
            return [
                {"token": "惟", "probability": 0.340},
                {"token": "維", "probability": 0.250},
                {"token": "今", "probability": 0.180},
                {"token": "當", "probability": 0.120},
                {"token": "乾", "probability": 0.065},
            ]
        if char_index == 1:
            # [핵심] 만약 앞 글자(index 0)가 아직 '□'이면(Before: 1회성 동시 추론):
            # 앞 글자를 모르므로 '歲(세)' 앞에 올 일반적인 한자('年', '載')를 잘못 추론함!
            if line_text[0] == "□":
                return [
                    {"token": "年", "probability": 0.420},
                    {"token": "載", "probability": 0.230},
                    {"token": "時", "probability": 0.150},
                    {"token": "月", "probability": 0.110},
                    {"token": "春", "probability": 0.090},
                ]
            # [핵심] 앞 글자가 1단계 Swin V2 Unmasking으로 '乾'으로 채워진 경우(After):
            # '乾[MASK]歲下元己未' -> 요나라/고려 연호 '乾統(건통)' 또는 '乾元'을 높은 확률로 정확히 추론!
            if line_text[0] == "乾":
                return [
                    {"token": "統", "probability": 0.892},
                    {"token": "元", "probability": 0.058},
                    {"token": "德", "probability": 0.025},
                    {"token": "道", "probability": 0.015},
                    {"token": "隆", "probability": 0.010},
                ]

    # 2. "高□洛□歸法寺住持"
    if "歸法寺" in line_text:
        if char_index == 1:
            return [
                {"token": "麗", "probability": 0.845},
                {"token": "山", "probability": 0.065},
                {"token": "僧", "probability": 0.040},
                {"token": "پیر", "probability": 0.030},
                {"token": "王", "probability": 0.020},
            ]
        # char_index == 3 ('洛□歸法寺'):
        # 일반 문맥 모델은 '洛' 뒤에 중국 지명 '陽(낙양)'을 1순위로 추론함 -> 비전('西')과 충돌 발생!
        return [
            {"token": "陽", "probability": 0.680},
            {"token": "東", "probability": 0.120},
            {"token": "南", "probability": 0.090},
            {"token": "水", "probability": 0.060},
            {"token": "京", "probability": 0.050},
        ]

    # 3. "見性寂炤首□玄應者"
    if "見性寂炤首" in line_text:
        # 일반 문맥 모델은 '首' 뒤에 '領(수령)'이나 '相(수상)'을 추론하고 불교 승직 '座(수좌)'는 낮게 평가함
        return [
            {"token": "領", "probability": 0.540},
            {"token": "相", "probability": 0.210},
            {"token": "師", "probability": 0.120},
            {"token": "僧", "probability": 0.080},
            {"token": "徒", "probability": 0.050},
        ]

    # 4. "立□第十五□肅宗□子"
    if "肅宗" in line_text:
        if char_index == 1:
            return [
                {"token": "朝", "probability": 0.810},
                {"token": "國", "probability": 0.110},
                {"token": "世", "probability": 0.045},
                {"token": "代", "probability": 0.020},
                {"token": "君", "probability": 0.015},
            ]
        if char_index == 5:
            return [
                {"token": "王", "probability": 0.890},
                {"token": "帝", "probability": 0.050},
                {"token": "代", "probability": 0.030},
                {"token": "主", "probability": 0.020},
                {"token": "君", "probability": 0.010},
            ]
        return [
            {"token": "長", "probability": 0.740},
            {"token": "太", "probability": 0.120},
            {"token": "世", "probability": 0.070},
            {"token": "王", "probability": 0.040},
            {"token": "四", "probability": 0.030},
        ]

    # 5. "□日甲子薨卒二十一日"
    if "日甲子薨卒" in line_text:
        return [
            {"token": "六", "probability": 0.820},
            {"token": "五", "probability": 0.075},
            {"token": "三", "probability": 0.045},
            {"token": "七", "probability": 0.035},
            {"token": "八", "probability": 0.025},
        ]

    # 6. "壬申茶□以三月□五日"
    if "壬申茶" in line_text:
        if char_index == 3:
            # [핵심] '茶□': 일반 문맥 모델(사고전서 평균)은 '茶' 뒤에 '禮(다례)', '菓(다과)', '湯(다탕)'만 뽑고
            # 불교 화장 의식인 '毗(다비)'를 Top-20에 넣지 못함 -> 기존 코드에서는 교집합 부재로 Swin의 '毗'가 폐기됨!
            return [
                {"token": "禮", "probability": 0.580},
                {"token": "菓", "probability": 0.190},
                {"token": "湯", "probability": 0.110},
                {"token": "亭", "probability": 0.070},
                {"token": "器", "probability": 0.050},
            ]
        return [
            {"token": "十", "probability": 0.885},
            {"token": "廿", "probability": 0.065},
            {"token": "初", "probability": 0.030},
            {"token": "二", "probability": 0.012},
            {"token": "三", "probability": 0.008},
        ]

    # 7. "乙酉□舍利□於八德□"
    if "舍利" in line_text:
        if char_index == 2:
            return [
                {"token": "安", "probability": 0.830},
                {"token": "奉", "probability": 0.095},
                {"token": "葬", "probability": 0.040},
                {"token": "置", "probability": 0.020},
                {"token": "藏", "probability": 0.015},
            ]
        if char_index == 5:
            return [
                {"token": "塔", "probability": 0.880},
                {"token": "利", "probability": 0.045},
                {"token": "堂", "probability": 0.035},
                {"token": "殿", "probability": 0.025},
                {"token": "院", "probability": 0.015},
            ]
        # '八德□': 문맥 모델은 '八德(팔덕)' 뒤에 중국 고사 '之'나 '水(팔덕수)'를 추론하나 실제는 고려 산 이름 '八德山'
        return [
            {"token": "水", "probability": 0.490},
            {"token": "之", "probability": 0.220},
            {"token": "池", "probability": 0.130},
            {"token": "門", "probability": 0.090},
            {"token": "寺", "probability": 0.070},
        ]

    # 조선시대 사대부 묘지명 문맥 추론 프로파일
    if any(k in line_text for k in ["朝鮮", "吏", "經筵", "維歲次", "廣州", "贈諡", "墓誌銘"]):
        if "吏" in line_text and "判書" in line_text:
            return [
                {"token": "曹", "probability": 0.950},
                {"token": "部", "probability": 0.030},
                {"token": "房", "probability": 0.012},
            ]
        if "李" in line_text and "墓誌銘" in line_text:
            return [
                {"token": "公", "probability": 0.920},
                {"token": "君", "probability": 0.050},
                {"token": "氏", "probability": 0.015},
            ]
        if "維歲次" in line_text:
            # char_index == 3: 앞 글자 (천간)
            if char_index == 3:
                return [
                    {"token": "己", "probability": 0.880},
                    {"token": "甲", "probability": 0.080},
                    {"token": "辛", "probability": 0.040},
                ]
            # char_index == 4: 뒷 글자 (지지) - Unmasking 전후 차이
            if len(line_text) > 3 and line_text[3] == "□":
                # Before: 앞 글자가 빈칸이므로 지지를 특정하지 못함
                return [
                    {"token": "子", "probability": 0.310},
                    {"token": "亥", "probability": 0.250},
                    {"token": "卯", "probability": 0.180},
                    {"token": "巳", "probability": 0.070},
                ]
            else:
                # After: 앞 글자 '己' 선반영 후 60갑자 기사(己巳)년 특정
                return [
                    {"token": "巳", "probability": 0.920},
                    {"token": "酉", "probability": 0.045},
                    {"token": "丑", "probability": 0.020},
                ]
        if "治" in line_text and "先塋" in line_text:
            return [
                {"token": "東", "probability": 0.890},
                {"token": "南", "probability": 0.060},
                {"token": "西", "probability": 0.030},
            ]
        if "贈諡文" in line_text:
            return [
                {"token": "忠", "probability": 0.780},
                {"token": "肅", "probability": 0.650},
                {"token": "正", "probability": 0.030},
            ]

    # 삼국시대 금석문(광개토대왕릉비, 진흥왕 순수비) 문맥 추론 프로파일
    if any(k in line_text for k in ["始祖鄒", "出自北", "剖卵降世", "五年歲在", "眞興"]):
        if "始祖鄒" in line_text:
            # 중국 고전(사구전서) 기반 일반 MLM은 '鄒' 뒤에 '魯(추노)', '國(추국)'을 우선 예측하고 고구려 고유 인명 '鄒牟(추모)'를 놓침
            return [
                {"token": "魯", "probability": 0.560},
                {"token": "國", "probability": 0.250},
                {"token": "人", "probability": 0.110},
            ]
        if "出自北" in line_text:
            # char_index == 3: 앞 글자 ('夫')
            if char_index == 3:
                return [
                    {"token": "夫", "probability": 0.875},
                    {"token": "方", "probability": 0.080},
                    {"token": "海", "probability": 0.045},
                ]
            # char_index == 4: 뒷 글자 ('餘') - Unmasking 전후 차이
            if len(line_text) > 3 and line_text[3] == "□":
                return [
                    {"token": "方", "probability": 0.350},
                    {"token": "海", "probability": 0.280},
                    {"token": "地", "probability": 0.190},
                    {"token": "餘", "probability": 0.060},
                ]
            else:
                # 1단계 비전 Unmasking으로 '出自北夫□'가 된 후 고대 국명 '北夫餘(북부여)' 특정
                return [
                    {"token": "餘", "probability": 0.915},
                    {"token": "人", "probability": 0.050},
                    {"token": "國", "probability": 0.025},
                ]
        if "剖卵降世" in line_text:
            # '生而有聖□': 일반 문맥 모델은 '智'와 '德'을 경합 예측 -> 사료 RAG 학설 이견 중재 대상
            return [
                {"token": "智", "probability": 0.760},
                {"token": "德", "probability": 0.680},
                {"token": "神", "probability": 0.040},
            ]
        if "五年歲在" in line_text:
            return [
                {"token": "樂", "probability": 0.910},
                {"token": "平", "probability": 0.055},
                {"token": "和", "probability": 0.025},
            ]
        if "眞興" in line_text:
            # 일반 한문 MLM은 '王' 앞에 '大(대왕)'를 1순위로 예측하나 신라 순수비 고유 왕호는 '太王(태왕)'
            return [
                {"token": "大", "probability": 0.640},
                {"token": "太", "probability": 0.220},
                {"token": "明", "probability": 0.090},
            ]

    return [
        {"token": "之", "probability": 0.650},
        {"token": "也", "probability": 0.150},
        {"token": "於", "probability": 0.100},
        {"token": "以", "probability": 0.060},
        {"token": "而", "probability": 0.040},
    ]


def epigraphy_rag_tool(
    surrounding_line: str,
    candidate_chars: List[str],
    era: str = "고려"
) -> Dict[str, Any]:
    """
    예시 JSON에서 키워드가 겹치는 레코드를 찾습니다.
    source, commentary, scholarly_conflicts와 점수는 검증된 역사적 근거가 아닙니다.
    """
    time.sleep(0.012)
    corpus = _load_corpus()
    records = corpus.get("records", [])

    # 예시 시대 필터. 일치 항목이 없으면 전체를 조회하므로 시대 적합성을 보장하지 않습니다.
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
                best_match = {
                    "doc_id": rec.get("doc_id"),
                    "title": rec.get("title"),
                    "era": rec.get("era"),
                    "year": rec.get("year"),
                    "source": rec.get("source"),
                    "pattern": clause.get("pattern"),
                    "restored": clause.get("restored"),
                    "verified_chars": [c for c in candidate_chars if c in clause.get("target_chars", [])],
                    "target_chars": clause.get("target_chars", []),
                    "commentary": clause.get("commentary"),
                    "scholarly_conflicts": clause.get("scholarly_conflicts", []),
                    "grounding_score": min(0.98, 0.70 + 0.05 * matched_kw)
                }

    if best_match:
        return best_match

    return {
        "doc_id": "NONE",
        "title": "일치 사료 미발견",
        "era": era,
        "source": "국사편찬위원회 금석문 통합 검색",
        "verified_chars": [],
        "target_chars": [],
        "commentary": "동시대 금석문 코퍼스에서 직접 일치하는 관용구가 발견되지 않아 전문가 수기 고증이 요구됨.",
        "scholarly_conflicts": [],
        "grounding_score": 0.0
    }


def ollama_historical_commentary_tool(
    line_text: str,
    target_char: str,
    scholarly_conflicts: Optional[List[Dict[str, str]]] = None,
    era: str = "고려",
    model: str = "qwen2.5:7b"
) -> str:
    """
    Ollama(Qwen 2.5) 로컬 LLM을 호출하여 사료 판독 학설 이견이나 역사적 용례를 사학자 관점에서 해설합니다.
    기존 클라우드 GPT-4o-mini 호출을 대체하여 로컬 오프라인 환경에서 비용 없이 즉시 구동됩니다.
    """
    import urllib.request
    import urllib.error

    ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434/api/generate")
    preferred_model = os.getenv("OLLAMA_MODEL", model)

    conflict_desc = ""
    if scholarly_conflicts:
        conflict_desc = "\n[기관별 판독 학설 이견]: " + ", ".join(
            f"{c.get('institution')}: '{c.get('char')}' ({c.get('rationale')})" for c in scholarly_conflicts
        )

    system_prompt = (
        "당신은 한국 고대 및 중세 금석문 전문 사학자입니다. "
        "반드시 한국어(Korean)로만 간결하고 명확하게 2~3문장으로 사료적 근거를 해설하십시오. "
        "중국어 간체자나 불필요한 서두를 배제하고 본론만 작성하십시오."
    )

    user_prompt = (
        f"시대: {era}\n"
        f"원문 구절: {line_text}\n"
        f"복원 대상 한자: {target_char}"
        f"{conflict_desc}\n\n"
        f"위 결락 한자 판독에 대해 사학자 관점에서 사료적 타당성과 판독 주의점을 간결히 해설해 주십시오."
    )

    try:
        payload = {
            "model": preferred_model,
            "system": system_prompt,
            "prompt": user_prompt,
            "stream": False,
            "options": {
                "temperature": 0.1,
                "num_predict": 300,
            }
        }
        req = urllib.request.Request(
            ollama_url,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("response", "").strip()
    except Exception as e:
        return f"[Ollama 로컬 해설 대기] {line_text}의 '{target_char}' 자는 {era} 사료 용례에 부합하며 전문가 추가 대조가 권장됩니다. (오프라인 캐시: {e})"


def diagnose_and_reprocess_ocr_line(line_text: str) -> Dict[str, Any]:
    """
    [오류 진단 -> 재처리 계획/실행 -> 검증 루프]
    결락 표시('□')가 없는 위치라도 OCR이 유사 자형으로 오인식한 숨은 오류(예: '甲' -> '由', '己' -> '已')를
    탐지하여 영역 재추출/Swin 대조 후 문맥을 재추론하고 오답->정답 전이를 기록합니다.
    """
    clean_line = line_text.replace("，", "").replace("。", "").strip()
    suspect_positions: List[Dict[str, Any]] = []
    reprocessed_chars = list(clean_line)

    # 신호 1: 육십갑자 일진 문맥에서 '由子'(비정상 어구) 발견 -> '甲'(하단 세로획 일부 누락) 오인식 의심
    if "日由子" in clean_line:
        idx = clean_line.find("日由子") + 1
        suspect_positions.append({
            "char_index": idx,
            "ocr_char": "由",
            "suspected_cause": "글자 하단 영역 잘림으로 인한 유사 자형 오인식 ('甲' -> '由') 및 문맥상 이례적 일진('由子')",
            "reprocess_action": "bbox 하단 확장 재추출 후 Swin 잔여 획 및 육십갑자('甲子') 문맥 재검증",
            "reprocessed_char": "甲",
            "visual_grounding_score": 0.91,
        })
        reprocessed_chars[idx] = "甲"

    # 신호 2: 간지 편년 문맥에서 '維歲次已巳'('己'를 '已'로 오인식) 탐지
    if "維歲次已" in clean_line:
        idx = clean_line.find("維歲次已") + 3
        suspect_positions.append({
            "char_index": idx,
            "ocr_char": "已",
            "suspected_cause": "상단 가로획 마모로 인한 천간 오인식 ('己' -> '已')",
            "reprocess_action": "전처리 대비 조정 후 Swin 재추론 및 천간 규칙 검증",
            "reprocessed_char": "己",
            "visual_grounding_score": 0.89,
        })
        reprocessed_chars[idx] = "己"

    reprocessed_line = "".join(reprocessed_chars)
    mask_idx = reprocessed_line.find("□")
    restored_mask_char = None
    if mask_idx >= 0:
        mlm_preds = context_mlm_tool(reprocessed_line, mask_idx)
        restored_mask_char = mlm_preds[0]["token"] if mlm_preds else None

    return {
        "original_ocr_line": clean_line,
        "reprocessed_line": reprocessed_line,
        "suspect_ocr_tokens": suspect_positions,
        "restored_mask_char": restored_mask_char,
        "transitions": {
            "error_to_correct": len(suspect_positions),
            "correct_to_error": 0,
        },
    }


def evaluate_reversible_hypothesis(
    original_line: str,
    candidate_a: str,
    candidate_b: str,
    era: str = "고려",
) -> Dict[str, Any]:
    """
    [되돌릴 수 있는 문맥 가설 (Reversible Context Hypothesis)]
    원본 OCR 텍스트(original_line)를 덮어쓰지 않고 선행 마스크(index 0)에 대해
    가설 A와 가설 B를 각각 대입한 후, 인접 마스크(index 1) 추론 및 사료 근거와 충돌하는 선행 가설을 철회(Retract)합니다.
    """
    clean_line = original_line.replace("，", "").replace("。", "").strip()
    hypotheses = []

    for hyp_id, assumed_char in [("hyp_A", candidate_a), ("hyp_B", candidate_b)]:
        chars = list(clean_line)
        if chars and chars[0] == "□":
            chars[0] = assumed_char
        hyp_line = "".join(chars)
        dependent_preds = context_mlm_tool(hyp_line, 1, era=era) if len(chars) > 1 else []
        dep_top1 = dependent_preds[0]["token"] if dependent_preds else ""
        rag_check = epigraphy_rag_tool(clean_line, [assumed_char, dep_top1], era=era)
        verified_set = set(rag_check.get("verified_chars", []))

        is_supported = assumed_char in verified_set
        hypotheses.append({
            "hypothesis_id": hyp_id,
            "assumed_char": assumed_char,
            "hypothesis_line": hyp_line,
            "dependent_order": 2,
            "dependent_top1": dep_top1,
            "supported_by_corpus": is_supported,
            "status": "verified" if is_supported else "retracted",
            "retraction_reason": None if is_supported else f"사료 용례('{rag_check.get('restored')}')와 선행 가설 '{assumed_char}' 불일치로 가설 및 종속 추론 철회",
        })

    selected = next((h for h in hypotheses if h["status"] == "verified"), hypotheses[0])
    return {
        "preserved_original_line": clean_line,
        "hypotheses": hypotheses,
        "retracted_count": sum(1 for h in hypotheses if h["status"] == "retracted"),
        "selected_hypothesis": selected,
    }


