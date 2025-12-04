import { callGeminiApi, fetchStudentStats } from "./api.js";
import { db } from "./firebase-config.js";
import { collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

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

// 게임화 시스템 관련 변수
let currentGameStats = {
  level: 1,
  exp: 0,
  nextLevelExp: 50,
  currentTitle: { name: '탐구자', icon: '🌱' },
  achievements: []
};


export function initChatbot() {
  saveLessonCodeBtn.addEventListener("click", saveLessonCode);
  saveStudentNameBtn.addEventListener("click", saveStudentName);
  chatForm.addEventListener("submit", handleChatSubmit);

  // URL 파라미터 확인
  handleUrlParameters();
  
  initializeTutorState();
  initializeStudentNameState();
  initializeGamificationUI();
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
  console.log("[initializeTutorState] 저장된 수업 코드:", lessonCode);
  
  if (lessonCode) {
    lessonCodeInput.value = lessonCode;
    lessonCodeInput.disabled = true;
    saveLessonCodeBtn.textContent = "변경";
    lessonCodeStatus.textContent = "수업 코드가 연결되었습니다.";
    lessonCodeStatus.className = "text-xs text-center text-green-600";
    
    console.log("[initializeTutorState] 수업 정보 가져오기 시작:", lessonCode);
    // 수업 정보 가져오기
    fetchAndDisplayLessonInfo(lessonCode);
    
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
    
    // 수업 정보 숨기기
    hideLessonInfo();
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
    
    // 수업 정보 숨기기
    hideLessonInfo();
    return;
  }

  const code = lessonCodeInput.value.trim().toUpperCase();
  if (code) {
    console.log("[saveLessonCode] 입력된 코드 (대문자 변환):", code);
    console.log("[saveLessonCode] 원본 입력:", lessonCodeInput.value);
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
    initializeGamificationUI(); // 게임화 UI 초기화
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

    const response = await callGeminiApi(apiData);
    
    // 응답이 문자열인 경우 (이전 버전 호환)
    let aiResponseText = response;
    console.log("[handleChatSubmit] API Response:", response); // 디버깅용 로그 추가

    if (typeof response === 'object' && response.text) {
      aiResponseText = response.text;
      
      // 게임화 정보 처리
      if (response.gamification) {
        console.log("[handleChatSubmit] Gamification Data Received:", response.gamification); // 디버깅용 로그 추가
        updateGamificationStats(response.gamification);
      } else {
        console.warn("[handleChatSubmit] No gamification data in response");
      }
      
      // 성취 처리
      if (response.achievements && response.achievements.length > 0) {
        handleAchievements(response.achievements);
      }
    }
    
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

// 게임화 UI 초기화
async function initializeGamificationUI() {
  const gamificationPanel = document.getElementById('gamification-panel');
  
  // 학생 이름과 세션 ID가 있을 때만 게임화 패널 표시 및 데이터 로드
  if (studentName && sessionId) {
    gamificationPanel?.classList.remove('hidden');
    
    // 서버에서 최신 통계 가져오기
    try {
      console.log("[initializeGamificationUI] 통계 불러오기 시작:", sessionId);
      const stats = await fetchStudentStats(sessionId);
      if (stats) {
        console.log("[initializeGamificationUI] 통계 로드 완료:", stats);
        updateGamificationStats({
          currentLevel: stats.level,
          currentExp: stats.exp,
          nextLevelExp: stats.nextLevelExp,
          newTitle: stats.currentTitle,
          // achievements: stats.achievements // 성취 목록은 별도 처리 필요시 추가
        });
      }
    } catch (error) {
      console.error("[initializeGamificationUI] 통계 로드 실패:", error);
    }
    
    updateGamificationDisplay();
  } else {
    gamificationPanel?.classList.add('hidden');
  }
}

// 게임화 통계 업데이트
function updateGamificationStats(gamificationData) {
  if (!gamificationData) return;
  
  // 경험치 및 레벨 업데이트
  if (gamificationData.currentExp !== undefined) {
    currentGameStats.exp = gamificationData.currentExp;
  }
  if (gamificationData.currentLevel !== undefined) {
    currentGameStats.level = gamificationData.currentLevel;
  }
  if (gamificationData.nextLevelExp !== undefined) {
    currentGameStats.nextLevelExp = gamificationData.nextLevelExp;
  }
  if (gamificationData.newTitle) {
    currentGameStats.currentTitle = gamificationData.newTitle;
  }
  
  // UI 업데이트
  updateGamificationDisplay();
  
  // 경험치 획듍 알림
  if (gamificationData.expGained && gamificationData.expGained > 0) {
    showExpGainNotification(gamificationData.expGained);
  }
  
  // 레벨업 처리
  if (gamificationData.leveledUp) {
    showLevelUpNotification(gamificationData.currentLevel, gamificationData.newTitle);
  }
}

// 게임화 UI 표시 업데이트
function updateGamificationDisplay() {
  // 레벨 표시
  const levelDisplay = document.getElementById('student-level-display');
  if (levelDisplay) {
    levelDisplay.textContent = `Lv. ${currentGameStats.level}`;
  }
  
  // 칭호 표시
  const titleDisplay = document.getElementById('student-title');
  if (titleDisplay && currentGameStats.currentTitle) {
    titleDisplay.textContent = `${currentGameStats.currentTitle.name} ${currentGameStats.currentTitle.icon}`;
  }
  
  // 경험치 표시
  const currentExpDisplay = document.getElementById('current-exp');
  const nextLevelExpDisplay = document.getElementById('next-level-exp');
  const expProgressBar = document.getElementById('exp-progress-bar');
  
  if (currentExpDisplay) {
    currentExpDisplay.textContent = currentGameStats.exp;
  }
  if (nextLevelExpDisplay) {
    nextLevelExpDisplay.textContent = currentGameStats.nextLevelExp;
  }
  if (expProgressBar) {
    const progressPercentage = (currentGameStats.exp / currentGameStats.nextLevelExp) * 100;
    expProgressBar.style.width = `${Math.min(progressPercentage, 100)}%`;
  }
  
  // 게임화 패널 표시
  const gamificationPanel = document.getElementById('gamification-panel');
  if (gamificationPanel && studentName && sessionId) {
    gamificationPanel.classList.remove('hidden');
  }
}

// 경험치 획듍 알림
function showExpGainNotification(expAmount) {
  const notification = document.getElementById('exp-gain-notification');
  const expAmountDisplay = document.getElementById('exp-gained-amount');
  
  if (!notification || !expAmountDisplay) return;
  
  expAmountDisplay.textContent = expAmount;
  notification.classList.remove('hidden');
  
  // 3초 후 숬김
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 3000);
}

// 레벨업 알림
function showLevelUpNotification(newLevel, newTitle) {
  const notification = document.getElementById('level-up-notification');
  const levelDisplay = document.getElementById('new-level-display');
  const titleDisplay = document.getElementById('new-title-display');
  
  if (!notification) return;
  
  if (levelDisplay) {
    levelDisplay.textContent = `Lv. ${newLevel}`;
  }
  if (titleDisplay && newTitle) {
    titleDisplay.textContent = `새로운 칭호: ${newTitle.name} ${newTitle.icon}`;
  }
  
  notification.classList.remove('hidden');
  
  // 5초 후 숬김
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 5000);
}

// 성취 처리
function handleAchievements(achievements) {
  if (!achievements || achievements.length === 0) return;
  
  achievements.forEach((achievement, index) => {
    // 각 성취를 순차적으로 표시
    setTimeout(() => {
      showAchievementNotification(achievement);
    }, index * 2000); // 2초 간격으로 표시
  });
  
  // 성취 목록 업데이트
  currentGameStats.achievements = [...currentGameStats.achievements, ...achievements];
  
  // 최신 성취 아이콘 표시
  if (achievements.length > 0) {
    const latestAchievement = achievements[achievements.length - 1];
    const iconDisplay = document.getElementById('latest-achievement-icon');
    if (iconDisplay && latestAchievement.icon) {
      iconDisplay.textContent = latestAchievement.icon;
    }
  }
}

// 성취 알림 표시
function showAchievementNotification(achievement) {
  const notification = document.getElementById('achievement-notification');
  const iconDisplay = document.getElementById('achievement-icon');
  const nameDisplay = document.getElementById('achievement-name');
  const descriptionDisplay = document.getElementById('achievement-description');
  const expBonusDisplay = document.getElementById('achievement-exp-bonus');
  
  if (!notification) return;
  
  if (iconDisplay) {
    iconDisplay.textContent = achievement.icon || '🏆';
  }
  if (nameDisplay) {
    nameDisplay.textContent = achievement.name || '성취 달성!';
  }
  if (descriptionDisplay) {
    descriptionDisplay.textContent = achievement.description || '';
  }
  if (expBonusDisplay) {
    expBonusDisplay.textContent = achievement.expBonus || 0;
  }
  
  notification.classList.remove('hidden');
  
  // 4초 후 숬김
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 4000);
}

