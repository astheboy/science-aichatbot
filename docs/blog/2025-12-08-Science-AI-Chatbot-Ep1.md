---
layout: single
title: "[Science AI Chatbot 개발기 Ep.1] AI 튜터, 정답 그 이상을 가르치다"
categories: project
tag: [AI, Chatbot, EdTech, TPACK, Gemini, Firebase, 교육공학, 소크라테스식문답법]
toc: true
toc_sticky: true
toc_label: "페이지 주요 목차"
author_profile: true
---

## 1. 시작하며: "답만 알려주는 AI는 교육적일까?"

최신 AI 기술을 교실에 가져오고 싶은 현직 교사로서의 고민을 기록으로 남긴다.

*   **배경**: ChatGPT, LLM의 등장. 누구나 1초 만에 정답을 얻는 세상.
*   **문제의식**: 
    *   학생들이 AI에게 질문하고 바로 답을 베끼는 것이 '학습'일까?
    *   단순한 지식 주입이 아닌, 사고력을 키워주는 도구가 필요함.
*   **핵심 철학**:
    *   **"정답을 주는 AI" (X) -> "생각을 끄집어내는 AI" (O)**   
    *   Socratic Method(소크라테스식 문답법)를 구사하는 AI 튜터 개발 결심.

## 2. 프로젝트 핵심 목표 (Key Objectives)

**InnoClass 수업 디자이너** 프로젝트의 연장선에서, 이번엔 **"수업 실행 도구"**를 만들기로 함.

*   **Thinking Partner**: 정답 자판기가 아닌 사고 파트너.
*   **Context Awareness**: 교실 상황과 학습 자료(PDF, 교과서)의 맥락 이해.
*   **Cost Effective**: 학교 예산으로 운영 가능한 100원 미만의 저비용 구조.

## 3. TPACK 모델의 구현 (Why TPACK?)

단순 챗봇 개발이 아님. 교육공학적 이론인 **TPACK**을 실제 코드로 구현하는 실험.

![TPACK Model](https://upload.wikimedia.org/wikipedia/commons/thumb/1/1d/TPACK-Model.png/600px-TPACK-Model.png)

### A. Technological Knowledge (TK)
*   **Engine**: Google Gemini 2.5 Flash/Pro (성능 vs 비용 최적화)
*   **Infra**: Firebase Serverless (Functions, Firestore)
*   **Vision**: OCR & RAG로 학습지/교과서 이미지 인식 구현

### B. Pedagogical Knowledge (PK) -> `promptBuilder.js`
*   **'교육학'을 프롬프트 엔지니어링으로 구현.**: 단순 친절한 말투가 아님. 
*   **비계(Scaffolding)**: 학생 수준에 맞춰 단계별 힌트 제공.
*   **실패 기반 학습**: "틀렸어"라고 말하지 않고, "왜 그렇게 생각했니?"라고 반문.
*   **메타인지**: 대화 끝에 스스로 학습 내용을 요약하게 유도.

### C. Content Knowledge (CK) -> `contentExtractor.js`
*   AI의 환각(Hallucination) 방지. 교과 내용에 기반한 답변.
*   교사가 업로드한 **PDF/이미지**를 벡터화하여 RAG로 참조.
*   결과: "34페이지 그림을 봐" 같이 구체적인 피드백 가능.

## 4. 개발 방향성 (Dev Log)

이 블로그 시리즈는 교사가 직접 AI 챗봇을 통제할 수 있을까에 대한 해답을 찾아가기 위한 삽질의 기록

*   **Front**: Vanilla JS (복잡한 프레임워크 배제, 속도 최적화)
*   **Back**: Firebase Functions (Node.js 20)
*   **Ops**: GitHub Actions, Jekyll Blog

## 5. 앞으로의 기록 (Roadmap)

다음 순서로 개발 과정을 정리할 예정.

*   **Ep.2 아키텍처**: 100원으로 운영하는 서버리스 구조
*   **Ep.3 Brain**: 프롬프트 엔지니어링 (학생 반응 6가지 유형 분류)
*   **Ep.4 Eyes**: OCR과 RAG로 교과서 읽기
*   **Ep.5 Metacognition**: 메타인지와 교육 심리학 적용
*   **Ep.6 Teacher Tools**: 교사 대시보드 UX
*   **Ep.7 Review**: 프로젝트 회고 및 오픈소스화
