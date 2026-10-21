import React, { useState, useMemo, useCallback, useEffect } from "react";
import ReasoningCluster from "../components/ReasoningCluster";
import {
  getRubbingDetail,
  getRestorationTargets,
  getCandidates,
  getReasoning,
  getTranslation,
  previewTranslation,
  inspectTarget,
  formatDate,
  formatProcessingTime,
} from "../api/requests";

// 유틸리티 함수: 텍스트 내용을 배열로 변환
const ensureArray = (text) => {
  if (!text) return [];
  if (Array.isArray(text)) return text;
  if (typeof text === "string") {
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return text.split("\n").filter((line) => line.trim());
    }
  }
  return [];
};

// [MASK] 텍스트를 파싱하여 □로 보여주면서도 데이터 처리가 가능하게 함
const processTextForDisplay = (textArray) => {
  if (!textArray || !Array.isArray(textArray)) return [];

  return textArray.map((line) => {
    // [MASK1], [MASK2] 등을 모두 □로 치환
    return line.replace(/\[MASK\d*\]/g, "□");
  });
};

// 이미지 URL 해결 함수
const resolveImageUrl = (imageUrl) => {
  if (!imageUrl) return "";
  if (imageUrl.startsWith("http")) return imageUrl;
  if (imageUrl.startsWith("/")) {
    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
    return `${baseUrl}${imageUrl}`;
  }
  return imageUrl;
};

// 상수 정의
const COLORS = {
  primary: "#ee7542", // 복원 대상 분포 그래프용
  secondary: "#344D64", // 검수 현황 및 AI 복원 대상 검수용
  lightSecondary: "#CCD2D8", // 검수 필요 영역용
  lightOrange: "#FCE3D9",
  lightGray: "#F8F8FA",
  darkGray: "#484a64",
  textDark: "#2a2a3a",
  border: "#EBEDF8",
  bgLight: "#F6F7FE",
};

const STYLES = {
  charBox: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: "1",
    textAlign: "center",
    verticalAlign: "middle",
    letterSpacing: "0",
    margin: "0",
    padding: "0",
    fontSize: "20px",
    fontFamily: "'Noto Serif KR', 'HanaMinB', 'Batang', serif",
  },
  charNormal: {
    display: "inline-block",
    verticalAlign: "middle",
    lineHeight: "1",
    fontSize: "20px",
    letterSpacing: "4px",
    fontFamily: "'Noto Serif KR', 'HanaMinB', 'Batang', serif",
  },
  textContainer: {
    fontFamily: "'Noto Serif KR', 'HanaMinB', 'Batang', serif",
    lineHeight: "1.5",
  },
  // 공통 카드 스타일
  card: {
    borderRadius: "16px",
    border: "1px solid #EBEDF8",
    background: "#FFF",
    boxShadow: "0 4px 12px 0 rgba(130, 130, 130, 0.10)",
    minWidth: "584px",
  },
  // 한자 문자 공통 스타일 (비타겟)
  charNormalBase: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    lineHeight: "1",
    textAlign: "center",
    verticalAlign: "middle",
    letterSpacing: "0",
    margin: "0",
    padding: "0",
    fontSize: "20px",
    width: "28px",
    height: "28px",
  },
};

