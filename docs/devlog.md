# Science AI Chatbot 개발 로그

## 프로젝트 개요

**프로젝트명**: 그래비트랙스(GraviTrax) AI 튜터 챗봇  
**목적**: 초등학생들의 물리학 실험 학습을 돕는 AI 튜터 시스템  
**기술 스택**: 
- Frontend: HTML5, CSS3, JavaScript (ES6+)
- Backend: Firebase Functions (Node.js)
- Database: Firebase Firestore  
- AI: Google Gemini API
- Authentication: Firebase Authentication (Google OAuth)
- Hosting: Firebase Hosting

## 시스템 아키텍처

### 주요 컴포넌트
1. **학생용 챗봇 인터페이스** (`index.html`, `chatbot.js`)
   - 교사 코드 입력 시스템
   - 실시간 AI 대화 기능
   - 대화 히스토리 관리

2. **교사용 대시보드** (`teacher.html`)
   - Google OAuth 로그인
   - API 키 등록 및 관리
   - 커스텀 프롬프트 편집
   - 모델 선택 (향후 확장)

3. **관리자용 페이지** (`admin.html`)
   - 수동 교사 등록 (레거시 지원)

### Firebase Functions
- `getTutorResponse`: 교사별 커스텀 프롬프트로 AI 응답 생성
- `updateTeacherApiKey`: 교사 API 키 등록/업데이트  
- `getTeacherInfo`: 교사 정보 조회
- `updateTeacherPrompt`: 교사 프롬프트 편집
- `updateTeacherModel`: 교사 모델 선택 (백엔드 준비됨)
- `addTeacher`: 레거시 교사 등록

## 주요 개발 이력

### 2025년 1월 11일 - 프롬프트 시스템 전면 개편

#### 문제 상황
- 교사가 설정한 커스텀 프롬프트가 실제로 사용되지 않음
- `chatbot.js`의 하드코딩된 프롬프트만 사용되는 상태
- 교사별 맞춤화 불가능

#### 해결 방안
1. **백엔드 `getTutorResponse` 함수 완전 재작성**
   ```javascript
   // 기존: promptObject를 그대로 전달
   // 개선: userMessage와 conversationHistory를 받아 서버에서 프롬프트 생성
   const { teacherCode, userMessage, conversationHistory } = data;
   ```

2. **교사별 프롬프트 시스템 구현**
   ```javascript
   const customPrompt = teacherData.customPrompt || getDefaultPrompt();
   const fullPrompt = buildFullPrompt(customPrompt, userMessage, conversationHistory);
   ```

3. **프론트엔드 API 호출 단순화**
   ```javascript
   // 기존: 복잡한 프롬프트 생성 로직
   // 개선: 간단한 메시지 전달
   await callGeminiApi(teacherCode, userInput, conversationHistory);
   ```

#### 새로운 기능 추가

**1. 교사 프롬프트 편집 UI**
- 8줄 텍스트 영역으로 충분한 편집 공간 제공
- 실시간 미리보기 기능
- 기본값 되돌리기 원클릭 기능

**2. 모델 선택 시스템 (백엔드 완료)**
- 지원 모델: `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-1.0-pro`
- 기본 모델: `gemini-1.5-flash` (속도와 비용 최적화)
- 교사별 독립적 모델 선택 가능

**3. 기본 프롬프트 시스템**
```javascript
function getDefaultPrompt() {
    return "너는 친근하고 격려하는 과학 튜터야. 학생들이 그래비트랙스(GraviTrax) 실험을 통해 물리학 원리를 이해할 수 있도록 도와줘. 항상 긍정적이고 호기심을 유발하는 질문을 던져줘. 학생들의 질문에 대해 직접적인 답을 주기보다는, 스스로 생각해볼 수 있도록 힌트를 제공해줘.";
}
```

#### 데이터베이스 스키마 확장
```javascript
// teacher_keys 컬렉션 구조
{
  userId: string,           // Firebase Auth UID
  userEmail: string,        // 교사 이메일
  apiKey: string,          // Gemini API 키
  teacherCode: string,     // 학생용 교사 코드
  customPrompt?: string,   // 커스텀 프롬프트
  modelName?: string,      // 선택된 모델명
  createdAt: timestamp,
  updatedAt: timestamp
}
```

### 기술적 개선사항

**1. 보안 강화**
- 모든 API 키는 서버에서만 사용, 클라이언트 노출 없음
- Firebase Authentication으로 교사 인증 보장
- Firestore 보안 규칙로 데이터 접근 제어

**2. 성능 최적화**
- 대화 히스토리 최근 6턴으로 제한하여 토큰 사용량 최적화
- 함수 호출 횟수 최소화로 비용 절감

