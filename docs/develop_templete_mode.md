AI 튜터 사고력 증진 모드 템플릿 시스템 개발 계획

📋 종합 분석 및 구현 전략

🔍 1. 현재 UI 구조 분석 결과

AI 지시사항 입력란 위치 (Line 433-453):
• lesson-ai-instructions-input textarea가 핵심 입력 필드
• 현재 placeholder에 간단한 예시만 제공됨
• 템플릿 버튼 최적 배치 위치: AI 지시사항 label 바로 아래 (Line 439 이후)

📊 2. 템플릿 모드 데이터 구조

```javascript
const THINKING_MODES = {
  inquiry: {
    id: "inquiry",
    name: "🔍 탐구 모드",
    subtitle: "Inquiry Mode",
    description: "과학적 탐구나 사회 현상 탐구에서 AI가 선배 연구원 역할",
    subjects: ["science", "social"],
    difficulty: "중급",
    keywords: ["탐구", "관찰", "가설", "실험", "검증"],
    template: `**역할**: 너는 호기심 많고 친절한 선배 과학 탐험가야.

**목표**: 학생이 '{학습주제}'에 대해 스스로 탐구 질문을 만들고, 가설을 세우며, 간단한 실험을 설계하여 결론을 내리는 과정을 완성하도록 도와야 해.

**핵심 규칙**:
1. 절대로 정답을 직접 알려주면 안 돼.
2. 항상 학생의 관찰과 생각에서 출발해야 해. "무엇을 발견했니?", "왜 그렇게 생각했어?" 와 같이 질문해줘.
3. 학생이 막막해하면, "다른 조건을 생각해볼까?", "만약 다른 상황이라면 어떻게 될까?" 와 같이 사고를 확장하는 힌트를 질문 형태로 제공해.
4. 모든 답변은 반드시 학생의 다음 행동이나 생각을 유도하는 질문으로 끝나야 해.

**상호작용 방식**: 학생의 어떤 가설이든 "아주 흥미로운 생각이야!", "그렇게 생각해 볼 수도 있겠구나!" 와 같이 긍정적으로 반응하며 탐구 의욕을 북돋아 줘.

**학습 내용**: 이 탐구의 핵심 개념들을 직접 사용하기보다는 학생이 경험과 관찰을 통해 이 개념들을 스스로 설명하게 유도해줘.`,
  },

  debate: {
    id: "debate",
    name: "💬 토론 모드",
    subtitle: "Debate Mode",
    description: "사회적 쟁점이나 문학 해석에서 AI가 중립적 토론 진행자 역할",
    subjects: ["social", "korean"],
    difficulty: "고급",
    keywords: ["토론", "논리", "근거", "반박", "균형"],
    template: `**역할**: 너는 논리적이고 공정한 토론 진행자(모더레이터)야.

**목표**: 학생이 '{학습주제}'라는 논제에 대해 자신의 입장을 정하고, 타당한 근거를 들어 주장을 펼치는 능력을 기르도록 도와야 해.

**핵심 규칙**:
1. 너의 의견을 드러내지 말고 항상 중립을 지켜야 해.
2. 학생의 주장에 대해 항상 "왜 그렇게 생각하니? 너의 주장을 뒷받침하는 근거나 예시가 있을까?"라고 질문하며 근거를 요구해야 해.
3. 학생이 한쪽으로 치우친 주장을 하면, "네 의견과 다른 관점도 있어. 예를 들어..." 와 같이 균형 잡힌 반대 관점을 제시하여 사고를 자극해야 해.
4. 토론 마지막에는 학생의 주장과 근거를 간략하게 요약해주고, "오늘 토론을 통해 어떤 생각이 더 명확해졌니?"라고 물으며 성찰의 기회를 줘.

**상호작용 방식**: 차분하고 이성적인 말투를 사용하며, 학생의 의견을 존중하는 태도를 보여줘.

**학습 내용**: 이 토론에서 학생들이 다양한 가치를 고려하며 토론하도록 유도해줘.`,
  },

  problemSolving: {
    id: "problemSolving",
    name: "🧩 문제해결 모드",
    subtitle: "Problem-Solving Mode",
    description: "수학/코딩 문제에서 AI가 페어 프로그래머나 수학 코치 역할",
    subjects: ["math"],
    difficulty: "중급",
    keywords: ["문제해결", "단계", "계획", "검토", "폴리아"],
    template: `**역할**: 너는 친절하고 인내심 있는 수학 문제 해결 코치야. 폴리아의 문제 해결 4단계를 완벽히 이해하고 있어.

**목표**: 학생이 '{학습주제}' 문제를 스스로 풀 수 있도록 도와야 해.

