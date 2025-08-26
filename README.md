# 🤖 Science AI Chatbot - AI 교육 플랫폼

> **그래비트랙스 물리 실험에서 시작해 전과목 지원 AI 교육 플랫폼으로 진화한 완성형 시스템**

[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Google AI](https://img.shields.io/badge/Google%20AI-4285F4?style=for-the-badge&logo=google&logoColor=white)](https://ai.google.dev/)
[![License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE)

## 🌟 프로젝트 개요

**Science AI Chatbot**은 초등학생들의 학습을 돕는 차세대 AI 교육 플랫폼입니다. 단순한 그래비트랙스 실험 도구에서 시작하여 **전 과목을 지원하는 완전한 교육 관리 시스템**으로 발전했습니다.

### ✨ 핵심 특징
- 🧠 **적응형 AI 튜터**: 학생 응답 유형을 실시간 분석하여 6가지 맞춤형 교수 전략 자동 적용
- 📚 **교육 관리 플랫폼**: 수업 생성, 학생 관리, 과제 제출, 성과 분석까지 완전한 교육 워크플로우 지원
- 👩‍🏫 **교사 중심 설계**: 직관적인 대시보드로 수업 관리, AI 프롬프트 편집, 학생 분석 가능
- 📱 **QR 코드 시스템**: 학생들이 스마트폰으로 바로 접속할 수 있는 편리한 시스템
- 💰 **경제적 운영**: 월 100원 미만으로 20명 학급 운영 가능
- 📊 **완전한 학습 관리**: 개인-AI 튜터 대화 실시간 기록 및 확인, 실시간 제출 현황, AI 피드백 자동 생성

### 🎓 교육적 혁신
- **소크라테스식 교수법**: 답을 직접 알려주지 않고 학생 스스로 깨닫도록 유도
- **구성주의 학습**: 학생의 기존 지식과 경험을 바탕으로 한 의미 있는 학습 지원
- **개별화 교육**: 학생별 학습 패턴 분석을 통한 맞춤형 교수 전략 제공
- **메타인지 발달**: 학습 과정에 대한 성찰과 자기 주도적 학습 능력 강화

## 🌐 배포 주소

- **학생용 메인**: https://science-aichatbot.web.app
- **교사 대시보드**: https://science-aichatbot.web.app/teacher.html
- **소개 페이지**: https://science-aichatbot.web.app/introduction.html

## 🏗️ 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase Functions (Node.js 20)
- **Database**: Firebase Firestore
- **AI**: Google Gemini API (2.5 Flash-Lite, 2.0 Flash, 2.0 Flash-Lite 지원)
- **Authentication**: Firebase Authentication (Google OAuth)
- **Hosting**: Firebase Hosting
- **Storage**: Firebase Storage (파일 업로드 지원)

## 🚀 주요 기능

### 👨‍🏫 교사용 대시보드
- **Google OAuth 인증**: 안전한 교사 인증 시스템
- **수업 관리**: 수업 생성, 편집, QR 코드 자동 생성 및 자료 업로드
- **학생 관리**: 제출 현황 실시간 모니터링
- **채팅 관리**: 개인 대화 저장, 제출 현황 추적, AI 피드백 자동 생성
- **AI 튜터 관리**: 커스텀 프롬프트 편집, 6가지 응답 유형별 맞춤 설정
- **성과 분석**: 학생별 대화 포트폴리오, 학습 패턴 분석, CSV 다운로드

### 👨‍🎓 학생용 기능
- **간편한 접속**: QR 코드 또는 수업 코드로 즉시 AI 튜터와 대화 시작
- **적응형 학습**: 스스로 깨달을 수 있도록 유도하는 맞춤형 AI 응답 및 질문형 학습
- **과목별 AI 튜터**: 각 과목에 학생들의 응답 유형에 맞는 AI 튜터 페르소나
- **학습 자료**: 교사가 업로드한 참고 자료 및 링크 접근

### 🔍 적응형 프롬프트 시스템(과학 예시)
학생의 응답을 6가지 유형으로 자동 분류하여 맞춤형 교수 전략 적용:

1. **CONCEPT_QUESTION**: 개념 질문 시 일상적 비유로 설명
2. **EXPLORATION_DEADLOCK**: 탐색 교착 상태 시 단계적 안내
3. **FAILURE_REPORT**: 실패 보고 시 원인 추론 유도
4. **SUCCESS_WITHOUT_PRINCIPLE**: 성공 시 과학적 원리 연결
5. **HYPOTHESIS_INQUIRY**: 가설 제시 시 실험 설계 지원
6. **DEFAULT**: 일반적 상황 대응

## 🔧 기술적 특징

### 완전한 교육 관리 시스템
- **수업 라이프사이클**: 생성 → 수업 관리 → 제출 현황 → 대화 분석
- **실시간 모니터링**: 학생별 AI 튜터 대화 현황 실시간 추적
- **파일 관리**: Firebase Storage를 활용한 안전한 파일 업로드 및 관리
- **자동화 워크플로우**: AI 피드백 자동 생성, 학생 개별 기록 생성

### 보안성
- **API 키 보호**: 모든 AI 요청은 서버사이드에서 처리
- **Firestore 보안 규칙**: 적절한 데이터 접근 권한 관리
- **사용자 인증**: Google OAuth 기반 안전한 교사 인증

### 확장성
- **다중 교사 지원**: 독립적인 교사별 환경
- **모듈러 아키텍처**: 새로운 과목 및 기능 확장 용이
- **반응형 디자인**: 데스크톱, 태블릿, 모바일 최적화

## 📊 예상 비용

1학급 20명, 월 활발한 사용 기준:
- **Google AI (Gemini)**: 월 약 70원
- **Firebase (Firestore, Functions, Storage)**: 무료 tier 범위 내
- **총 예상 비용**: **월 100원 미만**

## 📁 프로젝트 구조

```
science-aichatbot/
├── public/                     # 프론트엔드 파일
│   ├── index.html              # 학생용 챗봇 메인
│   ├── teacher.html            # 교사 대시보드
│   ├── introduction.html       # 소개 페이지
│   ├── style.css               # 통합 스타일시트
│   ├── api.js                  # API 호출 유틸리티
│   ├── chatbot.js              # AI 챗봇 로직
│   ├── main.js                 # 공용 초기화 로직
│   ├── content.js              # 정적 콘텐츠
│   ├── firebase-config.js      # Firebase 설정
│   └── favicon.svg
├── functions/                  # Firebase Functions
│   ├── index.js                # 백엔드 로직 (AI 호출, 데이터 관리)
│   ├── package.json
│   ├── lib/                    # 서버 모듈들
│   │   ├── subjectLoader.js
│   │   ├── responseAnalyzer.js
│   │   ├── promptBuilder.js
│   │   └── gamificationManager.js
│   └── prompts/                # 과목별 프롬프트 설정
│       ├── student_response_analysis_science.json
│       ├── student_response_analysis_math.json
│       ├── student_response_analysis_korean.json
│       └── student_response_analysis_social.json
├── firestore.rules             # Firestore 보안 규칙
├── firestore.indexes.json      # Firestore 인덱스 설정
├── docs/
│   └── archive/
│       ├── comprehensive-development-plan.md
│       └── development-plan-phase1.md
├── devlog.md                   # 상세한 개발 기록
└── README.md                   # 프로젝트 가이드
```

## 🎯 시작하기

### 교사용 (권장)
1. https://science-aichatbot.web.app/teacher.html 접속
2. Google 계정으로 로그인
3. Gemini API 키 등록 ([API 키 발급](https://aistudio.google.com/apikey))
4. 첫 번째 수업 생성 및 학생 등록
5. 생성된 QR 코드를 학생들에게 공유

### 학생용
1. 교사가 제공한 QR 코드 스캔 또는 수업 코드 입력
2. AI 튜터와 대화하며 학습
3. 과제가 있는 경우 보고서 작성 및 제출

## 🏆 최신 업데이트 (2025년 8월 26일)

- 레거시 정리: public/admin.html 및 examples/ 폴더 제거
- Functions 정리: 레거시 수동 교사 등록 함수(exports.addTeacher) 제거
- 문서 구조 정리: comprehensive-development-plan.md, development-plan-phase1.md를 docs/archive/로 이동
- README 정리: 배포 주소와 프로젝트 구조를 현재 코드베이스와 일치하도록 업데이트

## 🏆 최신 업데이트 (2025년 8월 19일)

### ✨ 교사 대시보드 개선
- **수업 정보 편집 시스템**: AI 지시사항과 학생 설명의 명확한 분리
- **자료 관리**: 파일 업로드 및 링크 관리 기능
- **레이아웃 개선**: 모바일 친화적 반응형 디자인
- **실시간 현황**: 학생의 제출한 대화 실시간 기록 및 분석

### 🤖 AI 시스템 고도화
- **최신 모델 지원**: Gemini 2.0 Flash 등 최신 AI 모델 지원
- **맞춤형 프롬프트**: 교사가 직접 편집 가능한 AI 지시사항
- **자동 피드백**: 제출된 대화에 대한 즉시 AI 피드백 생성

### 🔧 시스템 안정성
- **하위 호환성**: 기존 데이터와 완벽한 호환성 유지
- **오류 처리**: 견고한 에러 핸들링 및 사용자 피드백
- **성능 최적화**: 캐시 버스팅 및 로딩 성능 개선

## 💡 교육적 가치

- **교사 업무 효율화**: 수업 준비부터 학생의 학습 성과 분석까지 통합 관리
- **개별화 교육**: AI 기반 맞춤형 학습 지원
- **메타인지 강화**: 학습 과정 성찰 및 피드백 시스템
- **디지털 리터러시**: 현대적 도구 활용 능력 배양

## 🤝 기여하기

1. Fork 프로젝트
2. Feature 브랜치 생성 (`git checkout -b feature/AmazingFeature`)
3. 변경사항 커밋 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 Push (`git push origin feature/AmazingFeature`)
5. Pull Request 오픈

## 📝 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다.

---

**개발**: SangCode.dev  
**최종 업데이트**: 2025년 8월 26일  
**프로젝트 상태**: AI-튜터 교육 플랫폼

> 이 프로젝트는 AI를 활용한 교육 혁신을 목표로 하며, 확장 가능하고 유지보수가 용이한 아키텍처를 바탕으로 지속적으로 발전하고 있습니다.