**3. 확장성 개선**
- 교사별 독립적 설정 관리
- 모델 선택 시스템으로 향후 확장성 확보
- 프롬프트 템플릿 시스템 기반 구축

## 배포 정보

- **메인 사이트**: https://science-aichatbot.web.app
- **교사 대시보드**: https://science-aichatbot.web.app/teacher.html
- **관리자 페이지**: https://science-aichatbot.web.app/admin.html

## 예상 운영 비용 (월간)

### 시나리오: 1개 학급 (학생 20명), 일 3-5회 AI 피드백
- **Google Gemini API**: ~$0.05 (약 70원)
- **Firebase Firestore**: $0 (무료 한도 내)
- **Firebase Functions**: $0 (무료 한도 내)
- **Firebase Hosting**: $0 (무료 한도 내)

**총 예상 비용**: 월 100원 미만 (거의 무료)

### 확장 시나리오: 10개 학급 (학생 200명)
- **총 예상 비용**: 월 $0.5 (약 700원)

## 다음 개발 계획

1. **교사 대시보드 모델 선택 UI 추가**
2. **프롬프트 템플릿 라이브러리 구축**
3. **학생 사용 통계 대시보드**
4. **다중 실험 주제 지원**

## 개발 노하우

### Firebase Functions 개발 팁
1. **로컬 테스트**: `firebase emulators:start` 활용
2. **에러 핸들링**: HttpsError 적극 활용으로 클라이언트에 명확한 에러 메시지 전달
3. **비용 최적화**: 토큰 수 계산하여 API 호출량 관리

### 프론트엔드 개발 팁
1. **Firebase SDK**: 모듈 방식 import로 번들 크기 최적화
2. **상태 관리**: localStorage 활용한 교사 코드 영속성
3. **UI/UX**: 로딩 상태 표시로 사용자 경험 향상

## 트러블슈팅 가이드

### 일반적인 문제들
1. **API 키 오류**: 교사 대시보드에서 올바른 Gemini API 키 확인
2. **캐시 문제**: 강제 새로고침 (Ctrl+F5) 또는 시크릿 모드 사용
3. **권한 오류**: Firebase 콘솔에서 Authentication 설정 확인

### 개발 환경 설정
```bash
# 프로젝트 설정
npm install -g firebase-tools
firebase login
firebase init

# 로컬 개발 서버
firebase serve
firebase emulators:start

# 배포
firebase deploy --only functions
firebase deploy --only hosting
```

---

## 2025년 1월 11일 - 적응적 프롬프트 시스템 및 최신 AI 모델 지원

### 작업 개요

교사가 요청한 다음 두 가지 핵심 기능을 구현하여 AI 튜터의 능동성과 최신 기술 지원을 크게 향상시켰습니다:

1. **학생 응답 유형별 적응적 프롬프트 시스템**: 학생의 발화 패턴을 실시간 분석하여 6가지 상황에 맞는 최적화된 AI 튜터 전략을 자동 적용
2. **최신 Gemini 2.0 모델 지원**: 기존 gemini-1.5-flash에서 최신 gemini-2.0-flash-exp를 기본으로 하고, 5가지 모델 중 선택 가능

### 새로운 핵심 기능

#### 1. 학생 응답 유형 자동 분석 및 적응적 프롬프트 적용

**구현된 응답 유형 분석 시스템:**
```javascript
// 6가지 학생 응답 유형 자동 감지
- CONCEPT_QUESTION: "에너지가 뭐예요?", "왜 그래요?" 
- EXPLORATION_DEADLOCK: "어떻게 해야 할지 모르겠어요", "막막해요"
- FAILURE_REPORT: "구슬이 떨어졌어요", "실패했어요"
- SUCCESS_WITHOUT_PRINCIPLE: "성공했어요!", "됐다!"
- HYPOTHESIS_INQUIRY: "만약 높이를 올리면?", "그래서 그런가요?"
- DEFAULT: 일반적인 상황
```

**각 유형별 전문화된 AI 튜터 전략:**
- **개념 질문**: 롤러코스터 등 일상적 비유 → 실험 연결 질문
- **탐색 교착**: 변인 탐색 안내 및 단계적 방향 제시  
- **실패 보고**: '중요한 단서' 인정 후 원인 추론 유도
- **무사고 성공**: 현상 → 과학적 원리 연결 질문
- **가설 제시**: 실험 설계 능력 강화 지원

#### 2. 최신 AI 모델 지원 시스템

**지원 모델 목록 (우선순위 순):**
```javascript
const availableModels = [
    'gemini-2.0-flash-exp',              // 기본 - 최신 고성능
    'gemini-2.0-flash-thinking-exp-1219', // 사고 남기기 기능
    'gemini-1.5-flash',                   // 빠른 속도, 저렴한 비용
    'gemini-1.5-pro',                     // 고품질 응답
    'gemini-1.0-pro'                      // 안정성
];
```

