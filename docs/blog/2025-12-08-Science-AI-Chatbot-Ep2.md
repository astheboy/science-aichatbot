---
layout: single
title: "[Science AI Chatbot 개발기 Ep.2] 월 100원으로 20명을 가르치는 아키텍처"
categories: project
tag: [Firebase, Serverless, Gemini, Architecture, CostOptimization, Backend]
toc: true
toc_sticky: true
toc_label: "페이지 주요 목차"
author_profile: true
---

## 1. 핵심 목표: "비용을 최소하기 위한 방안 모색"

지속적으로 챗봇을 사용하지 않을 예정이며, 수업이나 과목에 따라 필요한 경우 교사의 지시에 따라 AI 챗봇을 사용할 수 있도록 구현할 예정이다.

*   **목표**: 한 달에 100원 미만으로 1개 학급(20명) 운영하기.
*   **제약사항**:
    *   별도의 서버 관리 인력이 없음 (NoOps).
    *   트래픽이 특정 시간(수업 시간)에만 몰림.
    *   초기 비용 0원이어야 함.

## 2. 기술 스택 선정 (Tech Stack)

결론부터 말하면 **Google Firebase + Gemini API** 조합이 정답이었다.

### A. Frontend (Student & Teacher)
*   **Vanilla JS + HTML/CSS**: React나 Vue도 사치다.
    *   학생들이 구형 태블릿이나 저사양 스마트폰으로 접속해도 빨라야 함.
    *   번들링 없이 `public/` 폴더에 정적 파일로 배포.
    *   **Hosting**: Firebase Hosting (무료 등급).

### B. Backend (AI Logic)
*   **Firebase Cloud Functions (Node.js 20)**
    *   **onCall**: 클라이언트에서 함수처럼 호출 가능 (`api.js` 참조).
    *   서버를 24시간 켜둘 필요가 없음. 학생들이 질문할 때만 과금.
    *   **메모리/타임아웃**: 초기 설정(256MB)에서 AI 처리를 위해 `1GiB`, `300s`로 증설.

```javascript
// functions/index.js 설정 예시
setGlobalOptions({ 
    region: "asia-northeast3", // 한국 리전 (속도 최적화)
    timeoutSeconds: 300, 
    memory: "1GiB" 
});
```

### C. Database (State Management)
*   **Firestore (NoSQL)**
    *   실시간 대화 기록 저장 및 동기화.
    *   `sessions`: 학생별 세션 상태 관리 (게임화, 경험치 등).
    *   `teacher_keys`: 교사별 API Key와 프롬프트 설정 분리 (보안).

### D. AI Model (The Brain)
*   **Google Gemini 2.5 Flash / Flash-Lite**
    *   **Pro vs Flash**: Pro 모델은 똑똑하지만 비싸고 느림.
    *   **Flash**: 150만 토큰 컨텍스트 창을 가지면서도 압도적으로 저렴.
    *   특히 **Flash-Lite**는 교육용 챗봇에 차고 넘치는 성능을 보여주며 비용은 거의 0에 수렴.

## 3. 데이터 흐름 (Data Flow)

학생의 질문이 어떤 경로로 처리되는지 살펴보자.

1.  **Student**: "선생님, 오늘 달의 위상이 뭐예요?" (전송)
2.  **Cloud Functions (`getTutorResponse`)**: 요청 수신.
3.  **ResponseAnalyzer**: 학생 의도 파악 (개념 질문? 잡담? 오류 보고?).
4.  **RAG (ContentExtractor)**: 교사가 올린 PDF/이미지에서 '달의 위상' 관련 내용 추출.
5.  **PromptBuilder**: 교육학적 지침(PK) + 교과 내용(CK) + 학생 질문 합체.
6.  **Gemini API**: 완성된 프롬프트 전송 -> 답변 생성.
7.  **Gamification**: 답변 유형에 따라 경험치 부여 및 세션 업데이트.
8.  **Firestore**: 대화 로그 저장 (비동기 처리).
9.  **Student**: 화면에 답변 표시 및 경험치 바 상승 애니메이션.

## 4. 비용 최적화 전략 (Cost Tips)

어떻게 100원이 가능한가?

1.  **Stateless**: 대화 히스토리를 AI에게 매번 다 보내지 않음. 최근 N개 턴만 요약해서 전송.
2.  **Caching**: 추출한 PDF 텍스트나 OCR 결과는 Firestore에 캐싱하여 재사용.
3.  **Tiered AI**: 
    *   단순 인사말/잡담 -> 기본 로직 처리 (AI 호출 X).
    *   복잡한 추론 -> Gemini 호출.
    *   장문 분석 -> Flash 모델 사용.

## 5. 마치며

결국 이 아키텍처의 핵심은 **"필요할 때만 쓴다"**이다. 수업 시간 40분 동안만 트래픽이 발생하고, 방과 후에는 비용이 0원이다. 학교 환경에 최적화된 서버리스 구조 덕분에 지속 가능한 에듀테크가 가능해졌다.

다음 편에서는 이 시스템의 '뇌'에 해당하는 **프롬프트 엔지니어링(Brain)**, 즉 어떻게 AI에게 교육학을 가르쳤는지에 대해 다루겠다.
