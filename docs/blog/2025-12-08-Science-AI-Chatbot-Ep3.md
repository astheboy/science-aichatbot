---
layout: single
title: "[Science AI Chatbot 개발기 Ep.3] 뇌(Brain), 6가지 전략으로 반응하는 프롬프트"
categories: project
tag: [PromptEngineering, AI, EdTech, Metacognition, Node.js, AdaptiveLearning]
toc: true
toc_sticky: true
toc_label: "페이지 주요 목차"
author_profile: true
---

## 1. 문제: "AI는 왜 자꾸 정답을 말할까?"

LLM(거대언어모델)은 기본적으로 '친절한 비서'로 학습되어 있다.
"달의 위상이 뭐야?"라고 물으면, 친절하게 싹 다 정리해서 알려준다.
이게 **교육적으로는 최악**이다. 학생이 생각할 기회를 박탈하기 때문이다.

*   **목표**: AI의 입을 막아야 한다. 대신 **질문**하게 만들어야 한다.
*   **해결책**: 학생의 발화 의도를 파악하고, 그에 맞는 **'교육학적 가면(Persona)'**을 바꿔 쓰게 하자.

## 2. 응답 분석기 (Response Analyzer)

우리는 학생의 채팅을 LLM에게 바로 던지지 않는다. 먼저 `ResponseAnalyzer.js`가 학생의 말을 분석한다.
단순한 키워드 매칭이 아니다. 정규표현식과 패턴 매칭을 통해 학생의 **인지 상태**를 6가지로 분류한다.

```javascript
// functions/lib/responseAnalyzer.js (분석 로직 예시)
const responseTypes = {
    CONCEPT_QUESTION: { patterns: [/무엇/, /뜻이/, /정의/] }, // 개념 질문
    EXPLORATION_DEADLOCK: { patterns: [/모르겠/, /어려워/, /막혔/] }, // 탐구 교착
    FAILURE_REPORT: { patterns: [/실패/, /안 돼/, /이상해/] }, // 실패 보고
    HYPOTHESIS_INQUIRY: { patterns: [/하면.*될까/, /가설/, /추측/] }, // 가설 설정
    // ... 총 6가지 유형
};
```

## 3. 적응형 프롬프트 빌더 (Prompt Builder)

분석된 유형에 따라 `PromptBuilder.js`가 AI에게 **"이번 턴에 연기해야 할 역할"**을 부여한다. 이것이 바로 우리가 구현한 **PK(Pedagogical Knowledge)**의 핵심이다.

### 전략 1: 개념 질문 (Concept Question)
*   **학생**: "관성이 뭐예요?"
*   **AI 지령**: "절대 정의를 말하지 마. 버스 급정거 같은 일상적 비유를 들어서 되물어봐."
*   **결과**: "버스가 갑자기 멈출 때 몸이 어떻게 되나요? 그 느낌이 관성이에요."

### 전략 2: 탐구 교착 (Exploration Deadlock)
*   **학생**: "실험하다가 막혔어요. 어떻게 해요?"
*   **AI 지령**: "직접 해결책을 주지 마. **비계(Scaffolding)**를 제공해. 가장 먼저 확인해야 할 변인이 뭔지 힌트만 줘."
*   **결과**: "지금 실험에서 물의 양은 확인해보셨나요?"

### 전략 3: 실패 보고 (Failure Report)
*   **학생**: "전구가 안 켜져요! 망했어요."
*   **AI 지령**: "**실패는 기회다.** 회로 연결을 다시 점검하게 유도해. 긍정적인 피드백을 줘."
*   **결과**: "오, 흥미로운 발견이네요! 전지의 +극과 -극이 잘 연결되었는지 살펴볼까요?"

## 4. 메타인지와 성찰 (Metacognition & Reflection)

최근 업데이트(v2.1)로 **'메타인지 스캐폴딩'** 기능이 추가되었다.
학생이 정답만 요구하거(Executive Request)나 학습이 끝났을 때, AI는 집요하게 성찰을 요구한다.

*   **진단 우선**: "답 알려줘" -> "어느 부분까지 이해했나요?" (역질문)
*   **성찰 유도**: 대화가 10턴 이상 지속되면 -> "지금까지 알게 된 내용을 요약해볼까요?"

```javascript
// 학습 깊이(Bloom's Taxonomy)에 따른 질문 생성
if (depthLevel >= 4) { // 분석 단계 이상이면
    prompt += "이 개념을 다른 상황(예: 놀이공원)에 적용하면 어떨까요?";
}
```

## 5. 결론: "프롬프트가 곧 선생님의 노하우"

결국 이 챗봇의 지능은 LLM의 성능이 아니라, **교사가 설계한 프롬프트의 정교함**에서 나온다.
우리는 `promptBuilder.js`를 통해 교사의 수업 노하우를 코드로 번역하고 있다.

다음 편에서는 이 똑똑한 뇌에 **시각(Eyes)**을 달아주는 **OCR과 RAG 기술**에 대해 다루겠다. 교과서 그림을 보고 대화하는 마법 같은 기능을 소개한다.
