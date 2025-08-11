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

**최종 업데이트**: 2025년 1월 11일  
**개발자**: AI Assistant with Human Collaboration  
**라이선스**: MIT License
