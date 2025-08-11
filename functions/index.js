const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 글로벌 설정
setGlobalOptions({ region: "asia-northeast3" });

admin.initializeApp();
const db = admin.firestore();

// 기본 프롬프트 함수
function getDefaultPrompt() {
    return "너는 친근하고 격려하는 과학 튜터야. 학생들이 그래비트랙스(GraviTrax) 실험을 통해 물리학 원리를 이해할 수 있도록 도와줘. 항상 긍정적이고 호기심을 유발하는 질문을 던져줘. 학생들의 질문에 대해 직접적인 답을 주기보다는, 스스로 생각해볼 수 있도록 힌트를 제공해줘.";
}

// 전체 프롬프트 생성 함수
function buildFullPrompt(customPrompt, userMessage, conversationHistory = []) {
    const systemInstruction = `${customPrompt}

### 너의 핵심 규칙 ###
1. 절대로 정답이나 해결 방법을 직접 알려주면 안 된다. 예를 들어, '높이를 올리세요'와 같은 직접적인 지시는 금지된다.
2. 너의 모든 답변은 반드시 학생의 다음 생각을 유도하는 '질문' 형태여야 한다.
3. 학생의 실패를 '중요한 단서'로 칭찬하고, 긍정적인 탐구 태도를 격려해야 한다.
4. 대화의 목표는 학생이 스스로 '높은 위치에너지가 큰 운동에너지로 전환된다'는 원리를 깨닫게 하는 것이다.
5. 학생의 발화에서 '높이', '속도', '힘'과 같은 단서가 나오면, 이를 '위치에너지', '운동에너지'와 같은 과학 용어와 연결하는 질문을 던져라.
6. 친절하고 격려하는 동료 탐험가 같은 말투를 사용하라. 한국어로만 대답해야 한다.`;

    const recentHistory = conversationHistory.slice(-6);
    const contents = [];

    // 시스템 지시사항과 첫 사용자 메시지 결합
    if (recentHistory.length === 0) {
        contents.push({ 
            role: 'user', 
            parts: [{ 
                text: `${systemInstruction}

### 현재 학습 맥락 ###
- 수업 단계: 전개 (활동3 - 인지적 갈등 유발 미션)
- 현재 미션: 낮은 출발점에서 시작하여 끊어진 레일(2칸 너비)을 점프해서 건너기

### 학생의 현재 발화 ###
${userMessage}` 
            }] 
        });
    } else {
        // 대화 이력이 있는 경우
        recentHistory.forEach((turn, index) => {
            if (index === 0) {
                const userTextWithSystemPrompt = `${systemInstruction}

### 현재 학습 맥락 ###
- 수업 단계: 전개 (활동3 - 인지적 갈등 유발 미션)
- 현재 미션: 낮은 출발점에서 시작하여 끊어진 레일(2칸 너비)을 점프해서 건너기

### 학생의 현재 발화 ###
${turn.parts[0].text}`;
                contents.push({ role: 'user', parts: [{ text: userTextWithSystemPrompt }] });
            } else {
                contents.push(turn);
            }
        });
        
        // 현재 사용자 메시지 추가
        contents.push({ role: 'user', parts: [{ text: userMessage }] });
    }

    return contents;
}

exports.getTutorResponse = onCall(async (request) => {
    const { data } = request;
    
    // 클라이언트로부터 teacherCode와 userMessage, conversationHistory를 받습니다.
    const { teacherCode, userMessage, conversationHistory } = data;

    if (!teacherCode) {
      throw new HttpsError('invalid-argument', '교사 코드가 필요합니다.');
    }

    if (!userMessage) {
      throw new HttpsError('invalid-argument', '사용자 메시지가 필요합니다.');
    }

    try {
      // 1. teacherCode를 사용해 Firestore에서 해당 교사의 문서를 찾습니다.
      const teacherDoc = await db.collection('teacher_keys').doc(teacherCode).get();

      if (!teacherDoc.exists) {
        throw new HttpsError('not-found', '유효하지 않은 교사 코드입니다.');
      }

      const teacherData = teacherDoc.data();
      const apiKey = teacherData.apiKey;

      if (!apiKey) {
        throw new HttpsError('internal', '해당 교사의 API 키가 등록되지 않았습니다.');
      }

      // 2. 교사의 커스텀 프롬프트와 모델 설정 가져오기
      const customPrompt = teacherData.customPrompt || getDefaultPrompt();
      const modelName = teacherData.modelName || 'gemini-1.5-flash';

      // 3. 가져온 API 키와 모델로 Gemini를 호출합니다.
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      // 4. 교사의 커스텀 프롬프트를 사용하여 최종 프롬프트 생성
      const fullPrompt = buildFullPrompt(customPrompt, userMessage, conversationHistory);
      
      const result = await model.generateContent({
        contents: fullPrompt,
        generationConfig: {
          "temperature": 0.7,
          "topP": 0.9,
          "maxOutputTokens": 150
        }
      });
      
      const response = await result.response;
      return { text: response.text() };

    } catch (error) {
      console.error("오류 발생:", error);
      // 이미 HttpsError인 경우 그대로 던지고, 아닌 경우 일반 오류로 처리
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', '서버 내부 오류가 발생했습니다.');
    }
});

