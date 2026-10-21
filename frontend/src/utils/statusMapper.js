/**
 * 메뉴 이름을 API status 파라미터로 변환
 * @param {string} activeMenu - 활성 메뉴 이름
 * @returns {string|null} API status 파라미터
 */
export const menuToStatus = (activeMenu) => {
  if (activeMenu === "복원 완료") {
    return "completed";
  } else if (activeMenu === "복원 진행중") {
    return "in_progress";
  }
  return null;
};
