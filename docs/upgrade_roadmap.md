# JSON 기반 능동형 챗봇 고도화 로드맵

## 🎯 프로젝트 개요

현재 GraviTrax 전용으로 구현된 시스템을 **JSON 기반 멀티 과목 대응 능동형 AI 교육 플랫폼**으로 고도화하는 프로젝트입니다.

### 현재 시스템 vs 목표 시스템

| 구분 | 현재 시스템 | 목표 시스템 |
|------|------------|------------|
| 과목 지원 | GraviTrax 과학 실험 전용 | 국어, 수학, 사회, 과학 멀티 과목 |
| 응답 분석 | 하드코딩된 6가지 유형 | JSON 설정 기반 과목별 맞춤 유형 |
| 프롬프트 | 정적 템플릿 | 교육학 이론 기반 적응형 프롬프트 |
| 확장성 | 코드 수정 필요 | JSON 파일 추가만으로 새 과목 지원 |

## 📋 Phase 1: 핵심 아키텍처 개편 (2주)

### 1.1 JSON 로더 시스템 구축
**목표**: 과목별 JSON 설정을 동적으로 로드하고 캐싱하는 시스템

```javascript
// 새로운 함수: loadSubjectConfig()
// prompts/{subject}.json 파일을 읽어와 메모리에 캐시
// 교사 설정에 따라 적절한 과목 설정 선택
```

**구현 파일**:
- `functions/lib/subjectLoader.js` (신규)
- `functions/index.js` (수정)

### 1.2 응답 분석 시스템 리팩터링
**목표**: 하드코딩된 패턴을 JSON 기반 동적 패턴으로 전환

**현재 (functions/index.js)**:
```javascript
function analyzeStudentResponse(userMessage) {
    // 하드코딩된 정규표현식 패턴들...
    const conceptQuestionPatterns = [
        /(무엇|뭐|뭘).*[이에]?요?\\?*$/,
        // ...
    ];
}
```

**목표 시스템**:
```javascript
function analyzeStudentResponse(userMessage, subjectConfig) {
    const responseTypes = subjectConfig.response_types;
    
    for (const [typeKey, typeConfig] of Object.entries(responseTypes)) {
        const patterns = typeConfig.patterns.map(p => new RegExp(p));
        if (patterns.some(pattern => pattern.test(userMessage))) {
            return {
                type: typeKey,
                config: typeConfig
            };
        }
    }
    return { type: 'DEFAULT', config: responseTypes.DEFAULT };
}
```

### 1.3 프롬프트 생성 시스템 고도화
**목표**: 교육학적 이론과 과목 특성을 반영한 동적 프롬프트 생성

**새로운 buildFullPrompt 구조**:
```javascript
function buildFullPrompt(responseAnalysis, userMessage, conversationHistory, teacherData, subjectConfig) {
    const { type, config } = responseAnalysis;
    
    // 1. 기본 프롬프트 (sample_prompts에서 선택)
    const basePrompt = selectBestPrompt(config.sample_prompts, conversationHistory);
    
    // 2. 교육학적 맥락 추가
    const educationalContext = buildEducationalContext(config.theoretical_basis, config.prompt_strategy);
    
    // 3. 과목별 특화 규칙
    const subjectRules = buildSubjectRules(subjectConfig);
    
    // 4. 최종 프롬프트 조합
    return combinePromptElements(basePrompt, educationalContext, subjectRules, userMessage);
}
```

### 1.4 교사 설정 시스템 확장
**목표**: 교사가 과목과 학습 맥락을 선택할 수 있는 시스템

**데이터베이스 스키마 확장 (teacher_keys 컬렉션)**:
```javascript
{
  // 기존 필드들...
  subject: 'science',           // 'korean', 'math', 'social', 'science'
  grade_level: 'elementary',    // 'elementary', 'middle', 'high'
  topic: 'gravitrax',          // 세부 주제
  learning_context: {
    current_phase: '전개',
    target_concepts: ['에너지 전환', '운동법칙'],
    difficulty_level: 'intermediate'
  },
  json_config_override: {}      // JSON 설정 부분적 오버라이드
}
```

