import { callGeminiApi } from "./api.js";

const chatWindow = document.getElementById("chat-window");
const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const typingIndicator = document.getElementById("typing-indicator");
const lessonCodeInput = document.getElementById("lesson-code-input");
const saveLessonCodeBtn = document.getElementById("save-lesson-code-btn");
const lessonCodeStatus = document.getElementById("lesson-code-status");
const studentNameSection = document.getElementById("student-name-section");
const studentNameInput = document.getElementById("student-name-input");
const saveStudentNameBtn = document.getElementById("save-student-name-btn");
const studentNameStatus = document.getElementById("student-name-status");

let conversationHistory = [];
let lessonCode = "";
let studentName = "";
let sessionId = "";


export function initChatbot() {
  saveLessonCodeBtn.addEventListener("click", saveLessonCode);
  saveStudentNameBtn.addEventListener("click", saveStudentName);
  chatForm.addEventListener("submit", handleChatSubmit);

  // URL 파라미터 확인
  handleUrlParameters();
  
  initializeTutorState();
  initializeStudentNameState();
}

function handleUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const lessonFromUrl = urlParams.get('lesson');
  
  if (lessonFromUrl) {
    lessonCodeInput.value = lessonFromUrl.toUpperCase();
    lessonCodeInput.readOnly = true;
    lessonCodeInput.style.backgroundColor = '#e9ecef'; // 읽기 전용 표시
    saveLessonCodeBtn.click(); // 자동으로 저장
  }
}

function initializeTutorState() {
  lessonCode = localStorage.getItem("lessonCode");
  if (lessonCode) {
    lessonCodeInput.value = lessonCode;
    lessonCodeInput.disabled = true;
    saveLessonCodeBtn.textContent = "변경";
    lessonCodeStatus.textContent = "수업 코드가 연결되었습니다.";
    lessonCodeStatus.className = "text-xs text-center text-green-600";
    if (conversationHistory.length === 0) {
      displayAiMessage(
        "공부를 하다가 궁금하거나 어려운 점이 생기면 나에게 무엇이든 물어봐!",
        true
      );
    }
  } else {
    saveLessonCodeBtn.textContent = "저장";
    lessonCodeStatus.textContent =
      "AI 튜터와 대화하려면 수업 코드가 필요해요.";
    lessonCodeStatus.className = "text-xs text-center text-gray-500";
    if (conversationHistory.length === 0) {
      displayAiMessage(
        "안녕하세요! AI 튜터와 대화를 시작하려면, 먼저 선생님께서 알려주신 수업 코드를 입력하고 저장해주세요.",
        true
      );
    }
  }
}

function saveLessonCode() {
  if (saveLessonCodeBtn.textContent === "변경") {
    lessonCodeInput.disabled = false;
    lessonCodeInput.readOnly = false;
    lessonCodeInput.style.backgroundColor = '';
    lessonCodeInput.value = "";
    lessonCodeInput.focus();
    saveLessonCodeBtn.textContent = "저장";
    lessonCodeStatus.textContent = "새로운 수업 코드를 입력하고 저장해주세요.";
    lessonCodeStatus.className = "text-xs text-center text-gray-500";
    // Reset student name section when changing lesson code
    studentName = "";
    sessionId = "";
    localStorage.removeItem(`studentName_${lessonCode}`);
    studentNameInput.value = "";
    studentNameInput.disabled = true; // Disable when no lesson code
    saveStudentNameBtn.textContent = "저장";
    studentNameStatus.textContent = "수업 코드 저장 후 이름을 입력하세요.";
    studentNameStatus.className = "text-xs text-center text-gray-400";
    return;
  }

  const code = lessonCodeInput.value.trim().toUpperCase();
  if (code) {
    localStorage.setItem("lessonCode", code);
    lessonCode = code;
    alert("수업 코드가 저장되었습니다.");
    initializeTutorState();
    // Enable and update student name section after lesson code is saved
    initializeStudentNameState();
  } else {
    alert("수업 코드를 입력해주세요.");
  }
}

