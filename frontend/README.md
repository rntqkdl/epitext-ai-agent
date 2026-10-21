<div><img src="https://capsule-render.vercel.app/api?type=waving&color=auto&height=340&section=header&text=EPITEXT&fontSize=90" /></div>

# 📜 프로젝트 소개

## 🤔 About

고려대학교 지능정보 SW 아카데미 7기 팀 복원왕 김탁본 입니다

## ☺️ 팀 멤버

| 이름 | 학과 | 이메일 | 담당 |
|---|---|---|---|
| 황동현 | 간호학과 | myjewel29@naver.com | 앙상블 문자 인식 기술([OCR](https://huggingface.co/donghyun95/EpiText-Hanja-OCR)) 설계 |
| 장예진 | 한국사학과 | dpwls6284@naver.com | [SikuRoBERTa](https://huggingface.co/jhangyejin/epitext-sikuroberta) 학습 및 번역 LLM 프롬프트 설계 |
| 안성민 | IT기전공학과 | tjdals2299@gmail.com | 이미지 전처리 및 [Swin V2](https://huggingface.co/ANSEONGMIN/hanja-swinv2) 학습 |
| 최준형 | 산업시스템공학과 | jbro2018@naver.com | EPITEXT 서비스 디자인 및 개발 |

## 🧑🏻‍💻 EPITEXT 소개

EPITEXT는 훼손·유실된 탁본(금석문) 문자를 멀티모달 AI로 복원하고, 최종 판독과 번역까지 이어지는 탁본 전문가 의사결정 지원 서비스입니다. 탁본 이미지를 업로드하면 전처리와 OCR 앙상블(Google Vision OCR + 고문서 특화 OCR) 로 텍스트를 추출하고, 글자 손상 정도를 자동 분류해 복원 전략을 달리 적용합니다. 형태가 완전히 사라진 영역은 언어 모델(SikuRoBERTa) 이 문맥 기반으로 추론하고, 일부 획이 남은 영역은 비전 모델(Swin V2) 까지 관여하여 잔여 획을 분석해 예측합니다. 두 모델의 결과는 F1 Score로 통합되어 Top-5 후보로 제시되며, 사용자는 번역 하이라이트를 통해 빠르고 신뢰성 있게 탁본 손상 영역을 검수·확정할 수 있습니다.

### 🎥 EPITEXT 시연 영상

[시연 영상 바로가기](https://www.youtube.com/watch?v=TJlI6UMyEFw)

## 🛠️ 기술 스택

### Frameworks & Environments
<div> <img src="https://img.shields.io/badge/React-61DAFB?style=for-the-badge&logo=react&logoColor=white"/> <img src="https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white"/> <img src="https://img.shields.io/badge/Flask-000000?style=for-the-badge&logo=flask&logoColor=white"/> </div>

### Frontend Stack
<div> <img src="https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=JavaScript&logoColor=white"/> <img src="https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white"/> <img src="https://img.shields.io/badge/Axios-5A29E4?style=for-the-badge&logo=axios&logoColor=white"/> <img src="https://img.shields.io/badge/D3.js-F9A03C?style=for-the-badge&logo=d3.js&logoColor=white"/> </div>

### Backend Stack
<div> <img src="https://img.shields.io/badge/Python-3776AB?style=for-the-badge&logo=python&logoColor=white"/> <img src="https://img.shields.io/badge/MySQL-4479A1?style=for-the-badge&logo=mysql&logoColor=white"/> <img src="https://img.shields.io/badge/SQLAlchemy-D71F00?style=for-the-badge&logo=sqlalchemy&logoColor=white"/> <img src="https://img.shields.io/badge/Flask_CORS-000000?style=for-the-badge&logo=flask&logoColor=white"/> </div>

### AI & Image Processing
<div> <img src="https://img.shields.io/badge/PyTorch-EE4C2C?style=for-the-badge&logo=pytorch&logoColor=white"/> <img src="https://img.shields.io/badge/OpenCV-5C3EE8?style=for-the-badge&logo=opencv&logoColor=white"/> <img src="https://img.shields.io/badge/Hugging_Face-FFD21E?style=for-the-badge&logo=hugging-face&logoColor=black"/> <img src="https://img.shields.io/badge/Google_Cloud_Vision-4285F4?style=for-the-badge&logo=google-cloud&logoColor=white"/> <img src="https://img.shields.io/badge/Google_Gemini-8E75C2?style=for-the-badge&logo=google-gemini&logoColor=white"/> </div>

# 🔋 EPITEXT Frontend

탁본 복원 관리 시스템의 프론트엔드 애플리케이션입니다. React 기반의 모던한 웹 인터페이스를 제공합니다.

서비스 Backend 소스 코드는 아래 GitHub 저장소에서 확인하실 수 있습니다.
- 🔗 Backend Repository: https://github.com/jae2022/Epitext_Back

## 🖥️ 시스템 요구사항

### 필수 요구사항

- **Node.js**: 16.x 이상 (18.x 이상 권장)
- **npm**: 7.x 이상 (또는 yarn, pnpm)
- **운영체제**: macOS, Linux, Windows

### 권장 사양

- **Node.js**: 18.x ~ 20.x
- **npm**: 9.x 이상

## 📦 설치 가이드

### 1단계: 저장소 클론

```bash
git clone <repository-url>
cd Epitext_Front
```

### 2단계: 의존성 패키지 설치

```bash
npm install
```

**예상 설치 시간**: 2-5분 (인터넷 속도에 따라 다름)

**주의사항**:
- 설치 중 오류가 발생하면 Node.js 버전을 확인하세요 (16 이상 필요).
- `node_modules` 폴더가 생성되면 정상적으로 설치된 것입니다.

## ⚙️ 환경 변수 설정

### 1. .env 파일 생성

프로젝트 루트(`Epitext_Front`)에 `.env` 파일을 생성합니다.

```bash
# macOS/Linux
touch .env

# Windows
type nul > .env
```

### 2. .env 파일 내용 작성

```bash
# 백엔드 API 서버 URL
VITE_API_BASE_URL=http://localhost:8000
```

**중요 사항**:
- Vite는 `VITE_` 접두사가 붙은 환경 변수만 클라이언트에서 사용할 수 있습니다.
- 백엔드 서버가 다른 포트에서 실행 중이면 URL을 변경하세요.
- 프로덕션 배포 시 실제 백엔드 서버 URL로 변경하세요.

### 3. 환경 변수 예시

**로컬 개발**:
```bash
VITE_API_BASE_URL=http://localhost:8000
```

**프로덕션**:
```bash
VITE_API_BASE_URL=https://api.epitext.com
```

## 🚀 개발 서버 실행

### 1. 개발 서버 시작

```bash
npm run dev
```

**예상 출력**:
```
  VITE v5.0.8  ready in 500 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
  ➜  press h + enter to show help
```

### 2. 브라우저에서 확인

브라우저에서 `http://localhost:5173`을 열면 EPITEXT 프론트엔드가 표시됩니다.

### 3. 백엔드 서버 확인

프론트엔드가 정상 작동하려면 백엔드 서버가 실행 중이어야 합니다.

**백엔드 서버 실행** (별도 터미널):
```bash
cd ../Epitext_Back
source venv/bin/activate  # macOS/Linux
python app.py
```

**백엔드 서버 확인**:
- `http://localhost:8000/health`에서 `{"status": "healthy"}` 응답 확인

## 🏗️ 빌드 및 배포

### 프로덕션 빌드

```bash
npm run build
```

**빌드 결과**: `dist/` 폴더에 생성됩니다.

### 빌드 미리보기

```bash
npm run preview
```

로컬에서 빌드된 결과를 미리볼 수 있습니다.

### 배포

`dist/` 폴더의 내용을 웹 서버(예: Nginx, Apache)에 업로드하면 됩니다.

**주의사항**:
- 배포 전 `.env` 파일의 `VITE_API_BASE_URL`을 프로덕션 백엔드 URL로 변경하세요.
- 빌드 후에는 환경 변수를 변경해도 반영되지 않으므로, 빌드 전에 설정해야 합니다.

## 📁 프로젝트 구조

```
Epitext_Front/
├── public/                     # 정적 파일
├── src/
│   ├── components/             # 재사용 가능한 컴포넌트
│   │   ├── Sidebar.jsx         # 사이드바 네비게이션
│   │   ├── TableRow.jsx        # 테이블 행 컴포넌트
│   │   └── ReasoningCluster.jsx # AI 복원 유추 근거 시각화 (D3.js)
│   ├── pages/                  # 페이지 컴포넌트
│   │   ├── ListPage.jsx        # 탁본 목록 페이지
│   │   ├── DetailPage.jsx      # 탁본 상세 정보 페이지
│   │   └── UploadPopup.jsx     # 탁본 업로드 팝업
│   ├── api/                    # API 클라이언트
│   │   ├── client.js           # Axios 인스턴스
│   │   └── requests.js        # API 요청 함수
│   ├── utils/                  # 유틸리티 함수
│   │   └── statusMapper.js     # 상태 매핑
│   ├── App.jsx                 # 메인 앱 컴포넌트 (라우팅)
│   ├── main.jsx                # 진입점
│   └── index.css               # 전역 스타일
├── index.html                  # HTML 템플릿
├── package.json                # 프로젝트 설정 및 의존성
├── vite.config.js             # Vite 설정
├── tailwind.config.js          # Tailwind CSS 설정
└── .env                        # 환경 변수 (gitignore)
```

## 🎨 주요 기능

### 1. 탁본 목록 관리

- **전체 기록**: 모든 탁본 목록 조회
- **복원 진행중**: 처리 중인 탁본 필터링
- **복원 완료**: 완료된 탁본 필터링
- **상태 표시**: 우수, 양호, 미흡, 처리중 등 상태 배지
- **체크박스 선택**: 개별 및 전체 선택 기능

### 2. 탁본 상세 정보

- **탁본 정보 카드**:
  - 이미지 미리보기
  - 파일명, 처리 일시, 처리 시간
  - 폰트 타입, 손상도
- **복원 대상 분포**: 원형 그래프로 시각화
- **검수 현황**: 진행률 및 신뢰도 통계

### 3. AI 복원 대상 검수

- **복원 대상 글자 표시**: 텍스트에서 `□`로 표시된 손상 글자
- **위치 버튼**: "N행 M자" 형식의 위치 표시
- **추천 한자 표**: 
  - 글자 선택 체크박스
  - 한자, 전체 신뢰도, 획 일치도, 문맥 일치도
  - 계층적 우선순위 정렬 (교집합 > NLP Only)
- **검수 상태 라디오 버튼**: 검수 미완료, 선택 글자, 검수 완료

### 4. 유추 근거 및 번역

- **유추 근거 시각화**: 
  - D3.js 기반 인터랙티브 그래프
  - Vision 모델과 NLP 모델의 추천 과정 시각화
  - 최종 신뢰도 계산 및 표시
- **번역 기능**:
  - 선택한 한자로 복원된 문장 번역
  - 원문과 번역문 동시 표시
  - 선택한 글자 하이라이트

### 5. 탁본 업로드

- **파일 업로드**: 이미지 파일 선택 및 업로드
- **처리 상태 확인**: 업로드 후 처리 진행 상황 확인

## 🎨 디자인 시스템

### 색상

#### 주요 색상

- **Primary Orange**: `#ee7542` - 사이드바 활성 메뉴, 복원 대상 분포 그래프, 주요 버튼
- **Secondary**: `#344D64` - 검수 현황 그래프, AI 복원 대상 검수, ReasoningCluster 노드
- **Light Orange**: `#FCE3D9` - 복원 대상 분포 그래프 배경
- **Light Secondary**: `#CCD2D8` - 검수 필요 영역, 비활성 버튼 배경

#### 텍스트 색상

- **Text Dark**: `#2a2a3a` - 주요 텍스트
- **Dark Gray**: `#484a64` - 테이블 헤더, 보조 텍스트
- **Gray4**: `#7F85A3` - 보조 텍스트, 설명 텍스트
- **Sidebar Text**: `#a18e7c` - 사이드바 섹션 라벨

#### 배경 및 테두리

- **Background**: `#F8F8FA` - 페이지 배경
- **Card Background**: `#F6F7FE` - 카드 배경, 테이블 헤더 배경
- **Border**: `#EBEDF8` - 테두리, 구분선
- **Checkbox Border**: `#c0c5dc` - 체크박스 테두리, ReasoningCluster 링크
- **Sidebar Background**: `#e2ddda` - 사이드바 배경
- **Table Header**: `#EEEEEE` - 테이블 헤더 배경

#### 상태 색상

- **우수**: `#50D192` (초록색)
- **양호**: `#FCDB65` (노란색)
- **미흡**: `#F87563` (빨간색)
- **처리중**: `#484A64` (다크 그레이)

### 폰트

- **UI 요소**: Pretendard (기본), Noto Sans KR, Noto Sans JP
- **한자 텍스트**: Noto Serif KR, HanaMinB, Batang, serif
  - 한자 복원 텍스트는 serif 폰트를 우선 사용하여 옛 문헌의 느낌 유지

## 🔧 문제 해결

### 문제 1: "Cannot find module" 오류

**원인**: 의존성이 설치되지 않음

**해결**:
```bash
rm -rf node_modules package-lock.json
npm install
```

### 문제 2: "Network Error" 또는 "CORS error"

**원인**: 백엔드 서버가 실행되지 않았거나 URL이 잘못됨

**해결**:
1. 백엔드 서버가 `http://localhost:8000`에서 실행 중인지 확인
2. `.env` 파일의 `VITE_API_BASE_URL`이 올바른지 확인
3. 브라우저 개발자 도구(F12) → Network 탭에서 실제 요청 URL 확인

### 문제 3: "Failed to fetch" 오류

**원인**: 백엔드 서버 연결 실패

**해결**:
1. 백엔드 서버가 실행 중인지 확인:
   ```bash
   curl http://localhost:8000/health
   ```
2. 백엔드 서버 로그 확인 (에러 메시지 확인)
3. 방화벽 또는 보안 소프트웨어가 포트를 차단하지 않는지 확인

### 문제 4: 페이지가 로드되지 않음

**원인**: 빌드 오류 또는 포트 충돌

**해결**:
1. 개발 서버 재시작:
   ```bash
   # Ctrl+C로 서버 종료 후
   npm run dev
   ```
2. 다른 포트 사용:
   ```bash
   npm run dev -- --port 3000
   ```

### 문제 5: 환경 변수가 적용되지 않음

**원인**: `.env` 파일이 없거나 잘못된 위치에 있음

**해결**:
1. `.env` 파일이 프로젝트 루트(`Epitext_Front/`)에 있는지 확인
2. 환경 변수 이름이 `VITE_`로 시작하는지 확인
3. 개발 서버 재시작 (환경 변수 변경 후 반드시 재시작 필요)

### 문제 6: 스타일이 적용되지 않음

**원인**: Tailwind CSS 빌드 문제

**해결**:
```bash
# node_modules 재설치
rm -rf node_modules
npm install

# 개발 서버 재시작
npm run dev
```

### 문제 7: 이미지가 표시되지 않음

**원인**: 이미지 경로 문제 또는 백엔드 이미지 서빙 문제

**해결**:
1. 브라우저 개발자 도구 → Network 탭에서 이미지 요청 확인
2. 백엔드 서버가 이미지를 정상적으로 서빙하는지 확인
3. 이미지 URL이 올바른지 확인 (백엔드 로그 확인)

## 📝 개발 팁

### 1. 두 개의 터미널 사용

- **터미널 1**: 백엔드 서버 (`python app.py`)
- **터미널 2**: 프론트엔드 서버 (`npm run dev`)

### 2. 개발자 도구 활용

- **브라우저 개발자 도구 (F12)**:
  - Console: JavaScript 오류 확인
  - Network: API 요청/응답 확인
  - React DevTools: 컴포넌트 상태 확인

### 3. Hot Module Replacement (HMR)

Vite는 HMR을 지원하므로, 코드 수정 시 자동으로 페이지가 새로고침됩니다.

### 4. API 요청 디버깅

`src/api/requests.js`에서 API 요청 함수를 확인하고, 브라우저 Network 탭에서 실제 요청/응답을 확인하세요.

## 🛠️ 기술 스택

- **React 18** - UI 라이브러리
- **Vite** - 빌드 도구 및 개발 서버
- **Tailwind CSS** - 유틸리티 기반 CSS 프레임워크
- **D3.js** - 데이터 시각화 라이브러리 (ReasoningCluster)
- **Axios** - HTTP 클라이언트
- **JavaScript (JSX)** - 프로그래밍 언어

## 📞 지원

문제가 발생하면 다음을 확인하세요:

1. Node.js 버전이 16 이상인지
2. 의존성이 모두 설치되었는지 (`npm install` 완료)
3. 백엔드 서버가 실행 중인지
4. 환경 변수가 올바르게 설정되었는지

## 🧩 Copyright
Copyright 2025. EPITEXT. All rights reserveed