### 백엔드 아키텍처 업데이트

#### 새로운 Cloud Functions

1. **`getTeacherSettings`**: 유형별 프롬프트와 모델 설정을 포함한 전체 교사 설정 조회
2. **`updateTeacherPrompts`**: 6가지 응답 유형별 커스텀 프롬프트 업데이트
3. **`updateTeacherModel`**: AI 모델 선택 및 업데이트

#### 적응적 프롬프트 선택 로직
```javascript
// 실시간 응답 유형 분석
const responseType = analyzeStudentResponse(userMessage);

// 교사 커스텀 프롬프트 우선, 없으면 기본 프롬프트 사용
const adaptivePrompt = getPromptByResponseType(responseType, teacherData.customPrompts);

// 선택된 AI 모델로 응답 생성
const model = genAI.getGenerativeModel({ model: teacherData.modelName });
```

### 프론트엔드 UI 대폭 확장

#### 새로운 교사 대시보드 섹션

1. **AI 모델 선택 카드**
   - 드롭다운으로 5가지 모델 중 선택
   - 각 모델의 특성 안내 및 추천 표시

2. **유형별 프롬프트 설정 카드**
   - 6개 탭으로 구성된 직관적 인터페이스
   - 각 상황별 상세 설명 및 예시 제공
   - 개별/일괄 저장 및 기본값 복원 기능

#### 고급 UX 기능
- **탭 기반 네비게이션**: 6가지 응답 유형을 탭으로 구분하여 쉬운 관리
- **실시간 저장**: 각 설정의 독립적 저장 및 즉시 반영
- **기본값 복원**: 언제든 기본 프롬프트로 안전하게 되돌리기

### 데이터베이스 스키마 확장

```javascript
// teacher_keys 컬렉션 새 필드
{
  // 기존 필드들...
  modelName: 'gemini-2.0-flash-exp',        // 선택된 AI 모델
  customPrompts: {                           // 유형별 커스텀 프롬프트
    'DEFAULT': '기본 상황 프롬프트...',
    'CONCEPT_QUESTION': '개념 질문 프롬프트...',
    'EXPLORATION_DEADLOCK': '탐색 교착 프롬프트...',
    'FAILURE_REPORT': '실패 보고 프롬프트...',
    'SUCCESS_WITHOUT_PRINCIPLE': '무사고 성공 프롬프트...',
    'HYPOTHESIS_INQUIRY': '가설 제시 프롬프트...'
  }
}
```

### 교육적 효과 증대

#### 1. 진정한 적응형 AI 튜터 실현
- 학생의 학습 상태에 따른 맞춤형 피드백 자동 제공
- 교사의 교육 철학을 각 상황별로 세밀하게 반영 가능
- 소크라테스식 문답법의 상황별 전문화

#### 2. 최신 AI 기술 활용
- Gemini 2.0의 향상된 이해력과 추론 능력 활용
- 사고 과정 공개 모델로 투명한 AI 학습 지원
- 상황에 따른 모델 선택으로 최적의 성능/비용 균형

### 기술적 혁신

#### 정교한 자연어 처리
```javascript
// 한국어 패턴 매칭 최적화
const conceptQuestionPatterns = [
    /(무엇|뭐|뭘).*[이에]?요?\?*$/, 
    /왜.*[이에]?요?\?*$/,
    // ... 각 유형별 정규식 패턴
];
```

#### 확장 가능한 아키텍처
- 새로운 응답 유형 추가 용이
- 모델 목록 동적 확장 가능
- 프롬프트 템플릿 시스템 기반 구조

### 성능 및 비용 최적화

- **기본 모델 변경**: gemini-2.0-flash-exp (최신 성능, 기존 대비 동일한 비용)
- **적응적 프롬프트**: 상황별 최적화로 더 정확하고 간결한 응답 생성
- **모델 선택권**: 필요에 따라 속도 vs 품질의 균형점 조절 가능

### 다음 단계 계획

1. **응답 유형 확장**: 교사 피드백 기반 새로운 패턴 추가
2. **학습 분석**: 학생별 응답 유형 패턴 분석 대시보드
3. **협업 학습**: 그룹 활동 시 팀 상호작용 분석 및 지원
4. **다국어 지원**: 영어 패턴 분석 시스템 추가

---

## 2025년 1월 11일 - 최종 배포 및 UI 개선 완료

### 학생 페이지 UI 정리