**핵심 규칙**:
1. 절대 답이나 계산 과정을 직접 보여주면 안 돼. 학생이 계산 실수를 해도 "어디서 틀렸네"라고 말하지 말고, "계산 과정을 다시 한번 차근차근 살펴볼까?"라고 유도해야 해.
2. 반드시 폴리아의 4단계(문제 이해 → 계획 수립 → 계획 실행 → 반성)에 따라 질문해야 해.
   - (1단계) "이 문제에서 우리가 구해야 할 것은 무엇이지? 주어진 정보는 무엇이 있을까?"
   - (2단계) "이 문제를 풀기 위해 어떤 방법부터 시작해볼 수 있을까? 그림을 그려볼까?"
   - (3단계) "좋은 계획이야. 그 계획대로 한번 차근차근 계산해볼래?"
   - (4단계) "정답을 구했구나! 어떻게 그 답이 나왔는지 설명해줄 수 있니? 다른 방법은 없을까?"

**상호작용 방식**: 학생이 막막해할 때 "괜찮아, 어려운 문제는 원래 한 번에 풀리지 않아. 우리 함께 단서를 찾아보자" 와 같이 격려하는 말투를 사용해.

**학습 내용**: 이 문제의 핵심 개념들의 관계를 학생이 스스로 발견하도록 질문을 설계해줘.`,
  },

  creative: {
    id: "creative",
    name: "🎨 창작 모드",
    subtitle: "Creative Mode",
    description: "글짓기, 그림 그리기 등에서 AI가 영감의 원천 역할",
    subjects: ["korean"],
    difficulty: "초급",
    keywords: ["창작", "상상력", "아이디어", "표현", "영감"],
    template: `**역할**: 너는 상상력이 풍부하고 긍정적인 아이디어 파트너야.

**목표**: 학생이 '{학습주제}'라는 주제로 창작 활동을 할 수 있도록 상상력을 자극하고 아이디어를 구체화하는 것을 도와야 해.

**핵심 규칙**:
1. 절대 학생의 아이디어를 "그건 좀 이상한데" 와 같이 비판하거나 평가하면 안 돼.
2. 항상 "와, 정말 재미있는 생각이다! 더 자세히 이야기해줄래?" 와 같이 긍정적으로 반응해야 해.
3. 학생의 이야기가 막히면, 새로운 관점의 질문을 던져줘.
4. 오감을 활용하는 질문을 던져줘. "그 장소에서는 어떤 소리가 들릴까?", "그때 기분은 어떨까?"

**상호작용 방식**: 즐겁고 유쾌한 말투로 학생의 창의적인 시도를 칭찬하고 격려해줘.

**학습 내용**: 이 활동의 핵심은 논리보다는 '창의성'과 '표현력'이야. 학생이 자유롭게 상상의 나래를 펼치도록 최대한 허용적인 분위기를 만들어줘.`,
  },

  rolePlaying: {
    id: "rolePlaying",
    name: "🎭 역할극 모드",
    subtitle: "Role-Playing Mode",
    description: "AI가 역사적 인물, 전문가 등 특정 역할을 맡아 상호작용",
    subjects: ["social", "korean"],
    difficulty: "고급",
    keywords: ["역할극", "몰입", "인터뷰", "캐릭터", "상황"],
    template: `**역할**: 너는 '{역할설정}' 이야. 

**목표**: 학생이 {상대역할}가 되어 너와 상호작용하면서, {학습주제}를 자연스럽게 학습하도록 해야 해.

**핵심 규칙**:
1. 답변은 반드시 설정된 인물의 말투와 관점에서 해야 해. 현대 기술이나 개념에 대해서는 모르는 척해야 해.
2. 역사적 사실이나 설정에 기반하여 감정을 담아 대답해야 해.
3. 갈등 상황이나 어려움에 대한 질문이 나오면, 그 시대의 맥락을 고려하여 대답해.
4. 학생이 너의 정체(AI)에 대해 물으면, 끝까지 역할을 유지해야 해.

**상호작용 방식**: 설정된 캐릭터에 맞는 어조와 감정을 사용해줘.

**학습 내용**: 핵심 학습 내용이 대화 속에 자연스럽게 녹아나도록 해줘.

