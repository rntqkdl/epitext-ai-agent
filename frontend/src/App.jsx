import React, { useState } from "react";
import ListPage from "./pages/ListPage";
import UploadPopup from "./pages/UploadPopup";
import DetailPage from "./pages/DetailPage";
import Sidebar from "./components/Sidebar";
import { completeRubbings, uploadRubbing } from "./api/requests";

function App() {
  const [showUploadPopup, setShowUploadPopup] = useState(false);
  const [activeMenu, setActiveMenu] = useState("전체 기록");
  const [selectedItem, setSelectedItem] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0); // ListPage 새로고침을 위한 key

  // 메뉴 변경 핸들러 - DetailPage가 열려있으면 닫고 ListPage로 이동
  const handleMenuChange = (menu) => {
    setActiveMenu(menu);
    setSelectedItem(null); // DetailPage가 열려있으면 닫기
  };

  // 데이터 새로고침 트리거
  const triggerRefresh = () => {
    setRefreshKey((prev) => prev + 1);
  };

  // 복원 완료 처리
  const handleComplete = async (selectedIds) => {
    try {
      await completeRubbings(selectedIds);
      triggerRefresh(); // ListPage 새로고침
    } catch (err) {
      console.error("복원 완료 처리 실패:", err);
      alert("복원 완료 처리에 실패했습니다.");
    }
  };

  // 업로드 완료 처리
  const handleUploadComplete = async (rubbingData) => {
    try {
      if (!rubbingData || !rubbingData.id) {
        console.error("업로드된 탁본 데이터가 없습니다.");
        return;
      }

      // 업로드 완료 후 목록 새로고침
      setShowUploadPopup(false);
      triggerRefresh(); // ListPage 새로고침
      
      // 업로드된 탁본의 상세 페이지로 이동 (선택사항)
      // setSelectedItem(rubbingData);
    } catch (err) {
      console.error("업로드 완료 처리 실패:", err);
      alert("업로드 완료 처리에 실패했습니다.");
    }
  };

  return (
    <div className="flex h-screen w-screen bg-white overflow-hidden">
      <Sidebar activeMenu={activeMenu} setActiveMenu={handleMenuChange} />
      {selectedItem ? (
        <DetailPage item={selectedItem} onBack={() => setSelectedItem(null)} />
      ) : (
        <>
          <ListPage
            key={refreshKey} // refreshKey 변경 시 ListPage 재마운트하여 데이터 새로고침
            onUploadClick={() => setShowUploadPopup(true)}
            onComplete={handleComplete}
            onViewDetail={(item) => setSelectedItem(item)}
            activeMenu={activeMenu}
          />
          {showUploadPopup && <UploadPopup onClose={() => setShowUploadPopup(false)} onComplete={handleUploadComplete} />}
        </>
      )}
    </div>
  );
}

export default App;