## 📋 Phase 2: UI/UX 확장 (1주)

### 2.1 교사 대시보드 과목 설정 UI
**파일**: `public/teacher.html`, `public/teacher.js`

**새로운 UI 컴포넌트**:
```html
<div class="subject-selection-card">
    <h3>🎓 과목 및 학습 맥락 설정</h3>
    
    <div class="form-group">
        <label>과목 선택</label>
        <select id="subject-select">
            <option value="science">🔬 과학</option>
            <option value="math">🔢 수학</option>
            <option value="korean">📚 국어</option>
            <option value="social">🌍 사회</option>
        </select>
    </div>
    
    <div class="form-group">
        <label>학습 주제</label>
        <input type="text" id="topic-input" placeholder="예: GraviTrax 에너지 실험">
    </div>
    
    <div class="form-group">
        <label>학년 수준</label>
        <select id="grade-select">
            <option value="elementary">초등</option>
            <option value="middle">중등</option>
            <option value="high">고등</option>
        </select>
    </div>
    
    <button id="load-subject-template">과목별 기본 템플릿 불러오기</button>
</div>
```

### 2.2 응답 유형별 프롬프트 편집 시스템
**목표**: JSON 설정의 응답 유형을 기반으로 한 세밀한 프롬프트 편집

```html
<div class="response-type-editor">
    <h4>📝 응답 유형별 프롬프트 설정</h4>
    
    <div id="response-types-tabs">
        <!-- 동적으로 생성: 과목 선택에 따라 해당 JSON의 response_types가 탭으로 생성 -->
        <div class="tab active" data-type="CONCEPT_QUESTION">
            <span class="type-name">개념 질문</span>
            <span class="type-desc">과학적 개념에 대한 이해 확인</span>
        </div>
        <!-- ... 기타 유형들 ... -->
    </div>
    
    <div class="tab-content">
        <div class="theoretical-basis">
            <h5>🏛️ 교육학적 근거</h5>
            <p id="theoretical-basis-text"><!-- JSON에서 로드 --></p>
        </div>
        
        <div class="prompt-strategy">
            <h5>🎯 교수 전략</h5>
            <p id="prompt-strategy-text"><!-- JSON에서 로드 --></p>
        </div>
        
        <div class="sample-prompts">
            <h5>💡 예시 프롬프트</h5>
            <div id="sample-prompts-list"><!-- JSON에서 로드 --></div>
        </div>
        
        <div class="custom-prompt-editor">
            <h5>✏️ 커스텀 프롬프트</h5>
            <textarea id="custom-prompt-input" rows="4"></textarea>
        </div>
    </div>
</div>
```

## 📋 Phase 3: 고급 기능 및 분석 시스템 (2주)

### 3.1 과목별 학습 분석 시스템
**목표**: JSON 설정의 assessment_criteria를 기반으로 한 학습 분석

**새로운 Cloud Function**: `analyzeSubjectLearning`
```javascript
exports.analyzeSubjectLearning = onCall(async (request) => {
    const { sessionId, analysisType } = request.data;
    
    // 1. 대화 기록 분석
    const conversations = await getConversations(sessionId);
    
    // 2. 과목별 JSON 설정 로드
    const subjectConfig = await loadSubjectConfig(teacherData.subject);
    
    // 3. assessment_criteria 기반 분석
    const analysis = await generateSubjectAnalysis(
        conversations, 
        subjectConfig.assessment_criteria,
        subjectConfig.domain_specific_features
    );
    
    return analysis;
});
```

### 3.2 적응형 난이도 조절 시스템
**목표**: JSON의 adaptive_strategies를 활용한 동적 난이도 조절