**추가 설정 필요**: 구체적인 역할, 시대 배경, 학습 목표를 명시해주세요.`,
  },

  flipped: {
    id: "flipped",
    name: "🧑‍🏫 거꾸로 학습 모드",
    subtitle: "Flipped Learning Mode",
    description: "학생이 선생님, AI가 학생이 되어 역할을 바꾼 학습",
    subjects: ["science", "math", "social", "korean"],
    difficulty: "고급",
    keywords: ["메타인지", "설명", "역할전환", "이해점검", "구조화"],
    template: `**역할**: 너는 오늘 배울 내용에 대해 아무런 사전 지식이 없는, 총명하고 호기심 많은 학생이야. 너의 유일한 목표는 학생 선생님의 설명을 듣고 완벽하게 이해하는 것이야.

**목표**: 학생이 '{학습주제}'에 대해 다른 사람에게 설명하는 과정을 통해, 자신의 이해도를 스스로 점검하고 지식을 완벽하게 내재화하도록 도와야 해.

**핵심 규칙**:
1. 너는 학생 선생님보다 더 많이 알아서는 안 돼. 절대로 학생이 설명하지 않은 새로운 개념이나 정보를 먼저 이야기하면 안 돼.
2. 학생의 설명이 불분명하거나 논리적으로 건너뛰는 부분이 있으면, 순진하게 이해가 안 된다는 듯이 질문해야 해.
3. 추상적인 설명이 나오면 반드시 구체적인 예시를 요구해야 해.
4. 중간중간 자신이 이해한 내용을 요약하며 맞는지 확인해야 해.
5. 끝까지 너는 배우는 학생의 역할을 유지해야 하며, 학생의 설명을 평가하거나 가르치려 들면 안 돼.

**상호작용 방식**: 항상 존댓말을 사용하며, 학생 선생님의 설명에 "아, 그렇구나!", "정말 설명 잘한다!" 와 같이 감탄하고 긍정적인 피드백을 주어 학생의 자신감을 북돋아 줘.

**학습 내용**: 학생이 핵심 내용을 명확히 설명할 수 있는지 확인하는 데 모든 질문을 집중해줘.`,
  },
};
```

🎨 3. UI 컴포넌트 배치 계획

A. 템플릿 선택 버튼 영역 (AI 지시사항 label 바로 아래)

```html
<!-- 새로 추가될 템플릿 선택 영역 -->
<div
  id="template-mode-section"
  class="mb-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg"
>
  <div class="flex items-center justify-between mb-3">
    <h4 class="text-sm font-semibold text-purple-800 flex items-center">
      <span class="mr-2">🎯</span>사고력 증진 템플릿 모드
    </h4>
    <button
      id="template-help-btn"
      class="text-xs text-purple-600 hover:text-purple-800"
    >
      ❓ 도움말
    </button>
  </div>

  <!-- 템플릿 모드 버튼 그리드 -->
  <div class="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
    <button class="template-mode-btn" data-mode="inquiry">
      <span class="text-lg mb-1">🔍</span>
      <span class="text-xs font-medium">탐구 모드</span>
    </button>
    <button class="template-mode-btn" data-mode="debate">
      <span class="text-lg mb-1">💬</span>
      <span class="text-xs font-medium">토론 모드</span>
    </button>
    <button class="template-mode-btn" data-mode="problemSolving">
      <span class="text-lg mb-1">🧩</span>
      <span class="text-xs font-medium">문제해결</span>
    </button>
    <button class="template-mode-btn" data-mode="creative">
      <span class="text-lg mb-1">🎨</span>
      <span class="text-xs font-medium">창작 모드</span>
    </button>
    <button class="template-mode-btn" data-mode="rolePlaying">
      <span class="text-lg mb-1">🎭</span>
      <span class="text-xs font-medium">역할극</span>
    </button>
    <button class="template-mode-btn" data-mode="flipped">
      <span class="text-lg mb-1">🧑‍🏫</span>
      <span class="text-xs font-medium">거꾸로학습</span>
    </button>
  </div>

  <!-- 선택된 템플릿 정보 표시 -->
  <div
    id="selected-template-info"
    class="hidden p-3 bg-white border border-purple-200 rounded-md"
  >
    <div class="flex items-start justify-between">
      <div class="flex-1">
        <h5 id="template-title" class="font-semibold text-purple-800 mb-1"></h5>
        <p id="template-description" class="text-xs text-gray-600 mb-2"></p>
        <div class="flex items-center space-x-4 text-xs text-gray-500">
          <span id="template-subjects"></span>
          <span id="template-difficulty"></span>
        </div>
      </div>
      <div class="flex space-x-1 ml-2">
        <button
          id="preview-template-btn"
          class="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
        >
          👁 미리보기
        </button>
        <button
          id="apply-template-btn"
          class="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
        >
          적용하기
        </button>
        <button
          id="clear-template-btn"
          class="px-1 py-1 text-xs text-gray-500 hover:text-red-600"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</div>
```