// 수업 정보 가져오기 및 표시
async function fetchAndDisplayLessonInfo(lessonCode) {
  try {
    console.log("[fetchAndDisplayLessonInfo] ===== 수업 정보 조회 시작 =====");
    console.log("[fetchAndDisplayLessonInfo] 검색할 코드:", lessonCode);
    console.log("[fetchAndDisplayLessonInfo] 코드 타입:", typeof lessonCode);
    console.log("[fetchAndDisplayLessonInfo] 코드 길이:", lessonCode.length);
    
    // Firestore에서 수업 정보 조회 - 대소문자 무관하게 검색
    const lessonsRef = collection(db, "lessons");
    
    // 먼저 모든 lessons 문서를 가져와서 필드명 확인
    console.log("[fetchAndDisplayLessonInfo] 모든 lessons 문서 확인 중...");
    const allLessonsSnapshot = await getDocs(lessonsRef);
    console.log("[fetchAndDisplayLessonInfo] 전체 수업 개수:", allLessonsSnapshot.size);
    
    if (allLessonsSnapshot.size > 0) {
      console.log("[fetchAndDisplayLessonInfo] 첫 번째 수업 데이터 예시:");
      const firstDoc = allLessonsSnapshot.docs[0];
      const firstData = firstDoc.data();
      console.log("  - 문서 ID:", firstDoc.id);
      console.log("  - 데이터 필드들:", Object.keys(firstData));
      console.log("  - lessonCode 필드 값:", firstData.lessonCode);
      console.log("  - 전체 데이터:", firstData);
    }
    
    // 이제 실제 쿼리 실행
    console.log("[fetchAndDisplayLessonInfo] lessonCode가 '" + lessonCode + "'인 문서 검색 중...");
    const q = query(lessonsRef, where("lessonCode", "==", lessonCode));
    const querySnapshot = await getDocs(q);
    console.log("[fetchAndDisplayLessonInfo] 쿼리 결과 - 일치하는 문서 개수:", querySnapshot.size);
    
    if (!querySnapshot.empty) {
      const lessonDoc = querySnapshot.docs[0];
      const lessonData = lessonDoc.data();
      console.log("[fetchAndDisplayLessonInfo] 수업 데이터 조회 성공:");
      console.log("  - 문서 ID:", lessonDoc.id);
      console.log("  - 제목:", lessonData.title);
      console.log("  - 과목:", lessonData.subject);
      console.log("  - 설명:", lessonData.description);
      console.log("  - 자료 개수:", lessonData.resources?.length || 0);
      console.log("  - 전체 데이터:", lessonData);
      displayLessonInfo(lessonData);
    } else {
      console.warn("[fetchAndDisplayLessonInfo] 해당 수업 코드를 찾을 수 없습니다: " + lessonCode);
      console.log("[fetchAndDisplayLessonInfo] Firestore 컬렉션 'lessons'에서 lessonCode 필드가 '" + lessonCode + "'인 문서를 찾을 수 없음");
      // 기본 헤더 표시
      const defaultHeader = document.getElementById('default-header');
      if (defaultHeader) {
        defaultHeader.classList.remove('hidden');
      }
      hideLessonInfo();
    }
  } catch (error) {
    console.error("[fetchAndDisplayLessonInfo] 수업 정보를 가져오는 중 오류 발생:");
    console.error("  - 오류 메시지:", error.message);
    console.error("  - 오류 스택:", error.stack);
    console.error("  - 전체 오류 객체:", error);
    hideLessonInfo();
  }
}

