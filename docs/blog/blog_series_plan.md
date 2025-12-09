# Science AI Chatbot 프로젝트 블로그 연재 계획

참고 문서(`2024-6-27-TPACK 기반 수업 디자이너 프로젝트(1).md`)의 형식과 톤앤매너를 반영하여, **Science AI Chatbot**의 방대한 기능과 교육적 철학을 체계적으로 전달하기 위한 시리즈를 기획했습니다.

## 시리즈 개요
- **시리즈 제목 (가안)**: "AI 튜터, 정답 그 이상을 가르치다: Science AI Chatbot 개발기"
- **목표**: 단순한 챗봇 개발기가 아닌, **교육적 가치(TPACK, 메타인지)**와 **최신 기술(OCR, RAG, Gemini)**이 어떻게 결합되었는지 보여주는 기술-교육 융합 콘텐츠

---

## 에피소드 구성 방안

### [Ep.1] 프로젝트의 시작: 왜 또 다른 AI 튜터인가?
**주제**: 개발 배경 및 핵심 교육 철학 (TPACK & 소크라테스식 대화법)
- **내용**:
    - 기존 챗봇의 한계 (단순 "정답 자판기" 문제)
    - **InnoClass**의 철학 계승 및 발전 시키기
    - 핵심 목표: "학생이 스스로 깨닫게 하는 AI" (소크라테스식 문답법)
    - **TPACK의 구현**: 단순한 기술(TK) 도입이 아닌, 교육학적 지식(PK)과 교과 지식(CK)을 AI 프롬프트에 결합한 사례
    - InnoClass에서 시작된 TPACK 철학이 어떻게 '실시간 AI 튜터'로 진화했는가?
- **주요 키워드**: `TPACK`, `Educational Technology`, `Socratic Method`

### [Ep.2] 아키텍처 & 기술 스택: 월 100원으로 20명 수업 돌리기
**주제**: 효율적인 시스템 설계 및 서버리스 아키텍처
- **내용**:
    - **Back**: Firebase Cloud Functions + Firestore (비용 효율성)
    - **Front**: Vanilla JS로 가볍고 빠른 클라이언트 구현
    - **AI**: Gemini 2.5 Flash / Flash-Lite 모델 선택 이유 (성능 vs 비용)
    - 데이터 흐름: 학생 질문 -> AI 분석 -> RAG/Prompting -> 답변
- **주요 키워드**: `Firebase`, `Serverless`, `Gemini API`, `Cost Optimization`

### [Ep.3] 뇌(Brain) 설계: 6가지 전략으로 반응하는 적응형 프롬프트
**주제**: 단순 LLM 호출을 넘어선 프롬프트 엔지니어링 (`promptBuilder.js`)
- **내용**:
    - **PK(Pedagogical Knowledge)의 코드화**: 소크라테스식 문답법과 피드백 비계를 프롬프트로 구현
    - 학생 반응 유형 자동 분류 (개념 질문, 탐색 교착, 실패 보고 등)
    - 각 유형별 맞춤형 대응 전략 (비유 설명, 힌트 제공, 가설 검증 유도)
    - `responseAnalyzer.js`가 학생의 의도를 파악하는 로직
- **주요 키워드**: `Prompt Engineering`, `Context Awareness`, `Adaptive Learning`

### [Ep.4] 눈(Eyes)을 뜨다: PDF와 이미지를 읽는 AI (RAG & OCR)
**주제**: 지능형 자료 처리 시스템 (`ContentExtractor`, `SemanticSearch`)
- **내용**:
    - 교사가 업로드한 PDF, 이미지 학습 자료 활용하기
    - **기술 구현**: `pdf-parse`와 `tesseract.js`를 이용한 텍스트/OCR 추출
    - **RAG(Retrieval-Augmented Generation)**: 학생 질문과 관련된 자료 내용만 쏙 뽑아 답변에 녹이는 법
    - "이거 모르겠어요" → "선생님이 주신 자료 3페이지 그림을 보세요"로 연결하는 과정
- **주요 키워드**: `RAG`, `OCR`, `Tesseract.js`, `Semantic Search`
 
### [Ep.5] 메타인지 & 교육 심리학의 구현: AI가 학생의 생각을 돕는 법
**주제**: 최신 업데이트 기능인 메타인지 스캐폴딩 집중 조명 (`AI_Tutor_Improvement_Implementation_Report.md` 기반)
- **내용**:
    - 답변을 바로 주지 않고 재질문을 유도하는 **'전략적 회피'**
    - 성찰적 학습 지원: "방금 배운 내용을 요약해볼까?"
    - 블룸의 택소노미(Bloom's Taxonomy) 기반 사고력 확장 질문
- **주요 키워드**: `Metacognition`, `Scaffolding`, `Bloom's Taxonomy`, `Self-Regulated Learning`

### [Ep.6] 선생님을 위한 비서: 대시보드와 데이터 분석
**주제**: 교사 경험(TX) 설계 및 데이터 시각화
- **내용**:
    - 수업 생성부터 QR 코드 배포까지의 워크플로우
    - 실시간 학생 대화 모니터링 & 피드백 시스템
    - 학생 데이터 분석 (참여도, 성취도) 및 CSV/리포트 생성
- **주요 키워드**: `Dashboard`, `Data Visualization`, `User Experience (UX)`

### [Ep.7] 미래의 교실: 로드맵과 회고
**주제**: 개발 과정의 시행착오와 향후 계획
- **내용**:
    - 개발 중 겪었던 어려움 (포트폴리오 데이터 처리, 모바일 UI 대응 등)
    - 앞으로의 계획: 음성 대화, 더 정교한 평가 모델
    - 오픈 소스 기여 및 커뮤니티 확산 목표
- **주요 키워드**: `Roadmap`, `Open Source`, `Retrospective`