B. 템플릿 미리보기 모달

```html
<!-- 템플릿 미리보기 모달 -->
<div
  id="template-preview-modal"
  class="hidden fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
>
  <div
    class="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
  >
    <div class="p-6">
      <div class="flex items-start justify-between mb-4">
        <div>
          <h3
            id="modal-template-title"
            class="text-xl font-bold text-gray-900 mb-1"
          ></h3>
          <p
            id="modal-template-subtitle"
            class="text-sm text-gray-500 mb-2"
          ></p>
          <div class="flex items-center space-x-3 text-sm">
            <span
              class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs"
              id="modal-template-difficulty"
            ></span>
            <span class="text-gray-600" id="modal-template-subjects"></span>
          </div>
        </div>
        <button
          id="close-preview-modal"
          class="text-gray-400 hover:text-gray-600"
        >
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            ></path>
          </svg>
        </button>
      </div>

      <div class="mb-6">
        <h4 class="font-semibold text-gray-800 mb-2">📝 프롬프트 미리보기</h4>
        <div class="bg-gray-50 border rounded-lg p-4 max-h-64 overflow-y-auto">
          <pre
            id="template-preview-content"
            class="text-sm text-gray-700 whitespace-pre-wrap font-mono"
          ></pre>
        </div>
      </div>

      <div class="mb-6">
        <h4 class="font-semibold text-gray-800 mb-2">🏷️ 키워드</h4>
        <div id="template-keywords" class="flex flex-wrap gap-2"></div>
      </div>

      <div class="flex justify-end space-x-3">
        <button
          id="modal-cancel-btn"
          class="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
        >
          취소
        </button>
        <button
          id="modal-apply-btn"
          class="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
        >
          이 템플릿 적용하기
        </button>
      </div>
    </div>
  </div>
</div>
```

⚙️ 4. 기능 구현 계획

A. JavaScript 핵심 기능

```javascript
// 템플릿 모드 관리 클래스
class TemplateManager {
  constructor() {
    this.selectedTemplate = null;
    this.originalContent = "";
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // 템플릿 버튼 클릭 이벤트
    document.querySelectorAll(".template-mode-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        const modeId = e.currentTarget.dataset.mode;
        this.selectTemplate(modeId);
      });
    });

    // 적용 버튼 이벤트
    document
      .getElementById("apply-template-btn")
      ?.addEventListener("click", () => {
        this.applyTemplate();
      });

    // 미리보기 버튼 이벤트
    document
      .getElementById("preview-template-btn")
      ?.addEventListener("click", () => {
        this.showPreview();
      });

    // 클리어 버튼 이벤트
    document
      .getElementById("clear-template-btn")
      ?.addEventListener("click", () => {
        this.clearSelection();
      });
  }

  selectTemplate(modeId) {
    const template = THINKING_MODES[modeId];
    if (!template) return;

    this.selectedTemplate = template;

    // 선택된 버튼 스타일 업데이트
    this.updateButtonStyles(modeId);

    // 템플릿 정보 표시
    this.showTemplateInfo(template);
  }

  updateButtonStyles(selectedId) {
    document.querySelectorAll(".template-mode-btn").forEach((btn) => {
      if (btn.dataset.mode === selectedId) {
        btn.classList.add("bg-purple-600", "text-white");
        btn.classList.remove("bg-white", "text-gray-700");
      } else {
        btn.classList.add("bg-white", "text-gray-700");
        btn.classList.remove("bg-purple-600", "text-white");
      }
    });
  }

  showTemplateInfo(template) {
    const infoDiv = document.getElementById("selected-template-info");
    document.getElementById("template-title").textContent = template.name;
    document.getElementById("template-description").textContent =
      template.description;
    document.getElementById(
      "template-subjects"
    ).textContent = `적용 과목: ${template.subjects
      .map((s) => this.getSubjectName(s))
      .join(", ")}`;
    document.getElementById(
      "template-difficulty"
    ).textContent = `난이도: ${template.difficulty}`;
    infoDiv.classList.remove("hidden");
  }

  applyTemplate() {
    if (!this.selectedTemplate) return;

    const aiInstructionsInput = document.getElementById(
      "lesson-ai-instructions-input"
    );
    const lessonTitleInput = document.getElementById("lesson-title-input");

    // 현재 제목을 템플릿에 반영
    const lessonTitle = lessonTitleInput.value.trim() || "{학습주제}";
    let templateContent = this.selectedTemplate.template;

    // 플레이스홀더 치환
    templateContent = templateContent.replace(/\{학습주제\}/g, lessonTitle);

    // 역할극 모드의 경우 추가 입력 요청
    if (this.selectedTemplate.id === "rolePlaying") {
      this.showRolePlayingDialog(templateContent);
      return;
    }

    // 텍스트에어리어에 적용
    aiInstructionsInput.value = templateContent;

    // 성공 메시지
    this.showSuccessMessage(this.selectedTemplate.name);

    // 선택 초기화
    this.clearSelection();
  }

  showRolePlayingDialog(templateContent) {
    const role = prompt("역할을 설정해주세요 (예: 조선 4대 임금 세종대왕):");
    const counterRole = prompt(
      "학생의 역할을 설정해주세요 (예: 기자, 탐험가):"
    );

    if (role && counterRole) {
      templateContent = templateContent
        .replace(/\{역할설정\}/g, role)
        .replace(/\{상대역할\}/g, counterRole);

      document.getElementById("lesson-ai-instructions-input").value =
        templateContent;
      this.showSuccessMessage(this.selectedTemplate.name);
      this.clearSelection();
    }
  }

  showPreview() {
    if (!this.selectedTemplate) return;

    const modal = document.getElementById("template-preview-modal");
    const template = this.selectedTemplate;

    // 모달 내용 설정
    document.getElementById("modal-template-title").textContent = template.name;
    document.getElementById("modal-template-subtitle").textContent =
      template.subtitle;
    document.getElementById("modal-template-difficulty").textContent =
      template.difficulty;
    document.getElementById(
      "modal-template-subjects"
    ).textContent = `적용 과목: ${template.subjects
      .map((s) => this.getSubjectName(s))
      .join(", ")}`;
    document.getElementById("template-preview-content").textContent =
      template.template;

    // 키워드 표시
    const keywordsContainer = document.getElementById("template-keywords");
    keywordsContainer.innerHTML = template.keywords
      .map(
        (keyword) =>
          `<span class="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">${keyword}</span>`
      )
      .join("");

    modal.classList.remove("hidden");
  }

  clearSelection() {
    this.selectedTemplate = null;
    document.getElementById("selected-template-info").classList.add("hidden");
    this.updateButtonStyles(null);
  }

  getSubjectName(subject) {
    const names = {
      korean: "국어",
      math: "수학",
      social: "사회",
      science: "과학",
    };
    return names[subject] || subject;
  }

  showSuccessMessage(templateName) {
    // 기존 showStatus 함수 활용
    if (typeof showStatus === "function") {
      showStatus(
        `${templateName} 템플릿이 성공적으로 적용되었습니다! 🎉`,
        "success"
      );
    }
  }
}

// 초기화
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("template-mode-section")) {
    window.templateManager = new TemplateManager();
  }
});
```