// Google 인증 기반 교사 API 키 업데이트
exports.updateTeacherApiKey = onCall(async (request) => {
    const { data, auth } = request;
    const { apiKey } = data;
    
    // 인증 확인
    if (!auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    
    if (!apiKey) {
      throw new HttpsError('invalid-argument', 'API 키가 필요합니다.');
    }

    try {
      const userId = auth.uid;
      const userEmail = auth.token.email;
      
      // 교사 코드를 사용자 ID 기반으로 생성 (이메일 앞부분 + uid 일부)
      const emailPrefix = userEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const uidSuffix = userId.substring(0, 4);
      const teacherCode = `${emailPrefix}_${uidSuffix}`;
      
      await db.collection('teacher_keys').doc(teacherCode).set({
        userId: userId,
        userEmail: userEmail,
        apiKey: apiKey,
        teacherCode: teacherCode,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      return { success: true, teacherCode: teacherCode };
    } catch (error) {
      console.error("API 키 업데이트 오류:", error);
      throw new HttpsError('internal', 'API 키 저장 중 오류가 발생했습니다.');
    }
});

// 교사 정보 조회
exports.getTeacherInfo = onCall(async (request) => {
    const { auth } = request;
    
    if (!auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    try {
      const userId = auth.uid;
      
      // userId로 교사 정보 찾기
      const querySnapshot = await db.collection('teacher_keys')
        .where('userId', '==', userId)
        .limit(1)
        .get();
      
      if (querySnapshot.empty) {
        return { hasApiKey: false, teacherCode: null };
      }
      
      const teacherDoc = querySnapshot.docs[0];
      const teacherData = teacherDoc.data();
      
      return {
        hasApiKey: !!teacherData.apiKey,
        teacherCode: teacherData.teacherCode,
        customPrompt: teacherData.customPrompt || '',
        modelName: teacherData.modelName || 'gemini-1.5-flash'
      };
      
    } catch (error) {
      console.error("교사 정보 조회 오류:", error);
      throw new HttpsError('internal', '교사 정보 조회 중 오류가 발생했습니다.');
    }
});

// 교사 프롬프트 업데이트
exports.updateTeacherPrompt = onCall(async (request) => {
    const { data, auth } = request;
    const { prompt } = data;
    
    if (!auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    
    if (!prompt) {
      throw new HttpsError('invalid-argument', '프롬프트가 필요합니다.');
    }

    try {
      const userId = auth.uid;
      
      // userId로 교사 문서 찾기
      const querySnapshot = await db.collection('teacher_keys')
        .where('userId', '==', userId)
        .limit(1)
        .get();
        
      if (querySnapshot.empty) {
        throw new HttpsError('not-found', '교사 정보를 찾을 수 없습니다.');
      }
      
      const teacherDoc = querySnapshot.docs[0];
      
      await teacherDoc.ref.update({
        customPrompt: prompt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error("프롬프트 업데이트 오류:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', '프롬프트 저장 중 오류가 발생했습니다.');
    }
});

// 교사 모델 설정 업데이트
exports.updateTeacherModel = onCall(async (request) => {
    const { data, auth } = request;
    const { modelName } = data;
    
    if (!auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    
    if (!modelName) {
      throw new HttpsError('invalid-argument', '모델명이 필요합니다.');
    }

    // 사용 가능한 모델 목록
    const availableModels = [
        'gemini-1.5-flash',
        'gemini-1.5-pro',
        'gemini-1.0-pro'
    ];

    if (!availableModels.includes(modelName)) {
        throw new HttpsError('invalid-argument', '지원되지 않는 모델입니다.');
    }

    try {
      const userId = auth.uid;
      
      // userId로 교사 문서 찾기
      const querySnapshot = await db.collection('teacher_keys')
        .where('userId', '==', userId)
        .limit(1)
        .get();
        
      if (querySnapshot.empty) {
        throw new HttpsError('not-found', '교사 정보를 찾을 수 없습니다.');
      }
      
      const teacherDoc = querySnapshot.docs[0];
      
      await teacherDoc.ref.update({
        modelName: modelName,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error("모델 설정 업데이트 오류:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', '모델 설정 저장 중 오류가 발생했습니다.');
    }
});

// 개발자용: 수동 교사 등록 (기존 호환성 유지)
exports.addTeacher = onCall(async (request) => {
    const { data } = request;
    const { teacherCode, apiKey, teacherName } = data;
    
    if (!teacherCode || !apiKey) {
      throw new HttpsError('invalid-argument', '교사 코드와 API 키가 모두 필요합니다.');
    }

    try {
      await db.collection('teacher_keys').doc(teacherCode).set({
        apiKey: apiKey,
        teacherName: teacherName || '',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true, message: '교사 정보가 성공적으로 등록되었습니다.' };
    } catch (error) {
      console.error("교사 등록 오류:", error);
      throw new HttpsError('internal', '교사 정보 등록 중 오류가 발생했습니다.');
    }
});