**작업 내용:**
- 학생 챗봇 페이지 (https://science-aichatbot.web.app) 하단 푸터에서 "교사 페이지" 링크 제거
- 저작권 표시를 "Neo's Digital Lab | Gifted Education Prototype"에서 "© 2025 SangCode. All rights reserved."로 변경
- 학생들에게 더 깔끔하고 집중된 사용자 인터페이스 제공

### 실험 제출 현황 페이지 대폭 개선

#### 개인/그룹 리포트 레이아웃 최적화

**개인 리포트 (Individual Reports):**
- 3열 그리드의 강제 배치로 인한 큰 여백 문제 해결
- Flexbox 레이아웃으로 변경하여 학생 이름 태그가 자연스럽게 배치되도록 개선
- 화면 공간 활용도 향상 및 시각적 밸런스 개선

**그룹 리포트 (Group Reports):**
- 그룹 카드들을 오름차순으로 정렬 (Group 1, Group 2, ...)
- 카드 디자인 개선으로 제출 상태와 멤버 목록을 명확히 분리
- 그룹 구성원 표시용 태그 스타일 일관성 확보 (타원형 태그 통일)

#### QR 코드 사용성 향상

**모달 기능 추가:**
- QR 코드 클릭 시 확대된 모달 창 표시
- 스마트폰으로 스캔하기 쉽도록 큰 크기로 표시
- 모달 외부 클릭 또는 ESC 키로 닫기 가능

#### 모바일 UI 최적화

**반응형 디자인 개선:**
```css
@media (max-width: 768px) {
    .header h1 { font-size: 1.8rem; }
    .status-card h3 { font-size: 1rem; }
    .status-card { padding: 15px; }
}
```
- 작은 화면에서 헤더 및 카드 폰트 크기 조정
- 모바일 디바이스에서 터치 친화적 패딩 적용

#### 캐시 무효화 시스템

**브라우저 캐시 문제 해결:**
- 모든 HTML 파일에서 CSS 파일 참조에 쿼리 스트링 추가
- `styles.css?v=20250111-final` 형태로 캐시 무효화 강제 적용
- 스타일 업데이트가 즉시 반영되도록 보장

### 운영 비용 분석 (상세 계산)

#### 예상 사용량 기반 월간 비용

**시나리오 1: 소규모 운영 (1개 학급, 20명)**
- 일일 AI 상호작용: 60회 (학생당 3회)
- 월간 AI 요청: 1,800회
- 평균 토큰/요청: 500 토큰
- 월간 총 토큰: 900,000 토큰

**Google AI (Gemini) 비용:**
- Input 토큰 (70%): 630K × $0.000015 = $0.009
- Output 토큰 (30%): 270K × $0.00006 = $0.016
- **AI 총 비용: $0.025 (약 35원)**

**Firebase 비용:**
- Firestore 읽기/쓰기: 무료 한도 내
- Functions 호출: 무료 한도 내  
- Hosting: 무료
- **Firebase 총 비용: $0**

**월간 총 운영비용: 약 35원 (거의 무료)**

#### 대규모 확장 시나리오

**10개 학급 (200명) 운영 시:**
- 월간 AI 비용: $0.25 (약 350원)
- Firebase 비용: $0 (여전히 무료 한도 내)
- **총 운영비용: 월 350원**

### 기술적 성과 요약

#### 1. 사용자 경험 (UX) 대폭 향상
- 학생 페이지 UI 정리로 집중도 향상
- 제출 현황 페이지의 정보 가독성 개선
- QR 코드 모달로 실용성 증대
- 모바일 최적화로 접근성 확보

#### 2. 시각적 일관성 확보
- 모든 학생 태그 스타일 통일
- 카드 레이아웃의 시각적 균형 개선
- 반응형 디자인 적용

#### 3. 기술적 안정성
- 캐시 무효화로 업데이트 즉시 반영
- CSS 버전 관리 시스템 도입
- 브라우저 호환성 확보

#### 4. 비용 효율성
- 월간 운영비용 100원 미만으로 매우 경제적
- 확장 시에도 합리적인 비용 구조
- 완전 자동화로 인적 비용 최소화

### 배포 완료 및 서비스 준비

**최종 배포 사이트:**
- **학생 챗봇**: https://science-aichatbot.web.app
- **교사 대시보드**: https://science-aichatbot.web.app/teacher.html
- **제출 현황**: https://science-aichatbot.web.app/experiment-details.html

**서비스 준비도:**
✅ 학생용 인터페이스 완료 (UI 정리됨)  
✅ 교사용 대시보드 완료 (적응형 프롬프트, 최신 AI 모델 지원)  
✅ 실험 관리 시스템 완료 (개선된 제출 현황 표시)  
✅ 모바일 최적화 완료  
✅ 비용 효율적 운영 체계 확보  
✅ 캐시 관리 시스템 적용  

**실제 교육 현장 도입 가능 상태**

---

**최종 업데이트**: 2025년 1월 11일  
**개발자**: AI Assistant with Human Collaboration  
**라이선스**: MIT License
