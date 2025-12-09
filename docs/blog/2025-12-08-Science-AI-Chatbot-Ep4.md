---
layout: single
title: "[Science AI Chatbot 개발기 Ep.4] 눈(Eyes), 교과서를 읽고 수업을 보조하는 AI"
categories: project
tag: [RAG, OCR, Tesseract.js, Embeddings, SemanticSearch, Node.js]
toc: true
toc_sticky: true
toc_label: "페이지 주요 목차"
author_profile: true
---

## 1. 문제: "선생님, 이 내용 교과서 어디에 있어요?"

AI 튜터에게 가장 중요한 것은 '정확성'이다.
그냥 인터넷에 있는 지식을 읊는 게 아니라, **교사가 수업 시간에 가르친 내용(교과서, 학습지)**을 바탕으로 대답해야 한다.
하지만 LLM은 우리 반 교과서 내용을 모른다.

*   **목표**: 교사가 업로드한 학습 자료(PDF, 이미지)를 AI가 이해하고, 학생 질문에 참고하게 하자.
*   **제약**: 학생들은 채팅창에 텍스트만 입력할 수 있다. (이미지 업로드 불가)
*   **해결책**: **OCR(광학 문자 인식)**과 **RAG(검색 증강 생성)** 기술을 이용해 선생님의 자료를 미리 '학습'시키자.

## 2. 콘텐츠 추출기 (Content Extractor)

우리는 `ContentExtractor.js`라는 모듈을 통해 선생님이 미리 올려둔 수업 자료를 AI가 이해할 수 있는 텍스트로 변환한다. 비용 절감을 위해 오픈소스 라이브러리를 적극 활용했다.

### 2.1. 이미지 자료 처리 (OCR)
과학 수업 특성상 도표나 그림 자료가 많다. `tesseract.js`를 이용해 이미지 속 텍스트를 추출한다.
```javascript
// functions/lib/contentExtractor.js
const { createWorker } = require('tesseract.js');

static async extractFromImage(buffer) {
    const worker = await createWorker('kor'); // 한국어 모델 로드
    const { data: { text } } = await worker.recognize(buffer);
    return text.trim();
}
```
이제 선생님이 "전기 회로도 그림"을 자료로 등록해두면, AI는 그 안에 적힌 "전지", "스위치" 등의 텍스트를 읽고 대화에 활용할 수 있다.

### 2.2. PDF 및 웹 파싱
교사가 업로드한 학습지(PDF)는 `pdf-parse`로, 참고 웹 링크는 `cheerio`로 긁어온다.
추출된 데이터는 속도를 위해 **Firestore에 캐싱**한다.

## 3. 의미 기반 검색 (Semantic Search)

방대한 수업 자료를 다 프롬프트에 넣을 수는 없다(비용 문제).
그래서 '지금 학생의 질문에 딱 필요한 부분'만 찾아내는 **RAG**가 필수다.

우리는 `SemanticSearch.js`에서 Gemini 1.5 Flash 모델을 심판관으로 활용한다.
단순 키워드 매칭이 아니라, **의미적 연관성**을 분석한다.

> **AI Judge의 판단 기준:**
> *   1.0: 직접적인 정답이 포함된 자료
> *   0.8: 매우 관련된 자료
> *   ...
> *   0.0: 관련 없음

```javascript
// functions/lib/semanticSearch.js
// 0.3점 이상인 자료(청크)만 선별하여 프롬프트에 주입
const sortedResources = scoredResources
    .filter(r => r.relevanceScore > 0.3)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
```

## 4. 실제 활용 시나리오

학생은 사진을 올릴 수 없지만, AI는 이미 선생님의 자료를 '보고' 있다.

*   **상황**: 선생님이 "실험 순서도" 이미지를 학습 자료로 등록함.
*   **학생**: "실험할 때 주의할 점이 뭐였죠?"
*   **AI**: (RAG로 실험 순서도 이미지 속 텍스트 검색) "아까 선생님이 나눠주신 자료의 3번째 순서를 기억하나요? '가열된 비커는 반드시 집게로 잡는다'라고 되어 있었죠?"

AI가 교과서 내용을 꿰뚫고 있으니, 학생은 마치 옆에서 선생님이 힌트를 주는 듯한 경험을 하게 된다.

## 5. 결론: "교사의 눈을 빌린 AI"

이 챗봇의 '시각'은 학생의 눈이 아니라 **교사의 눈**이다.
교사가 중요하게 생각하는 자료를 미리 읽혀둠으로써, AI는 단순한 챗봇이 아니라 '수업 보조 교사'가 된다.

다음 **Ep.5**에서는 이 똑똑한 AI가 학생에게 물고기를 잡아주는 대신 **"잡는 법"을 가르치는 방법(메타인지 전략)**에 대해 다룬다.