```javascript
function adjustDifficultyLevel(studentPerformance, subjectConfig) {
    const strategies = subjectConfig.adaptive_strategies;
    
    // 학생 성과 분석을 바탕으로 적절한 전략 선택
    const currentLevel = analyzeStudentLevel(studentPerformance);
    const selectedStrategy = strategies[currentLevel];
    
    return {
        focus: selectedStrategy.focus,
        approach: selectedStrategy.approach,
        recommendedPrompts: generateRecommendedPrompts(selectedStrategy)
    };
}
```

### 3.3 대화 맥락 고도화 시스템
**목표**: JSON의 conversation_context 설정을 활용한 지능적 맥락 관리

```javascript
function buildConversationContext(conversationHistory, subjectConfig) {
    const contextConfig = subjectConfig.conversation_context;
    
    // max_history에 따른 적절한 이력 길이 조절
    const relevantHistory = selectRelevantHistory(
        conversationHistory, 
        contextConfig.max_history
    );
    
    // context_elements에 정의된 요소들 추출
    const contextElements = extractContextElements(
        relevantHistory,
        contextConfig.context_elements
    );
    
    return contextElements;
}
```

## 🔧 구현 세부 사항

### 파일 구조 변경
```
functions/
├── index.js (메인 함수들)
├── lib/
│   ├── subjectLoader.js      (JSON 설정 로더)
│   ├── responseAnalyzer.js   (응답 분석 시스템)
│   ├── promptBuilder.js      (프롬프트 생성 시스템)
│   ├── learningAnalyzer.js   (학습 분석 시스템)
│   └── difficultyAdjuster.js (난이도 조절 시스템)
├── prompts/
│   ├── korean.json
│   ├── math.json
│   ├── science.json
│   └── social.json
└── package.json
```

### 데이터 흐름
```
1. 교사가 과목 선택 → teacher_keys에 subject 저장
2. 학생 메시지 입력 → loadSubjectConfig(subject)로 JSON 로드
3. JSON의 response_types로 메시지 분석
4. JSON의 sample_prompts와 교육 이론으로 프롬프트 생성
5. 대화 기록을 JSON의 assessment_criteria로 분석
6. adaptive_strategies에 따라 다음 상호작용 조정
```

## 🎯 기대 효과

### 1. 확장성
- 새로운 과목 추가: JSON 파일 하나만 추가하면 완료
- 교육과정 변경: JSON 내용만 수정하면 전체 시스템 반영

### 2. 교육적 효과성
- 과목별 특성을 반영한 맞춤형 교수법 적용
- 교육학 이론에 기반한 체계적인 상호작용
- 학습자 수준별 적응형 피드백

### 3. 유지보수성
- 교육 내용과 기술 코드의 분리
- 교육전문가가 직접 JSON 편집 가능
- A/B 테스트를 통한 프롬프트 최적화 용이

### 4. 범용성
- 초/중/고등 모든 학교급 대응
- 다양한 교과목으로 확장 가능
- 국제 교육과정 대응 가능 (JSON 번역만으로)

## ⏱️ 개발 일정

**1주차**: Phase 1.1-1.2 (JSON 로더, 응답 분석 시스템)
**2주차**: Phase 1.3-1.4 (프롬프트 시스템, 교사 설정)
**3주차**: Phase 2 (UI/UX 확장)
**4주차**: Phase 3.1 (학습 분석 시스템)
**5주차**: Phase 3.2-3.3 (고급 기능 완성 및 테스트)

## 📈 성공 지표

1. **기능적 지표**
   - 4개 과목 모두 정상 동작
   - 과목별 응답 유형 정확도 90% 이상
   - 프롬프트 생성 속도 2초 이내

2. **교육적 지표**
   - 과목별 학습 목표 달성도 측정
   - 학생 참여도 및 만족도 조사
   - 교사 사용성 평가

3. **기술적 지표**
   - 시스템 안정성 99% 이상
   - JSON 설정 변경 시 무중단 반영
   - 동시 접속 100명 이상 지원

---

이 로드맵을 통해 현재의 GraviTrax 전용 시스템을 **범용 AI 교육 플랫폼**으로 전환하여, 모든 교과목에서 활용 가능한 차세대 교육 도구로 발전시킬 수 있습니다.