// 수업 정보 UI에 표시
function displayLessonInfo(lessonData) {
  console.log("수업 정보 표시 시작:", lessonData);
  
  const lessonInfoSection = document.getElementById('lesson-info-section');
  const lessonTitle = document.getElementById('lesson-title');
  const lessonSubjectBadge = document.getElementById('lesson-subject-badge');
  const lessonDescription = document.getElementById('lesson-description');
  const resourcesList = document.getElementById('resources-list');
  
  // 기본 헤더와 고정 카드들 숨기기
  const defaultHeader = document.getElementById('default-header');
  if (defaultHeader) {
    defaultHeader.classList.add('hidden');
  }
  
  // 고정된 설명 카드들 숨기기
  const mainElement = document.querySelector('main');
  if (mainElement) {
    const sections = mainElement.querySelectorAll('section');
    sections.forEach(section => {
      // lesson-info-section이 아닌 모든 section 숨기기
      if (!section.closest('#lesson-info-section')) {
        section.style.display = 'none';
      }
    });
  }
  
  if (lessonInfoSection) {
    lessonInfoSection.classList.remove('hidden');
    console.log("수업 정보 섹션 표시됨");
  }
  
  if (lessonTitle) {
    lessonTitle.textContent = lessonData.title || '제목 없음';
  }
  
  if (lessonSubjectBadge) {
    const subjectNames = {
      'korean': '국어',
      'math': '수학',
      'social': '사회',
      'science': '과학'
    };
    const subjectDisplayName = subjectNames[lessonData.subject] || lessonData.subject || '과목 없음';
    lessonSubjectBadge.textContent = subjectDisplayName;
  }
  
  if (lessonDescription) {
    // studentDescription을 우선 표시, 없으면 description 표시
    const descriptionText = lessonData.studentDescription || lessonData.description;
    if (descriptionText) {
      lessonDescription.textContent = descriptionText;
      lessonDescription.parentElement.classList.remove('hidden');
    } else {
      lessonDescription.parentElement.classList.add('hidden');
    }
  }
  
  // 학습 자료 목록 표시
  if (resourcesList && lessonData.resources && lessonData.resources.length > 0) {
    resourcesList.innerHTML = '';
    const resourcesSection = document.getElementById('lesson-resources-section');
    if (resourcesSection) {
      resourcesSection.classList.remove('hidden');
    }
    
    lessonData.resources.forEach(resource => {
      const listItem = document.createElement('div');
      listItem.className = 'flex items-center gap-2 p-2 bg-white rounded-lg hover:bg-gray-50 transition-colors';
      
      if (resource.type === 'link') {
        listItem.innerHTML = `
          <span class="text-blue-500">🔗</span>
          <a href="${resource.url}" target="_blank" class="flex-1 text-blue-600 hover:text-blue-800 underline text-sm">
            ${resource.title}
          </a>
        `;
      } else if (resource.type === 'file') {
        const fileIcon = resource.fileName && resource.fileName.endsWith('.pdf') ? '📄' : '📎';
        listItem.innerHTML = `
          <span class="text-green-500">${fileIcon}</span>
          <a href="${resource.url}" target="_blank" class="flex-1 text-green-600 hover:text-green-800 underline text-sm">
            ${resource.title || resource.fileName}
          </a>
        `;
      }
      
      resourcesList.appendChild(listItem);
    });
    
  } else {
    // 자료가 없으면 섹션 숨기기
    const resourcesSection = document.getElementById('lesson-resources-section');
    if (resourcesSection) {
      resourcesSection.classList.add('hidden');
    }
  }
}

// 수업 정보 숨기기
function hideLessonInfo() {
  const lessonInfoSection = document.getElementById('lesson-info-section');
  if (lessonInfoSection) {
    lessonInfoSection.classList.add('hidden');
  }
  
  // 학습 자료 섹션도 숨기기
  const resourcesSection = document.getElementById('lesson-resources-section');
  if (resourcesSection) {
    resourcesSection.classList.add('hidden');
  }
}

