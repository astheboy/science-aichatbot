import { callGeminiApi } from './api.js';

const chatWindow = document.getElementById('chat-window');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const typingIndicator = document.getElementById('typing-indicator');
const teacherCodeInput = document.getElementById('teacher-code-input');
const saveTeacherCodeBtn = document.getElementById('save-teacher-code-btn');
const teacherCodeStatus = document.getElementById('teacher-code-status');

let conversationHistory = [];
let teacherCode = '';

const intentPatterns = {
    Concept_Question: new RegExp('뭐예요|뭔가요|궁금|알려줘|설명|위치에너지|운동에너지|개념|원리'),
    Causal_Inquiry: new RegExp('왜 안되지|왜 그럴까|떨어졌어|멈췄어|~해서 그런가|만약.*할까'),
    Solution_Request: new RegExp('모르겠어|어떻게|어떡해|막혔어|방법|힌트|뭘 해야'),
    Process_Sharing: new RegExp('됐다|성공|해결|되네|실패|망했어|안돼'),
    Inquiry_Expansion: new RegExp('만약.*라면|다른 방법|~말고|~해도 돼'),
};

export function initChatbot() {
    saveTeacherCodeBtn.addEventListener('click', saveTeacherCode);
    chatForm.addEventListener('submit', handleChatSubmit);

    initializeTutorState();
}

function initializeTutorState() {
    teacherCode = localStorage.getItem('teacherCode');
    if (teacherCode) {
        teacherCodeInput.value = teacherCode;
        teacherCodeInput.disabled = true;
        saveTeacherCodeBtn.textContent = '변경';
        teacherCodeStatus.textContent = '교사 코드가 연결되었습니다.';
        teacherCodeStatus.className = 'text-xs text-center text-green-600';
        if (conversationHistory.length === 0) {
            displayAiMessage("그래비트랙스 탐험을 시작해볼까? 트랙을 만들다가 궁금하거나 어려운 점이 생기면 나에게 무엇이든 물어봐!", true);
        }
    } else {
        saveTeacherCodeBtn.textContent = '저장';
        teacherCodeStatus.textContent = 'G-Tutor와 대화하려면 교사 코드가 필요해요.';
        teacherCodeStatus.className = 'text-xs text-center text-gray-500';
        if (conversationHistory.length === 0) {
            displayAiMessage("안녕하세요! G-Tutor와 대화를 시작하려면, 먼저 선생님께서 알려주신 교사 코드를 입력하고 저장해주세요.", true);
        }
    }
}

function saveTeacherCode() {
    if (saveTeacherCodeBtn.textContent === '변경') {
        teacherCodeInput.disabled = false;
        teacherCodeInput.value = '';
        teacherCodeInput.focus();
        saveTeacherCodeBtn.textContent = '저장';
        teacherCodeStatus.textContent = '새로운 교사 코드를 입력하고 저장해주세요.';
        teacherCodeStatus.className = 'text-xs text-center text-gray-500';
        return;
    }

    const code = teacherCodeInput.value.trim();
    if (code) {
        localStorage.setItem('teacherCode', code);
        teacherCode = code;
        alert('교사 코드가 저장되었습니다.');
        initializeTutorState();
    } else {
        alert('교사 코드를 입력해주세요.');
    }
}

async function handleChatSubmit(e) {
    e.preventDefault();
    const userInput = chatInput.value.trim();
    if (!userInput) return;

    if (!teacherCode) {
        displayAiMessage("아이고! 교사 코드를 먼저 저장해야 대화를 시작할 수 있어요.");
        teacherCodeInput.focus();
        return;
    }

    displayUserMessage(userInput);
    conversationHistory.push({ role: 'user', parts: [{ text: userInput }] });
    chatInput.value = '';
    typingIndicator.style.display = 'block';
    chatWindow.scrollTop = chatWindow.scrollHeight;

    try {
        const aiResponseText = await callGeminiApi(teacherCode, userInput, conversationHistory);
        displayAiMessage(aiResponseText);
        conversationHistory.push({ role: 'model', parts: [{ text: aiResponseText }] });
    } catch (error) {
        console.error('Error fetching AI response:', error);
        displayAiMessage(`이런, 지금은 연결이 어려운 것 같아요. ${error.message}`);
    } finally {
        typingIndicator.style.display = 'none';
        chatWindow.scrollTop = chatWindow.scrollHeight;
    }
}

function displayUserMessage(message) {
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message user-message';
    messageElement.innerHTML = `<p>${message}</p>`;
    chatWindow.appendChild(messageElement);
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function displayAiMessage(message, isFirst = false) {
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message ai-message';
    
    const avatar = `<div class="avatar"><i data-lucide="bot"></i></div>`;
    
    messageElement.innerHTML = `
        <div class="message-content">
            ${isFirst || conversationHistory.length === 0 ? avatar : ''}
            <p>${message}</p>
        </div>
    `;
    
    chatWindow.appendChild(messageElement);
    lucide.createIcons();
    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function getIntent(message) {
    for (const intent in intentPatterns) {
        if (intentPatterns[intent].test(message)) {
            return intent;
        }
    }
    return 'Fallback';
}

function generatePrompt(intent, message, history) {
    const systemInstruction = `너는 초등 영재 학생을 위한 '그래비트랙스 물리 탐구 AI 튜터'야. 너의 이름은 'G-Tutor'이다. 너의 역할은 학생의 자기주도적 문제 해결을 돕는 '소크라테스식 질문자'이다.

### 너의 핵심 규칙 ###
1. 절대로 정답이나 해결 방법을 직접 알려주면 안 된다. 예를 들어, '높이를 올리세요'와 같은 직접적인 지시는 금지된다.
2. 너의 모든 답변은 반드시 학생의 다음 생각을 유도하는 '질문' 형태여야 한다.
3. 학생의 실패를 '중요한 단서'로 칭찬하고, 긍정적인 탐구 태도를 격려해야 한다.
4. 대화의 목표는 학생이 스스로 '높은 위치에너지가 큰 운동에너지로 전환된다'는 원리를 깨닫게 하는 것이다.
5. 학생의 발화에서 '높이', '속도', '힘'과 같은 단서가 나오면, 이를 '위치에너지', '운동에너지'와 같은 과학 용어와 연결하는 질문을 던져라.
6. 친절하고 격려하는 동료 탐험가 같은 말투를 사용하라. 한국어로만 대답해야 한다.`;

    const studentFacingHistory = history.slice(-6); 

    const contents = studentFacingHistory.map((turn, index) => {
        if (index === 0) {
            const userTextWithSystemPrompt = `${systemInstruction}

### 현재 학습 맥락 ###
- 수업 단계: 전개 (활동3 - 인지적 갈등 유발 미션)
- 현재 미션: 낮은 출발점에서 시작하여 끊어진 레일(2칸 너비)을 점프해서 건너기

### 학생의 현재 발화 ###
${turn.parts[0].text}`;
            return { role: 'user', parts: [{ text: userTextWithSystemPrompt }] };
        }
        return turn;
    });

    if (studentFacingHistory.length === 0) {
        contents.push({ role: 'user', parts: [{ text: `${systemInstruction}\n\n### 학생의 현재 발화 ###\n${message}` }] });
    }


    const promptObject = {
        contents: contents,
        generationConfig: {
            "temperature": 0.7,
            "topP": 0.9,
            "maxOutputTokens": 150
        }
    };
    return promptObject;
}