B. CSS 스타일

```css
/* 템플릿 모드 버튼 스타일 */
.template-mode-btn {
  @apply flex flex-col items-center justify-center p-3 bg-white border border-gray-300 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all cursor-pointer text-center min-h-[80px];
}

.template-mode-btn.selected {
  @apply bg-purple-600 text-white border-purple-600;
}

.template-mode-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(147, 51, 234, 0.1);
}

/* 미리보기 모달 애니메이션 */
#template-preview-modal {
  animation: fadeIn 0.2s ease-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* 선택된 템플릿 정보 박스 */
#selected-template-info {
  animation: slideDown 0.3s ease-out;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

🚀 5. 구현 단계별 계획

Phase 1: 기본 템플릿 시스템 (1주차)

1. HTML 구조 추가 (템플릿 선택 영역)
2. JavaScript 템플릿 데이터 구조 구현
3. 기본 적용 기능 구현

Phase 2: UI/UX 고도화 (2주차)

1. 미리보기 모달 구현
2. 애니메이션 및 스타일링
3. 역할극 모드 커스터마이징 기능

Phase 3: 고급 기능 (3주차)

1. 과목별 추천 템플릿 필터링
2. 사용자 정의 템플릿 저장 기능
3. 템플릿 사용 통계 및 추천 시스템

📊 예상 효과

1. 교사 편의성: 복잡한 프롬프트 작성 없이 클릭 한 번으로 전문적인 AI 튜터 모드 설정
2. 교육적 다양성: 6가지 사고력 증진 모드로 다양한 수업 시나리오 지원
3. 학생 참여도: 각 모드별 특화된 상호작용 방식으로 학습 몰입도 증대
4. 시스템 활용도: 템플릿 제공으로 AI 튜터 시스템 사용 활성화

이 계획을 통해 교사들이 쉽고 직관적으로 AI 튜터의 사고력 증진 모드를 활용할 수 있는 완성도 높은 템플릿 시스템을 구축할 수 있습니다! 🌟
