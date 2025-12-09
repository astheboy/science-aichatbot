---
layout: single
title: "[Science AI Chatbot 개발기 Ep.5] 메타인지(Metacognition), 고기 잡는 법을 가르치는 AI"
categories: project
tag: [Metacognition, Scaffolding, BloomAndTaxonomy, EdTech, PromptEngineering]
toc: true
toc_sticky: true
toc_label: "페이지 주요 목차"
author_profile: true
---

## 1. 문제: "답만 알려주면 금방 까먹어요"

AI가 너무 똑똑해서 문제다. 학생이 "이 실험 왜 안 돼요?"라고 물으면, "전압이 낮아서 그래요"라고 바로 답을 준다.
학생은 고개를 끄덕이고 넘어가지만, **다음 번에 똑같은 실수를 반복한다.**
스스로 생각해서 답을 찾은 게 아니기 때문이다.

*   **목표**: 물고기(정답)를 주는 게 아니라, 물고기 잡는 법(사고 과정)을 가르쳐야 한다.
*   **해결책**: **메타인지 스캐폴딩(Metacognitive Scaffolding)** 전략 도입.

## 2. "진단 우선 (Diagnosis First)" 전략

우리는 `metacognitive_scaffolding.json` 설정을 통해 AI가 **'성급한 답변'**을 하지 못하도록 막았다.
학생이 답을 재촉할수록(Executive Request), AI는 오히려 더 차분하게 질문한다.

### 실제 프롬프트 예시 (Config 파일)
*   **상황**: "답 알려줘" (EXECUTIVE_REQUEST)
*   **AI의 반응**:
    > "정답을 바로 알고 싶은 마음 충분히 이해해요! 그런데 함께 차근차근 찾아가면 더 기억에 오래 남을 것 같아요. 먼저 실험을 다시 떠올려보면서, **어느 부분에서 예상과 다른 일이 일어났는지** 생각해볼까요?"

마치 노련한 선생님처럼, 학생의 조급함을 진정시키고 문제의 원인으로 시선을 돌리게 만든다.

## 3. 학습자 수준별 맞춤형 비계 (Adaptive Scaffolding)

모든 학생에게 같은 질문을 던지면 안 된다.
상위권 학생에게는 **도전적인 질문**을, 어려워하는 학생에게는 **구체적인 가이드**를 줘야 한다.

```json
// functions/config/metacognitive_scaffolding.json
"adaptive_scaffolding": {
  "high_ability_students": {
    "prompts": [
      "훌륭한 관찰이에요! 이 결과를 바탕으로 만약 조건을 바꾼다면 어떻게 될까요?"
    ]
  },
  "struggling_students": {
    "prompts": [
      "괜찮아요, 천천히 해봐요. 실험을 작은 단계로 나누어서 생각해보면 더 쉬워질 거예요."
    ]
  }
}
```
AI는 대화 패턴을 분석해 학생의 수준을 파악하고(Ep.3 참고), 그에 맞는 톤앤매너로 대화한다.

## 4. 성찰적 학습 (Reflective Learning): "방금 뭘 배웠지?"

수업이 끝날 때 가장 중요한 건 **회고**다.
`reflective_learning.json`은 대화 턴이 10회를 넘어가거나 주제가 바뀔 때, AI가 강제로 성찰을 유도하도록 설정되어 있다.

*   **Bloom's Taxonomy 기반 질문 생성**:
    *   **Level 1 (회상)**: "무엇을 관찰했나요?"
    *   **Level 4 (분석)**: "원인과 결과의 관계를 분석해보면?"
    *   **Level 6 (평가)**: "이 방법의 장점과 단점은 무엇인가요?"

이 질문들에 답하다 보면, 학생은 자연스럽게 오늘 배운 내용을 구조화하여 머릿속에 저장하게 된다.

## 5. 결론: "AI는 생각의 파트너"

이제 우리의 AI 챗봇은:
1.  **눈(Eyes)**으로 교과서를 보고 (Ep.4)
2.  **뇌(Brain)**로 학생의 의도를 파악하며 (Ep.3)
3.  **메타인지(Metacognition)**로 사고력을 키워준다. (Ep.5)

하지만 이 모든 일이 교실에서 실제로 어떻게 일어나는지 선생님은 어떻게 알 수 있을까?
AI와 학생의 1:1 대화는 블랙박스이기 쉽다.

다음 **Ep.6 Teacher Dashboard (TX)** 편에서는, 이 모든 학습 데이터를 시각화하여 선생님의 '제3의 눈'이 되어주는 대시보드 시스템을 소개한다.
