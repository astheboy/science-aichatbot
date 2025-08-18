# 🚀 1단계: 수업 설명 기반 핵심 프롬프트 시스템

## 개요
교사가 입력하는 '수업 설명'을 AI 튜터의 핵심 지식 및 역할을 규정하는 메인 프롬프트로 활용하는 시스템을 구현합니다.

## 🎯 목표
- 범용적인 '과학 튜터'에서 **전문화된 수업별 AI 튜터**로 진화
- 예: '분수의 나눗셈 원리 탐구 튜터', '조선시대 문화 전문가 튜터' 등

## 📋 구현 계획

### 1. 백엔드 수정 (functions/index.js)

```javascript
// getTutorResponse 함수 내 수정
const lessonData = lessonDoc.data();
const lessonDescription = lessonData.description || null; // 수업 설명 가져오기

const teacherDataWithSubject = { 
    ...teacherData,
    subject: lessonData.subject || 'science',
    topic: lessonData.title
};

// PromptBuilder에 lessonDescription 전달
const fullPrompt = await PromptBuilder.buildFullPrompt(
    analysisResult, 
    userMessage, 
    conversationHistory, 
    teacherDataWithSubject, 
    lessonDescription // 새로운 인자 추가
);
```

### 2. PromptBuilder.js 수정

```javascript
// buildFullPrompt 함수 시그니처 변경
static async buildFullPrompt(analysisResult, userMessage, conversationHistory = [], teacherData = {}, lessonDescription = null) {
    // ... 기존 로직

    // 5. 최종 프롬프트 조합 시 lessonDescription 전달
    const systemInstruction = this.combinePromptElements(
        basePrompt,
        educationalContext,
        subjectRules,
        conversationContext,
        teacherData,
        lessonDescription // 새로운 인자 추가
    );
}

// combinePromptElements 함수 수정
static combinePromptElements(basePrompt, educationalContext, subjectRules, conversationContext, teacherData, lessonDescription) {
    let systemInstruction = "";

    // 1. 수업 설명 (핵심 지식 및 역할) 최우선 배치
    if (lessonDescription) {
        systemInstruction += `### 🎯 수업 목표 및 AI 튜터 핵심 역할 ###\n`;
        systemInstruction += `${lessonDescription}\n\n`;
        systemInstruction += `위의 수업 목표와 맥락을 바탕으로 학생을 가르치는 전문 AI 튜터로서 활동하세요.\n\n`;
    }

    // 2. 기존 프롬프트 요소들 추가
    systemInstruction += basePrompt;
    systemInstruction += educationalContext;
    systemInstruction += subjectRules;
    systemInstruction += conversationContext;
    
    // ... 나머지 로직
    return systemInstruction;
}
```

### 3. 교사 대시보드 UI 개선 (teacher.html)

현재 수업 설명 입력란의 placeholder 변경:

```html
<textarea id="lesson-description-input" rows="4"
    placeholder="AI 튜터의 역할, 핵심 개념, 답변 톤, 학습 목표를 구체적으로 지시해주세요.

예시: 
- 너는 조선시대 문화를 설명하는 역사학자야. 왕 중심이 아닌 백성의 삶에 초점을 맞춰 설명해줘.
- 너는 분수의 나눗셈을 가르치는 수학 선생님이야. 피자나 케이크 같은 구체적인 예시를 들어가며 설명해줘.
- 너는 식물의 광합성을 설명하는 과학자야. 아이들이 직접 관찰할 수 있는 현상들과 연결지어 설명해줘."
    class="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y">
</textarea>
```

### 4. 데이터베이스 구조 확인

기존 lessons 컬렉션은 이미 다음 구조를 가지고 있음:
```javascript
{
    id: "lesson_code",
    teacherId: "teacher_uid", 
    title: "수업명",
    subject: "math|korean|science|social",
    description: "수업 설명", // ← 이 필드가 핵심 프롬프트로 사용됨
    createdAt: timestamp,
    status: "active",
    qrCode: "생성된_QR코드"
}
```

## 🧪 테스트 시나리오

1. **조선시대 역사 수업**
   - 수업 설명: "너는 조선시대 서민 생활을 연구하는 역사학자야. 왕족이 아닌 일반 백성들의 의식주 생활에 초점을 맞춰 설명해줘."
   - 예상 결과: AI가 왕족 중심이 아닌 서민 문화 중심으로 답변

2. **분수 나눗셈 수학 수업**  
   - 수업 설명: "너는 초등학생에게 분수의 나눗셈을 가르치는 수학 교사야. 피자, 케이크 같은 구체적 예시를 들어 직관적으로 설명해줘."
   - 예상 결과: 추상적 공식이 아닌 구체적 일상 예시로 설명

3. **광합성 과학 수업**
   - 수업 설명: "너는 식물학자야. 아이들이 실제로 관찰할 수 있는 현상(나뭇잎 색깔 변화, 산소 기포 등)과 연결지어 광합성을 설명해줘."
   - 예상 결과: 이론적 설명보다는 관찰 가능한 현상 중심 설명

## 📊 예상 효과

1. **교사 만족도 증가**: 수업 맥락에 맞는 전문화된 AI 튜터
2. **학습 효과 향상**: 수업 목표와 일치하는 일관된 교수 전략
3. **교수법 다양성**: 같은 과목이라도 수업별로 다른 접근 방식 가능
4. **개별화 교육**: 각 교사의 교육 철학을 반영한 맞춤형 튜터

## ⏱️ 예상 개발 시간
- 백엔드 수정: 2시간
- 프론트엔드 수정: 1시간  
- 테스트 및 검증: 2시간
- **총 소요 시간: 5시간**

## 🔗 다음 단계 연결점
이 기능이 완성되면 2단계에서 수업별 QR코드 시스템과 자연스럽게 연결되어 더욱 강력한 수업 관리 도구가 됩니다.
