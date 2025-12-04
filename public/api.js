import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { functions } from './firebase-config.js';

const getTutorResponseFunction = httpsCallable(functions, 'getTutorResponse');

// API 데이터 객체를 인자로 받습니다. (lessonCode, userMessage, conversationHistory, studentName, sessionId)
export async function callGeminiApi(apiData) {
    try {
        const result = await getTutorResponseFunction(apiData);
        return result.data;
    } catch (error) {
        console.error("Firebase Function 호출 중 오류:", error);
        
        // Firebase Functions 에러 처리
        if (error.code === 'functions/not-found') {
            throw new Error("유효하지 않은 수업 코드입니다.");
        } else if (error.code === 'functions/internal') {
            throw new Error(error.message || "서버 내부 오류가 발생했습니다.");
        } else if (error.code === 'functions/invalid-argument') {
            throw new Error("수업 코드 또는 메시지가 필요합니다.");
        }
        
        throw new Error(error.message || "서버 연결에 실패했습니다.");
    }
}

// 학생 통계 조회 함수
export async function fetchStudentStats(sessionId) {
  try {
    const getStudentStats = httpsCallable(functions, 'getStudentStats');
    const result = await getStudentStats({ sessionId });
    return result.data;
  } catch (error) {
    console.error("통계 조회 중 오류:", error);
    // 오류 발생 시 기본값 반환하여 UI가 깨지지 않도록 함
    return {
      level: 1,
      exp: 0,
      nextLevelExp: 50,
      currentTitle: { name: '탐구자', icon: '🌱' },
      achievements: []
    };
  }
}