const DetailPage = ({ item, onBack }) => {
  const rubbingId = item?.id;

  // 상태 관리
  const [rubbingDetail, setRubbingDetail] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [restorationTargets, setRestorationTargets] = useState([]);
  const [candidates, setCandidates] = useState({});
  const [allCandidates, setAllCandidates] = useState({});
  const [reasoningData, setReasoningData] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedCharId, setSelectedCharId] = useState(null);
  const [checkedChars, setCheckedChars] = useState(new Set()); // Set으로 변경하여 O(1) 조회
  const [selectedCharacters, setSelectedCharacters] = useState({}); // charId -> selected character
  const [showReasonPopup, setShowReasonPopup] = useState(false);
  const [selectedCharForCluster, setSelectedCharForCluster] = useState(null); // cluster에서 표시할 선택된 글자
  const [translation, setTranslation] = useState({ original: "", translation: "", selectedCharIndex: -1 }); // 번역문과 원문, 선택된 글자 인덱스
  const [isLoadingTranslation, setIsLoadingTranslation] = useState(false); // 번역 로딩 상태

  // API에서 데이터 로드
  useEffect(() => {
    if (!rubbingId) {
      setError("탁본 ID가 없습니다.");
      setIsLoading(false);
      return;
    }

    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // 병렬로 데이터 로드
        const [detailData, targetsData] = await Promise.all([getRubbingDetail(rubbingId), getRestorationTargets(rubbingId)]);

        setRubbingDetail(detailData);
        setStatistics(detailData.statistics || null);

        // 복원 대상 데이터 변환 및 검수 기록 로드
        const formattedTargets = targetsData.map((target) => ({
          id: target.id,
          position: target.position,
          row: target.row_index,
          char: target.char_index,
        }));
        setRestorationTargets(formattedTargets);

        // 검수 기록 초기화 (이미 저장된 선택 사항 복원)
        const initialCheckedChars = new Set();
        const initialSelectedCharacters = {};
        targetsData.forEach((target) => {
          if (target.inspection && target.inspection.selected_character) {
            initialCheckedChars.add(target.id);
            initialSelectedCharacters[target.id] = target.inspection.selected_character;
          }
        });
        setCheckedChars(initialCheckedChars);
        setSelectedCharacters(initialSelectedCharacters);

        // 각 복원 대상의 후보 데이터 로드
        const candidatesMap = {};
        const allCandidatesMap = {};
        const reasoningMap = {};

        for (const target of targetsData) {
          try {
            // 후보 데이터 로드
            const candidatesResponse = await getCandidates(rubbingId, target.id);
            const top5 = candidatesResponse.top5 || [];
            const all = candidatesResponse.all || [];

            // Top-5 후보 변환 (검수 기록이 있으면 체크 표시)
            const inspection = target.inspection;
            const selectedChar = inspection?.selected_character;
            const selectedCandidateId = inspection?.selected_candidate_id;

            candidatesMap[target.id] = top5.map((c, idx) => {
              // 후보 ID 찾기 (candidatesResponse에서 가져와야 함)
              const candidateId = c.id || null;
              const isChecked = inspection && selectedChar === c.character;

              return {
                character: c.character,
                strokeMatch: c.stroke_match,
                contextMatch: c.context_match,
                reliability: c.reliability !== null && c.reliability !== undefined ? `${parseFloat(c.reliability).toFixed(1)}%` : null,
                checked: isChecked,
                candidateId: candidateId, // 후보 ID 저장
              };
            });

            // 전체 후보 변환
            allCandidatesMap[target.id] = all.map((c) => ({
              character: c.character,
              strokeMatch: c.stroke_match,
              contextMatch: c.context_match,
              reliability: c.reliability !== null && c.reliability !== undefined ? `${parseFloat(c.reliability).toFixed(1)}%` : null,
            }));

            // 유추 근거 데이터 로드
            const reasoningResponse = await getReasoning(rubbingId, target.id);
            reasoningMap[target.id] = reasoningResponse;
          } catch (err) {
            console.error(`Failed to load candidates for target ${target.id}:`, err);
            // 에러 발생 시 빈 배열
            candidatesMap[target.id] = Array(5)
              .fill(null)
              .map(() => ({
                character: null,
                strokeMatch: null,
                contextMatch: null,
                reliability: null,
                checked: false,
              }));
            allCandidatesMap[target.id] = [];
          }
        }

        setCandidates(candidatesMap);
        setAllCandidates(allCandidatesMap);
        setReasoningData(reasoningMap);
      } catch (err) {
        console.error("Failed to load detail data:", err);
        // 더 자세한 에러 메시지
        let errorMessage = "데이터를 불러오는데 실패했습니다.";
        if (err.response) {
          // 서버가 응답했지만 에러 상태 코드
          errorMessage = `서버 오류 (${err.response.status}): ${err.response.data?.error || err.response.statusText}`;
        } else if (err.request) {
          // 요청은 보냈지만 응답이 없음
          errorMessage = "서버에 연결할 수 없습니다. 백엔드 서버가 실행 중인지 확인하세요.";
        } else {
          // 요청 설정 중 에러
          errorMessage = err.message || errorMessage;
        }
        setError(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [rubbingId]);

  // 텍스트 내용 처리
  // 검수 UI에서 줄바꿈이 적용된 '구두점 복원 텍스트'를 우선 사용
  // 데이터가 없으면 원본 텍스트 사용
  const sampleText = useMemo(() => {
    if (!rubbingDetail) return [];
    const textToUse = rubbingDetail.text_content_with_punctuation || rubbingDetail.text_content;
    const rawTextLines = ensureArray(textToUse);
    return processTextForDisplay(rawTextLines);
  }, [rubbingDetail]);

  // 순서 기반 매핑 테이블 생성 및 화면상 위치 계산
  // 텍스트의 □ 순서와 DB의 Target을 매칭하고, '화면상 위치'를 계산합니다.
  const { targetMap, visualPosMap } = useMemo(() => {
    const map = {}; // 텍스트 클릭용 (key: "행-열", value: target)
    const posMap = {}; // 버튼 표시용 (key: target.id, value: "N행 M자")

    let maskCounter = 0;

    // ID순으로 정렬 (텍스트의 □ 순서와 일치시킴)
    const sortedTargets = [...restorationTargets].sort((a, b) => a.id - b.id);

    // sampleText(화면에 보이는 줄바꿈된 텍스트)를 순회하며 위치 재계산
    sampleText.forEach((line, rowIndex) => {
      const chars = line.split("");
      let charIndexInLine = 0; // 한글/한자/문장부호 포함한 실제 인덱스

      chars.forEach((char) => {
        // 텍스트 렌더링 로직과 동일하게 인덱싱
        if (char === "□") {
          if (maskCounter < sortedTargets.length) {
            const target = sortedTargets[maskCounter];

            // 1. 텍스트 클릭을 위한 매핑
            map[`${rowIndex}-${charIndexInLine}`] = target;

            // 2. [핵심] 버튼에 표시할 '화면상 위치' 계산 (1부터 시작)
            posMap[target.id] = `${rowIndex + 1}행 ${charIndexInLine + 1}자`;

            maskCounter++;
          }
        }
        charIndexInLine++;
      });
    });

    return { targetMap: map, visualPosMap: posMap };
  }, [sampleText, restorationTargets]);

  const handleCharClick = useCallback((charId) => {
    setSelectedCharId((prev) => (prev === charId ? null : charId));
  }, []);

  const handleCandidateCheck = useCallback(
    async (charId, candidateIndex) => {
      setCandidates((prev) => {
        const newCandidates = { ...prev };
        if (newCandidates[charId]) {
          const updated = newCandidates[charId].map((c, idx) =>
            idx === candidateIndex ? { ...c, checked: !c.checked } : { ...c, checked: false }
          );
          newCandidates[charId] = updated;

          // 체크된 후보의 한자를 selectedCharacters에 저장
          const checkedCandidate = updated.find((c) => c.checked);
          if (checkedCandidate) {
            setSelectedCharacters((prev) => ({
              ...prev,
              [charId]: checkedCandidate.character,
            }));
            setCheckedChars((prev) => new Set([...prev, charId]));

            // 백엔드에 검수 결과 저장
            inspectTarget(rubbingId, charId, checkedCandidate.character, checkedCandidate.candidateId)
              .then(() => {
                console.log(`✅ 검수 결과 저장 완료: Target ${charId}, Character ${checkedCandidate.character}`);
              })
              .catch((error) => {
                console.error(`❌ 검수 결과 저장 실패:`, error);
                // 저장 실패 시 UI 롤백
                setCandidates((prev) => {
                  const rollback = { ...prev };
                  if (rollback[charId]) {
                    rollback[charId] = rollback[charId].map((c) => ({ ...c, checked: false }));
                  }
                  return rollback;
                });
                setSelectedCharacters((prev) => {
                  const newSelected = { ...prev };
                  delete newSelected[charId];
                  return newSelected;
                });
                setCheckedChars((prev) => {
                  const newSet = new Set(prev);
                  newSet.delete(charId);
                  return newSet;
                });
              });
          } else {
            setSelectedCharacters((prev) => {
              const newSelected = { ...prev };
              delete newSelected[charId];
              return newSelected;
            });
            setCheckedChars((prev) => {
              const newSet = new Set(prev);
              newSet.delete(charId);
              return newSet;
            });
          }
        }
        return newCandidates;
      });
    },
    [rubbingId]
  );

  const getCharStatus = useCallback(
    (charId) => {
      if (checkedChars.has(charId)) return "completed";
      if (selectedCharId === charId) return "selected";
      return "pending";
    },
    [checkedChars, selectedCharId]
  );

  const inspectionCount = checkedChars.size;
  // 검수 대상 글자 수는 복원 대상 글자 수와 동일
  const totalInspectionTargets = statistics?.restoration_targets || restorationTargets.length || 0;

  // 신뢰도 통계 계산
  const reliabilityStats = useMemo(() => {
    const selectedReliabilities = Array.from(checkedChars)
      .map((charId) => {
        const checkedCandidate = candidates[charId]?.find((c) => c.checked);
        if (!checkedCandidate || !checkedCandidate.reliability) return null;
        const relStr = checkedCandidate.reliability.replace("%", "");
        return parseFloat(relStr);
      })
      .filter((val) => val !== null && !isNaN(val)); // null 및 NaN 값 제거

    if (selectedReliabilities.length === 0) {
      return { average: "-", max: "-", min: "-" };
    }

    const sum = selectedReliabilities.reduce((acc, rel) => acc + rel, 0);
    const average = (sum / selectedReliabilities.length).toFixed(1) + "%";
    const max = Math.max(...selectedReliabilities).toFixed(1) + "%";
    const min = Math.min(...selectedReliabilities).toFixed(1) + "%";

    return { average, max, min };
  }, [checkedChars, candidates]);

  // 행별 타겟 그룹화 (메모이제이션)
  const targetsByRow = useMemo(() => {
    const grouped = {};
    restorationTargets.forEach((target) => {
      if (!grouped[target.row]) {
        grouped[target.row] = [];
      }
      grouped[target.row].push(target);
    });
    return grouped;
  }, [restorationTargets]);

  // 로딩 상태
  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center" style={{ backgroundColor: COLORS.lightGray }}>
        <div className="text-center">
          <div className="text-lg text-gray-600 mb-2">데이터를 불러오는 중...</div>
        </div>
      </div>
    );
  }

  // 에러 상태
  if (error || !rubbingDetail) {
    return (
      <div className="flex-1 overflow-auto flex items-center justify-center" style={{ backgroundColor: COLORS.lightGray }}>
        <div className="text-center">
          <div className="text-lg text-red-600 mb-2">오류가 발생했습니다.</div>
          <div className="text-sm text-gray-500 mb-4">{error || "데이터를 찾을 수 없습니다."}</div>
          <button onClick={onBack} className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300">
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto" style={{ backgroundColor: COLORS.lightGray }}>
      <div className="p-12" style={{ backgroundColor: COLORS.lightGray }}>
        {/* Back Button */}
        <button onClick={onBack} className="flex items-center gap-2 mb-[28px] text-gray-700 hover:text-gray-900">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-lg font-medium">목록으로 돌아가기</span>
        </button>

        <div
          className="grid items-stretch"
          style={{
            gridTemplateColumns: "minmax(584px, 1fr) minmax(584px, 1fr)",
            gap: "20px",
            minWidth: "1188px", // 584px * 2 + 20px gap
            height: "945px",
          }}
        >
          {/* 왼쪽 열: 탁본 정보, 복원 대상 분포, 검수 현황 */}
          <div className="flex flex-col gap-6 h-full">
            {/* 탁본 정보 */}
            <div className="bg-white p-6" style={STYLES.card}>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">탁본 정보</h2>
              <div className="flex gap-6">
                <div className="w-[238px] h-[187px] bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden">
                  <img
                    src={resolveImageUrl(rubbingDetail.image_url)}
                    alt="탁본 이미지"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      // 이미지 로드 실패 시 대체 텍스트 표시
                      e.target.style.display = "none";
                      e.target.parentElement.innerHTML = '<span class="text-gray-400">이미지 없음</span>';
                    }}
                  />
                </div>
                <div className="flex-1">
                  <div className="mb-4">
                    <p
                      style={{
                        color: "#484A64",
                        fontFamily: "Pretendard",
                        fontSize: "16px",
                        fontWeight: 600,
                        lineHeight: "18px",
                        marginBottom: "8px",
                      }}
                    >
                      파일명: {rubbingDetail.filename || "-"}
                    </p>
                    <div
                      style={{
                        color: "#7F85A3",
                        fontFamily: "Pretendard",
                        fontSize: "12px",
                        fontWeight: 400,
                        lineHeight: "16px",
                        letterSpacing: "-0.2px",
                      }}
                    >
                      <p style={{ margin: 0 }}>
                        처리 일시:{" "}
                        {rubbingDetail.processed_at
                          ? `${formatDate(rubbingDetail.processed_at)} ${new Date(rubbingDetail.processed_at).toLocaleTimeString("ko-KR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}`
                          : "-"}
                      </p>
                      <p style={{ margin: 0 }}>총 처리 시간: {formatProcessingTime(rubbingDetail.total_processing_time || 0)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(rubbingDetail.font_types || []).map((font, index) => (
                      <div key={index} className="px-4 py-2 bg-gray-100 rounded text-sm whitespace-nowrap">
                        {font}
                      </div>
                    ))}
                    <div className="px-4 py-2 bg-gray-100 rounded text-sm whitespace-nowrap">
                      탁본 손상 정도 {rubbingDetail.damage_percentage || 0}%
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 복원 대상 분포 */}
            <div className="bg-white p-6" style={STYLES.card}>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">복원 대상 분포</h2>
              <div className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="w-[150px] h-[150px] relative flex items-center justify-center">
                    {/* 원 그래프 - 12시 방향에서 시작 */}
                    <svg className="w-[150px] h-[150px] transform -rotate-90" viewBox="0 0 150 150" style={{ overflow: "visible" }}>
                      <circle cx="75" cy="75" r="65" fill="none" stroke="#FCE3D9" strokeWidth="16" />
                      <circle
                        cx="75"
                        cy="75"
                        r="65"
                        fill="none"
                        stroke="#EE7542"
                        strokeWidth="16"
                        strokeDasharray={`${2 * Math.PI * 65 * ((statistics?.restoration_percentage || 0) / 100)} ${2 * Math.PI * 65}`}
                        strokeDashoffset="0"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">복원 대상</p>
                        <p className="text-lg font-semibold text-[#ee7542]">{statistics?.restoration_percentage || 0}%</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#FCE3D9]"></div>
                      <span className="text-xs text-gray-600">탁본 전체</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-[#EE7542]"></div>
                      <span className="text-xs text-gray-600">복원 대상</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600 mb-1">전체 글자 수</p>
                    <p className="text-base font-semibold">{statistics?.total_characters || 0}자</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600 mb-1">복원 대상 글자 수</p>
                    <p className="text-base font-semibold">{statistics?.restoration_targets || 0}자</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600 mb-1">탁본 글자 부분 훼손</p>
                    <p className="text-base font-semibold">{statistics?.partial_damage || 0}자</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600 mb-1">탁본 글자 완전 훼손</p>
                    <p className="text-base font-semibold">{statistics?.complete_damage || 0}자</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">※ 부분 훼손은 잔존 획+전후 문맥, 완전 훼손은 전후 문맥으로 복원합니다.</p>
            </div>

            {/* 검수 현황 */}
            <div className="bg-white p-6" style={STYLES.card}>
              <h2 className="text-lg font-semibold text-gray-800 mb-4">검수 현황</h2>
              <div className="flex gap-6">
                <div className="flex flex-col items-center">
                  <div className="w-[150px] h-[150px] relative flex items-center justify-center">
                    {/* 원 그래프 - 12시 방향에서 시작 */}
                    <svg className="w-[150px] h-[150px] transform -rotate-90" viewBox="0 0 150 150" style={{ overflow: "visible" }}>
                      <circle cx="75" cy="75" r="65" fill="none" stroke={COLORS.lightSecondary} strokeWidth="16" />
                      <circle
                        cx="75"
                        cy="75"
                        r="65"
                        fill="none"
                        stroke={COLORS.secondary}
                        strokeWidth="16"
                        strokeDasharray={`${2 * Math.PI * 65 * (inspectionCount / totalInspectionTargets)} ${2 * Math.PI * 65}`}
                        strokeDashoffset="0"
                        strokeLinecap="round"
                      />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">검수 완료</p>
                        <p className="text-base font-semibold" style={{ color: COLORS.secondary }}>
                          {inspectionCount}자 / {totalInspectionTargets}자
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-4 mt-4">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.lightSecondary }}></div>
                      <span className="text-xs text-gray-600">검수 필요</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS.secondary }}></div>
                      <span className="text-xs text-gray-600">검수 완료</span>
                    </div>
                  </div>
                </div>
                <div className="flex-1 grid grid-cols-2 gap-4">
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600 mb-1">검수 대상 글자 수</p>
                    <p className="text-base font-semibold">{statistics?.restoration_targets || 0}자</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600 mb-1">평균 신뢰도</p>
                    <p className="text-base font-semibold">{reliabilityStats.average}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600 mb-1">최고 신뢰도</p>
                    <p className="text-base font-semibold">{reliabilityStats.max}</p>
                  </div>
                  <div className="p-3 bg-gray-50 rounded">
                    <p className="text-xs text-gray-600 mb-1">최저 신뢰도</p>
                    <p className="text-base font-semibold">{reliabilityStats.min}</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-4">※ 신뢰도는 참고용으로, 모든 복원 글자는 검수가 필요합니다.</p>
            </div>
          </div>

          {/* 오른쪽 열: AI 복원 대상 검수 */}
          <div className="bg-white p-6 flex flex-col overflow-hidden h-full" style={STYLES.card}>
            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex-shrink-0">AI 복원 대상 검수</h2>
            <p className="text-xs text-gray-500 mb-4 flex-shrink-0">
              ※ EPITEXT는 실수를 할 수 있습니다. 중요한 정보에 대해서는 재차 확인하세요.
            </p>

            {/* Legend */}
            <div className="flex gap-4 mb-4 flex-shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded bg-[#F8F8FA]"></div>
                <span className="text-xs text-[#2a2a3a]">검수 미완료</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded bg-[#F8F8FA]" style={{ border: `1px solid ${COLORS.secondary}` }}></div>
                <span className="text-xs text-[#2a2a3a]">선택 글자</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded" style={{ backgroundColor: COLORS.secondary }}></div>
                <span className="text-xs text-[#2a2a3a]">검수 완료</span>
              </div>
            </div>

            <div className="flex gap-4" style={{ flex: "1", minHeight: 0, overflow: "hidden", overflowX: "hidden" }}>
              {/* 글자 위치 목록 - 스크롤 가능 */}
              <div
                className="flex-shrink-0 flex flex-col gap-2"
                style={{ width: "auto", minWidth: "88px", maxHeight: "100%", overflowY: "auto", overflowX: "hidden", paddingRight: "8px" }}
              >
                {restorationTargets.map((target) => {
                  const status = getCharStatus(target.id);
                  const roundedClass = status === "completed" || status === "selected" ? "rounded-lg" : "rounded-[4px]";

                  let buttonStyle = {
                    fontSize: "14px",
                    fontWeight: status === "completed" || status === "selected" ? 700 : 600,
                    paddingTop: "4px",
                    paddingBottom: "4px",
                  };
                  let buttonClass = `h-8 px-2 ${roundedClass} text-center transition-colors hover:opacity-80 flex-shrink-0 whitespace-nowrap`;

                  if (status === "completed") {
                    buttonStyle = { ...buttonStyle, backgroundColor: COLORS.secondary, color: "white" };
                  } else if (status === "selected") {
                    buttonStyle = {
                      ...buttonStyle,
                      backgroundColor: COLORS.lightGray,
                      border: `1px solid ${COLORS.secondary}`,
                      color: COLORS.secondary,
                    };
                  } else {
                    buttonStyle = { ...buttonStyle, backgroundColor: COLORS.lightGray, color: COLORS.darkGray };
                  }

                  return (
                    <button
                      key={target.id}
                      onClick={() => handleCharClick(target.id)}
                      className={buttonClass}
                      style={{ width: "fit-content", minWidth: "88px", ...buttonStyle }}
                    >
                      {visualPosMap[target.id] || target.position}
                    </button>
                  );
                })}
              </div>

              {/* 복원된 텍스트 - 스크롤 가능 */}
              <div
                className="flex-1"
                style={{ minHeight: 0, maxHeight: "100%", overflowY: "auto", overflowX: "hidden", paddingRight: "8px" }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {sampleText.map((text, rowIndex) => {
                    // 해당 행에 선택된 타겟이 있는지 확인 (테이블 표시용)
                    const isRowSelected = text.split("").some((_, charIndex) => {
                      const target = targetMap[`${rowIndex}-${charIndex}`];
                      return target?.id === selectedCharId;
                    });
                    const showTable = isRowSelected && candidates[selectedCharId] && candidates[selectedCharId].length > 0;

                    return (
                      <div key={rowIndex} style={{ marginBottom: "12px" }}>
                        <div className="text-base mb-0 font-medium" style={STYLES.textContainer}>
                          {text.split("").map((char, charIndex) => {
                            // 순서 기반 매핑: targetMap을 통해 타겟 조회
                            const target = targetMap[`${rowIndex}-${charIndex}`];
                            const charId = target ? target.id : null;
                            const isSelected = selectedCharId === charId;
                            const isCompleted = charId && checkedChars.has(charId);
                            const isTarget = !!target;
                            const selectedChar = isCompleted && selectedCharacters[charId] ? selectedCharacters[charId] : char;

                            // 복원 대상이 아닌 일반 한자는 그냥 검정색으로 표시
                            if (!isTarget) {
                              return (
                                <span
                                  key={charIndex}
                                  className="inline-flex items-center justify-center"
                                  style={{
                                    ...STYLES.charNormalBase,
                                    color: COLORS.textDark,
                                  }}
                                >
                                  {char}
                                </span>
                              );
                            }

                            // 복원 대상인 경우
                            let charClass = "cursor-pointer inline-flex items-center justify-center";
                            let charStyle = { ...STYLES.charBox, width: "28px", height: "28px", borderRadius: "4px" };

                            if (isSelected) {
                              charStyle = {
                                ...charStyle,
                                backgroundColor: COLORS.lightGray,
                                border: `1px solid ${COLORS.secondary}`,
                                color: COLORS.secondary,
                              };
                            } else if (isCompleted) {
                              charStyle = {
                                ...charStyle,
                                backgroundColor: COLORS.secondary,
                                color: "white",
                              };
                            } else if (char === "□") {
                              charStyle = {
                                ...charStyle,
                                border: `1px solid ${COLORS.lightGray}`,
                              };
                            } else {
                              // hover는 CSS로 처리
                            }

                            return (
                              <span
                                key={charIndex}
                                className={charClass}
                                onClick={() => charId && handleCharClick(charId)}
                                style={charStyle}
                              >
                                {selectedChar}
                              </span>
                            );
                          })}
                        </div>
                        {/* 선택된 글자의 후보 목록 - 각 행 아래에 표시 */}
                        {showTable && (
                          <div className="mt-2 mb-3 flex flex-col gap-[8px]">
                            {/* 테이블 제목 및 유추 근거 및 번역 버튼 */}
                            <div className="flex items-center justify-between px-1">
                              <div
                                className="flex flex-col justify-center leading-[0] not-italic relative shrink-0 text-[#2a2a3a] text-[16px] text-nowrap tracking-[-0.32px] px-1"
                                style={{ fontWeight: 600 }}
                              >
                                <p className="leading-[normal] whitespace-pre">검수 대상 추천 한자</p>
                              </div>
                              <button
                                className="bg-white border border-solid box-border content-stretch flex gap-[4px] items-center justify-center px-[14px] py-2 relative rounded-[4px] shrink-0"
                                style={{ border: "1px solid #EBEDF8" }}
                                onClick={() => {
                                  // 1. 현재 타겟(selectedCharId)에 대해 이미 체크된 글자가 있는지 확인
                                  const preSelectedChar = selectedCharacters[selectedCharId];

                                  // 2. 있다면 그 글자를 팝업 초기 상태로 설정, 없다면 null
                                  setSelectedCharForCluster(preSelectedChar || null);

                                  // 3. 팝업 열기
                                  setShowReasonPopup(true);
                                }}
                              >
                                <svg className="w-[14px] h-[14px] flex-shrink-0" fill={COLORS.secondary} viewBox="0 0 20 20">
                                  <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                                </svg>
                                <span className="text-[12px] font-medium text-center whitespace-nowrap" style={{ color: COLORS.secondary }}>
                                  유추 근거 및 번역
                                </span>
                              </button>
                            </div>
                            {/* 테이블 */}
                            <div className="border border-[#EBEDF8] rounded-[8px] overflow-hidden">
                              {/* 테이블 헤더 */}
                              <div className="bg-[#F6F7FE] border-b border-[#EBEDF8] px-4 py-3">
                                <div className="flex items-center gap-4 text-xs font-medium text-[#484a64]">
                                  <span className="w-[64px]">글자 선택</span>
                                  <span className="w-[64px]">한자</span>
                                  <span className="w-[64px] whitespace-nowrap">전체 신뢰도</span>
                                  <span className="w-[56px] text-xs">획 일치도</span>
                                  <span className="w-[56px] text-xs whitespace-nowrap">문맥 일치도</span>
                                </div>
                              </div>
                              {/* 테이블 바디 */}
                              <div>
                                {(candidates[selectedCharId] || []).map((candidate, idx) => {
                                  // null 값 처리 (교집합이 5개 미만일 때)
                                  if (candidate.character === null) {
                                    return (
                                      <div
                                        key={idx}
                                        className="flex items-center gap-4 px-4 py-4 border-b border-[#F6F7FE] last:border-b-0 bg-gray-50"
                                      >
                                        <div className="w-[64px] flex items-center">
                                          <div className="w-4 h-4"></div>
                                        </div>
                                        <span className="w-[64px] text-gray-400" style={{ fontSize: "20px", lineHeight: "1" }}>
                                          -
                                        </span>
                                        <span className="w-[64px] text-xs text-gray-400">-</span>
                                        <span className="w-[56px] text-xs text-gray-400">-</span>
                                        <span className="w-[56px] text-xs text-gray-400">-</span>
                                      </div>
                                    );
                                  }

                                  return (
                                    <div
                                      key={idx}
                                      className="flex items-center gap-4 px-4 py-4 border-b border-[#F6F7FE] last:border-b-0 bg-white"
                                    >
                                      <div className="w-[64px] flex items-center">
                                        <input
                                          type="checkbox"
                                          checked={candidate.checked}
                                          onChange={() => handleCandidateCheck(selectedCharId, idx)}
                                          className="w-4 h-4 rounded border-[#c0c5dc] border-2 cursor-pointer"
                                          style={{ accentColor: COLORS.secondary }}
                                        />
                                      </div>
                                      <span
                                        className="w-[64px] cursor-pointer hover:opacity-70 transition-opacity"
                                        style={{
                                          fontSize: "20px",
                                          lineHeight: "1",
                                          fontWeight: 500,
                                          color: candidate.checked ? COLORS.secondary : COLORS.darkGray,
                                          fontFamily: "'Noto Serif KR', 'HanaMinB', 'Batang', serif",
                                        }}
                                        onClick={() => {
                                          // 같은 글자를 다시 클릭하면 선택 해제
                                          if (selectedCharForCluster === candidate.character) {
                                            setSelectedCharForCluster(null);
                                          } else {
                                            setSelectedCharForCluster(candidate.character);
                                          }
                                        }}
                                      >
                                        {candidate.character}
                                      </span>
                                      <span
                                        className="w-[64px] text-xs whitespace-nowrap"
                                        style={{ color: candidate.checked ? COLORS.secondary : COLORS.darkGray }}
                                      >
                                        {candidate.reliability}
                                      </span>
                                      <span
                                        className="w-[56px] text-xs"
                                        style={{ color: candidate.checked ? COLORS.secondary : COLORS.darkGray }}
                                      >
                                        {candidate.strokeMatch === null ? "-" : `${candidate.strokeMatch.toFixed(1)}%`}
                                      </span>
                                      <span
                                        className="w-[56px] text-xs"
                                        style={{ color: candidate.checked ? COLORS.secondary : COLORS.darkGray }}
                                      >
                                        {candidate.contextMatch === null ? "-" : `${candidate.contextMatch.toFixed(1)}%`}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 유추 근거 및 번역 팝업 */}
      {showReasonPopup && (
        <>
          {/* 오버레이 배경 */}
          <div
            className="fixed inset-0 z-40"
            style={{
              backgroundColor: "rgba(0, 0, 0, 0.3)",
            }}
            onClick={() => setShowReasonPopup(false)}
          />
          {/* 팝업 */}
          <div
            className="fixed z-50 bg-white rounded-[16px] overflow-hidden"
            style={{
              top: "48px",
              bottom: "48px",
              left: "48px",
              right: "48px",
            }}
          >
            {/* 팝업 헤더 */}
            <div className="relative flex items-center justify-between px-10 py-8 border-b border-[#EBEDF8]">
              {/* 뒤로가기 버튼 */}
              <button
                onClick={() => setShowReasonPopup(false)}
                className="w-6 h-6 flex items-center justify-center hover:opacity-70 transition-opacity"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {/* 제목 */}
              <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2" style={{ fontWeight: 600 }}>
                <span className="text-[20px] text-[#2a2a3a] tracking-[-0.4px]">유추 근거 및 번역</span>
              </div>
              {/* 닫기 버튼 */}
              <button
                onClick={() => setShowReasonPopup(false)}
                className="w-6 h-6 flex items-center justify-center hover:opacity-70 transition-opacity"
              >
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
            {/* 팝업 내용 영역 */}
            <div className="h-[calc(100%-80px)] overflow-y-auto">
              {selectedCharId && candidates[selectedCharId] && allCandidates[selectedCharId] ? (
                <div className="flex flex-col gap-6 p-6">
                  {/* 위: ReasoningCluster (전체 너비, 전체 높이의 일부) */}
                  <div className="flex items-center justify-center bg-gray-50 rounded-lg p-4 min-h-[400px] w-full flex-shrink-0">
                    <ReasoningCluster
                      data={{
                        name: "Source Image",
                        type: "root",
                        imgUrl: reasoningData[selectedCharId]?.imgUrl
                          ? resolveImageUrl(reasoningData[selectedCharId].imgUrl)
                          : `/images/rubbings/processed/cropped/rubbing_${rubbingId}_target_${selectedCharId}.jpg`,
                        children: [
                          {
                            name: "Vision Model (Swin)",
                            type: "model",
                            children: (
                              reasoningData[selectedCharId]?.vision ||
                              allCandidates[selectedCharId].filter((c) => c.strokeMatch !== null && c.strokeMatch !== undefined)
                            )
                              .slice(0, 10)
                              .map((c, idx) => ({
                                name: c.character || c.hanja,
                                score: (c.strokeMatch || c.stroke_match || 0) / 100,
                                id: `v${idx}`,
                                type: "leaf",
                              })),
                          },
                          {
                            name: "NLP Model (RoBERTa)",
                            type: "model",
                            children: (
                              reasoningData[selectedCharId]?.nlp ||
                              allCandidates[selectedCharId].filter((c) => c.contextMatch !== null && c.contextMatch !== undefined)
                            )
                              .slice(0, 10)
                              .map((c, idx) => ({
                                name: c.character || c.hanja,
                                score: (c.contextMatch || c.context_match || 0) / 100,
                                id: `n${idx}`,
                                type: "leaf",
                              })),
                          },
                        ],
                      }}
                      selectedChar={selectedCharForCluster}
                      selectedReliability={
                        selectedCharForCluster
                          ? candidates[selectedCharId]?.find((c) => c.character === selectedCharForCluster)?.reliability
                          : null
                      }
                      height={400}
                    />
                  </div>

                  {/* 아래: 좌우 분할 (왼쪽: 검수 대상 추천 한자, 오른쪽: 번역문 해석) */}
                  <div className="flex gap-6 w-full" style={{ minHeight: "400px" }}>
                    {/* 왼쪽: 검수 대상 추천 한자 (절반) */}
                    <div className="flex-1 flex-shrink-0 flex flex-col min-w-0" style={{ minHeight: 0 }}>
                      <div className="mb-3 flex-shrink-0 flex items-center" style={{ height: "28px" }}>
                        <div
                          className="flex flex-col justify-center leading-[0] not-italic relative shrink-0 text-[#2a2a3a] text-[16px] text-nowrap tracking-[-0.32px]"
                          style={{ fontWeight: 600 }}
                        >
                          <p className="leading-[normal] whitespace-pre">검수 대상 추천 한자</p>
                        </div>
                      </div>
                      {/* 테이블 */}
                      <div className="border border-[#EBEDF8] rounded-[8px] overflow-hidden flex flex-col flex-1 min-h-0">
                        {/* 테이블 헤더 */}
                        <div className="bg-[#F6F7FE] border-b border-[#EBEDF8] px-4 py-3 flex-shrink-0">
                          <div className="flex items-center gap-4 text-xs font-medium text-[#484a64]">
                            <span className="w-[64px]">글자 선택</span>
                            <span className="w-[64px]">한자</span>
                            <span className="w-[64px] whitespace-nowrap">전체 신뢰도</span>
                            <span className="w-[56px] text-xs">획 일치도</span>
                            <span className="w-[56px] text-xs whitespace-nowrap">문맥 일치도</span>
                          </div>
                        </div>
                        {/* 테이블 바디 */}
                        <div className="flex-1 overflow-y-auto min-h-0">
                          {candidates[selectedCharId].map((candidate, idx) => (
                            <div
                              key={idx}
                              className={`flex items-center gap-4 px-4 bg-white cursor-pointer hover:bg-gray-50 transition-colors ${
                                idx < candidates[selectedCharId].length - 1 ? "border-b border-[#F6F7FE]" : ""
                              } ${selectedCharForCluster === candidate.character ? "bg-blue-50" : ""}`}
                              style={{ minHeight: "56px", paddingTop: "16px", paddingBottom: "16px" }}
                              onClick={() => {
                                if (selectedCharForCluster === candidate.character) {
                                  // 체크 해제 시, 이미 저장된 선택된 글자가 있으면 그것을 사용
                                  const savedChar = selectedCharacters[selectedCharId];
                                  setSelectedCharForCluster(savedChar || null);
                                  // 번역 미리보기 (저장된 글자로)
                                  if (savedChar && rubbingDetail.id) {
                                    const target = restorationTargets.find((t) => t.id === selectedCharId);
                                    if (target) {
                                      setIsLoadingTranslation(true);
                                      previewTranslation(rubbingDetail.id, selectedCharId, savedChar)
                                        .then((data) => {
                                          setTranslation({
                                            original: data.original || "",
                                            translation: data.translation || "",
                                            selectedCharIndex: data.selected_char_index !== undefined ? data.selected_char_index : -1,
                                          });
                                        })
                                        .catch((err) => {
                                          console.error("번역 미리보기 실패:", err);
                                        })
                                        .finally(() => {
                                          setIsLoadingTranslation(false);
                                        });
                                    }
                                  } else {
                                    // 저장된 글자도 없으면 원본 번역
                                    const target = restorationTargets.find((t) => t.id === selectedCharId);
                                    if (target && rubbingDetail.id) {
                                      setIsLoadingTranslation(true);
                                      getTranslation(rubbingDetail.id, selectedCharId)
                                        .then((data) => {
                                          setTranslation({
                                            original: data.original || "",
                                            translation: data.translation || "",
                                            selectedCharIndex: data.selected_char_index !== undefined ? data.selected_char_index : -1,
                                          });
                                        })
                                        .catch((err) => {
                                          console.error("번역 실패:", err);
                                        })
                                        .finally(() => {
                                          setIsLoadingTranslation(false);
                                        });
                                    }
                                  }
                                } else {
                                  setSelectedCharForCluster(candidate.character);
                                  // 번역 미리보기
                                  if (candidate.character && rubbingDetail.id && candidate.character !== null) {
                                    const target = restorationTargets.find((t) => t.id === selectedCharId);
                                    if (target) {
                                      setIsLoadingTranslation(true);
                                      previewTranslation(rubbingDetail.id, selectedCharId, candidate.character)
                                        .then((data) => {
                                          setTranslation({
                                            original: data.original || "",
                                            translation: data.translation || "",
                                            selectedCharIndex: data.selected_char_index !== undefined ? data.selected_char_index : -1,
                                          });
                                        })
                                        .catch((err) => {
                                          console.error("번역 미리보기 실패:", err);
                                        })
                                        .finally(() => {
                                          setIsLoadingTranslation(false);
                                        });
                                    }
                                  }
                                }
                              }}
                            >
                              <div className="w-[64px] flex items-center">
                                <input
                                  type="checkbox"
                                  checked={candidate.checked}
                                  onChange={(e) => {
                                    e.stopPropagation();
                                    handleCandidateCheck(selectedCharId, idx);
                                  }}
                                  className="w-4 h-4 rounded border-[#c0c5dc] border-2 cursor-pointer"
                                  style={{ accentColor: COLORS.secondary }}
                                />
                              </div>
                              <span
                                className="w-[64px]"
                                style={{
                                  fontSize: "20px",
                                  lineHeight: "1",
                                  fontWeight: 500,
                                  color: candidate.checked ? COLORS.secondary : COLORS.darkGray,
                                  fontFamily: "'Noto Serif KR', 'HanaMinB', 'Batang', serif",
                                }}
                              >
                                {candidate.character}
                              </span>
                              <span
                                className="w-[64px] text-xs whitespace-nowrap"
                                style={{ color: candidate.checked ? COLORS.secondary : COLORS.darkGray }}
                              >
                                {candidate.reliability}
                              </span>
                              <span className="w-[56px] text-xs" style={{ color: candidate.checked ? COLORS.secondary : COLORS.darkGray }}>
                                {candidate.strokeMatch === null ? "-" : `${candidate.strokeMatch.toFixed(1)}%`}
                              </span>
                              <span className="w-[56px] text-xs" style={{ color: candidate.checked ? COLORS.secondary : COLORS.darkGray }}>
                                {candidate.contextMatch === null ? "-" : `${candidate.contextMatch.toFixed(1)}%`}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* 오른쪽: 번역문 해석 (절반) */}
                    <div className="flex-1 flex-shrink-0 flex flex-col bg-white min-w-0" style={{ minHeight: 0 }}>
                      <div className="mb-3 flex-shrink-0 flex items-center justify-between" style={{ height: "28px" }}>
                        <div
                          className="flex flex-col justify-center leading-[0] not-italic relative shrink-0 text-[#2a2a3a] text-[16px] text-nowrap tracking-[-0.32px]"
                          style={{ fontWeight: 600 }}
                        >
                          <p className="leading-[normal] whitespace-pre">번역문 해석</p>
                        </div>
                        <button
                          onClick={async () => {
                            const target = restorationTargets.find((t) => t.id === selectedCharId);
                            if (!target || !rubbingDetail.id) return;

                            setIsLoadingTranslation(true);
                            try {
                              let data;

                              // ★ 핵심 수정 로직: 번역에 사용할 글자 결정 ★
                              // 1순위: 팝업 내에서 방금 클릭한 글자 (selectedCharForCluster)
                              // 2순위: 메인 리스트에서 체크해둔 글자 (selectedCharacters[selectedCharId])
                              const charToUse = selectedCharForCluster || selectedCharacters[selectedCharId];

                              if (charToUse) {
                                console.log("선택된 글자로 번역 진행:", charToUse);
                                // 선택된 글자가 있으므로 '미리보기 API' 호출 (치환 번역)
                                data = await previewTranslation(rubbingDetail.id, selectedCharId, charToUse);
                              } else {
                                // 선택된 글자가 아예 없으면 '기본 번역 API' 호출 (원본 □ 유지)
                                console.log("원본 텍스트(□) 번역 진행");
                                data = await getTranslation(rubbingDetail.id, selectedCharId);
                              }

                              // [수정] 번역 API가 반환하는 original, translation, selectedCharIndex를 모두 저장
                              setTranslation({
                                original: data.original || "",
                                translation: data.translation || "",
                                selectedCharIndex: data.selected_char_index !== undefined ? data.selected_char_index : -1,
                              });
                            } catch (error) {
                              console.error("번역 로드 실패:", error);
                              setTranslation({
                                original: "",
                                translation: "번역을 불러오는데 실패했습니다.",
                                selectedCharIndex: -1,
                              });
                            } finally {
                              setIsLoadingTranslation(false);
                            }
                          }}
                          disabled={isLoadingTranslation}
                          className="px-3 py-1.5 text-xs font-medium text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: COLORS.secondary }}
                        >
                          {isLoadingTranslation ? "번역 중..." : "번역 보기"}
                        </button>
                      </div>
                      <div
                        className="flex-1 overflow-y-auto min-h-0 border border-[#EBEDF8] rounded-[8px]"
                        style={{ padding: "16px 16px 12px 16px" }}
                      >
                        {translation.original || translation.translation ? (
                          <div className="flex flex-col gap-4">
                            {/* 원문 */}
                            <div>
                              <p className="text-xs text-gray-600 mb-2">원문</p>
                              <div className="p-4 bg-gray-50 rounded border border-gray-200">
                                <p className="text-base leading-relaxed" style={STYLES.textContainer}>
                                  {translation.original.split("").map((char, charIndex) => {
                                    // 선택된 글자의 정확한 인덱스 위치만 하이라이트
                                    const isHighlighted = translation.selectedCharIndex >= 0 && charIndex === translation.selectedCharIndex;

                                    return (
                                      <span
                                        key={charIndex}
                                        style={{
                                          color: isHighlighted ? COLORS.secondary : COLORS.textDark,
                                          backgroundColor: isHighlighted ? "#E8F4F8" : "transparent",
                                          fontWeight: isHighlighted ? 700 : 400,
                                          padding: isHighlighted ? "2px 4px" : "0",
                                          borderRadius: isHighlighted ? "4px" : "0",
                                          border: isHighlighted ? `1px solid ${COLORS.secondary}` : "none",
                                        }}
                                      >
                                        {char}
                                      </span>
                                    );
                                  })}
                                </p>
                              </div>
                            </div>
                            {/* 번역문 */}
                            <div>
                              <p className="text-xs text-gray-600 mb-2">번역문</p>
                              <div className="p-4 bg-gray-50 rounded border border-gray-200">
                                <p className="text-base leading-relaxed text-gray-700">
                                  {isLoadingTranslation
                                    ? "번역을 불러오는 중..."
                                    : translation.translation
                                    ? // 번역문에서 선택된 글자와 관련된 부분 하이라이트
                                      (() => {
                                        const translationText = translation.translation;
                                        const originalText = translation.original;

                                        // 원문에서 선택된 글자의 정확한 인덱스 위치 사용
                                        const selectedCharIndex = translation.selectedCharIndex;

                                        // 선택된 글자가 있으면 번역문에서 해당 위치 근처 하이라이트
                                        if (selectedCharIndex >= 0) {
                                          // 원문의 선택된 글자 위치 비율 계산
                                          const originalRatio = selectedCharIndex / originalText.length;

                                          // 번역문을 단어/문장 단위로 분리
                                          // 한문 번역은 보통 문장부호로 구분되므로 문장부호 기준으로 분리
                                          const parts = translationText.split(/([。，、！？\s])/);

                                          // 원문 위치 비율에 해당하는 번역문 위치 찾기
                                          const targetIndex = Math.floor(parts.length * originalRatio);

                                          return parts.map((part, idx) => {
                                            // 선택된 글자 위치 근처(±2 범위) 하이라이트
                                            const distance = Math.abs(idx - targetIndex);
                                            const shouldHighlight = distance <= 2 && part.trim().length > 0;

                                            return (
                                              <span
                                                key={idx}
                                                style={{
                                                  color: shouldHighlight ? COLORS.secondary : "inherit",
                                                  backgroundColor: shouldHighlight ? "#E8F4F8" : "transparent",
                                                  fontWeight: shouldHighlight ? 700 : 400,
                                                  padding: shouldHighlight ? "2px 4px" : "0",
                                                  borderRadius: shouldHighlight ? "4px" : "0",
                                                  border: shouldHighlight ? `1px solid ${COLORS.secondary}` : "none",
                                                }}
                                              >
                                                {part}
                                              </span>
                                            );
                                          });
                                        } else {
                                          // 선택된 글자가 없으면 일반 표시
                                          return translationText;
                                        }
                                      })()
                                    : "번역을 불러오는 중..."}
                                </p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <p className="text-sm text-gray-500">"번역 보기" 버튼을 클릭하여 번역을 확인하세요.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[400px]">
                  <div className="text-center">
                    <p className="text-gray-500 text-base mb-2">표에서 글자를 선택해주세요</p>
                    <p className="text-gray-400 text-sm">글자를 선택하면 유추 근거를 확인할 수 있습니다.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DetailPage;