function initializeStudentNameState() {
  // Always show student name section
  studentNameSection.classList.remove("hidden");

  if (lessonCode) {
    studentName = localStorage.getItem(`studentName_${lessonCode}`);
    if (studentName) {
      studentNameInput.value = studentName;
      studentNameInput.disabled = true;
      saveStudentNameBtn.textContent = "변경";
      studentNameStatus.textContent = `안녕하세요, ${studentName}님! 학습 기록이 저장됩니다.`;
      studentNameStatus.className = "text-xs text-center text-green-600";
      generateSessionId();
    } else {
      studentNameInput.disabled = false; // Enable input when lesson code exists
      saveStudentNameBtn.textContent = "저장";
      studentNameStatus.textContent = "학습 기록을 위해 이름을 입력해주세요.";
      studentNameStatus.className = "text-xs text-center text-gray-500";
    }
  } else {
    saveStudentNameBtn.textContent = "저장";
    studentNameStatus.textContent = "수업 코드 저장 후 이름을 입력하세요.";
    studentNameStatus.className = "text-xs text-center text-gray-400";
    studentNameInput.disabled = true; // Disable until lesson code is entered
  }
}

function saveStudentName() {
  if (saveStudentNameBtn.textContent === "변경") {
    studentNameInput.disabled = false;
    studentNameInput.value = "";
    studentNameInput.focus();
    saveStudentNameBtn.textContent = "저장";
    studentNameStatus.textContent = "새로운 이름을 입력하고 저장해주세요.";
    studentNameStatus.className = "text-xs text-center text-gray-500";
    return;
  }

  const name = studentNameInput.value.trim();
  if (name) {
    localStorage.setItem(`studentName_${lessonCode}`, name);
    studentName = name;
    alert("이름이 저장되었습니다. 이제 대화 기록이 저장됩니다!");
    initializeStudentNameState();
  } else {
    alert("이름을 입력해주세요.");
  }
}

function generateSessionId() {
  if (!sessionId) {
    sessionId = `${lessonCode}_${studentName}_${Date.now()}`;
  }
}

async function handleChatSubmit(e) {
  e.preventDefault();
  const userInput = chatInput.value.trim();
  if (!userInput) return;

  if (!lessonCode) {
    displayAiMessage(
      "아이고! 수업 코드를 먼저 저장해야 대화를 시작할 수 있어요."
    );
    lessonCodeInput.focus();
    return;
  }

  displayUserMessage(userInput);
  conversationHistory.push({ role: "user", parts: [{ text: userInput }] });
  chatInput.value = "";
  typingIndicator.style.display = "block";
  chatWindow.scrollTop = chatWindow.scrollHeight;

  try {
    const apiData = {
      lessonCode: lessonCode,
      userMessage: userInput,
      conversationHistory: conversationHistory,
    };

    // 학생 이름과 세션 ID가 있으면 추가
    if (studentName && sessionId) {
      apiData.studentName = studentName;
      apiData.sessionId = sessionId;
    }

    const aiResponseText = await callGeminiApi(apiData);
    displayAiMessage(aiResponseText);
    conversationHistory.push({
      role: "model",
      parts: [{ text: aiResponseText }],
    });
  } catch (error) {
    console.error("Error fetching AI response:", error);
    displayAiMessage(`이런, 지금은 연결이 어려운 것 같아요. ${error.message}`);
  } finally {
    typingIndicator.style.display = "none";
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }
}

function displayUserMessage(message) {
  const messageElement = document.createElement("div");
  messageElement.className = "chat-message user-message";
  const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  messageElement.innerHTML = `
    <p>${message}</p>
    <span class="timestamp">${timestamp}</span>
  `;
  chatWindow.appendChild(messageElement);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function displayAiMessage(message, isFirst = false) {
  const messageElement = document.createElement("div");
  messageElement.className = "chat-message ai-message";
  const timestamp = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });

  const avatar = `<div class="avatar"><i data-lucide="bot"></i></div>`;

  messageElement.innerHTML = `
        <div class="message-content">
            ${isFirst || conversationHistory.length === 0 ? avatar : ""}
            <p>${message}</p>
            <span class="timestamp">${timestamp}</span>
        </div>
    `;

  chatWindow.appendChild(messageElement);
  lucide.createIcons();
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

