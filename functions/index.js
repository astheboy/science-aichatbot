const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 글로벌 설정
setGlobalOptions({ region: "asia-northeast3" });

admin.initializeApp();
const db = admin.firestore();

// 학생 응답 유형 분석 함수
function analyzeStudentResponse(userMessage) {
    const message = userMessage.toLowerCase().trim();
    
    // 개념 질문 패턴
    const conceptQuestionPatterns = [
        /(무엇|뭐|뭘).*[이에]?요?\?*$/, 
        /왜.*[이에]?요?\?*$/, 
        /.*[이란|이게|란] 뭐/, 
        /(알려|설명).*주[세시]/, 
        /(에너지|위치에너지|운동에너지|힘|속도).*[이가] 뭐/
    ];
    
    // 탐색 교착상태 패턴
    const explorationDeadlockPatterns = [
        /어떻게.*해야.*모르겠/, 
        /뭘.*바꿔야/, 
        /안.*되나.*봐/, 
        /막막/, 
        /포기/, 
        /못.*하겠/, 
        /안.*돼/
    ];
    
    // 실패 보고 패턴
    const failureReportPatterns = [
        /구슬이.*떨어짐/, 
        /점프.*못/, 
        /지나가/, 
        /닿지.*않/, 
        /멈췄/, 
        /실패/, 
        /안.*움직임/
    ];
    
    // 원리 미연결 성공 패턴
    const successWithoutPrinciplePatterns = [
        /성공/, 
        /됐다/, 
        /되네/, 
        /건너갔/, 
        /(높게|높이).*만드니까.*됐/, 
        /드디어.*됐/
    ];
    
    // 가설 기반 질문 패턴
    const hypothesisInquiryPatterns = [
        /만약.*하면/, 
        /.*해서.*그런가/, 
        /.*[면서].*될까/, 
        /경사를.*하면/, 
        /높이를.*하면/, 
        /무거우면.*더/
    ];
    
    // 패턴 매칭으로 응답 유형 분석
    if (conceptQuestionPatterns.some(pattern => pattern.test(message))) {
        return 'CONCEPT_QUESTION';
    }
    if (explorationDeadlockPatterns.some(pattern => pattern.test(message))) {
        return 'EXPLORATION_DEADLOCK';
    }
    if (failureReportPatterns.some(pattern => pattern.test(message))) {
        return 'FAILURE_REPORT';
    }
    if (successWithoutPrinciplePatterns.some(pattern => pattern.test(message))) {
        return 'SUCCESS_WITHOUT_PRINCIPLE';
    }
    if (hypothesisInquiryPatterns.some(pattern => pattern.test(message))) {
        return 'HYPOTHESIS_INQUIRY';
    }
    
    return 'DEFAULT';
}

// 응답 유형별 프롬프트 가져오기
function getPromptByResponseType(responseType, customPrompts) {
    const defaultPrompts = {
        'DEFAULT': "너는 친근하고 격려하는 과학 튜터야. 학생들이 그래비트랙스(GraviTrax) 실험을 통해 물리학 원리를 이해할 수 있도록 도와줘. 항상 긍정적이고 호기심을 유발하는 질문을 던져줘. 학생들의 질문에 대해 직접적인 답을 주기보다는, 스스로 생각해볼 수 있도록 힌트를 제공해줘.",
        
        'CONCEPT_QUESTION': "너는 개념을 직관적으로 설명하는 과학 튜터야. 학생이 개념에 대해 질문했을 때는 롤러코스터, 미끄럼틀 같은 일상적인 비유를 사용해서 설명하고, 그 다음에 '그렇다면 우리 실험에서는 어떨까?'라는 식으로 연결 질문을 던져줘. 절대 바로 정답을 말하지 말고, 학생이 스스로 깨달을 수 있도록 단계적 힌트를 제공해줘.",
        
        'EXPLORATION_DEADLOCK': "너는 막힌 상황을 돌파하도록 돕는 탐구 가이드야. 학생이 막막해할 때는 '괜찮다, 모든 과학자들이 겪는 과정이다'라고 격려하고, 바꿀 수 있는 변인들(높이, 경사, 길이, 트랙 모양 등)을 하나씩 제시해서 탐색 방향을 안내해줘. 학생이 직접 선택하게 하고, '어떤 것부터 바꿔볼까?'라는 식으로 주도권을 학생에게 줘.",
        
        'FAILURE_REPORT': "너는 실패를 중요한 단서로 바꾸는 탐정 튜터야. 학생이 실패 상황을 보고했을 때는 '아주 중요한 단서다!'라고 긍정적으로 반응하고, 그 실패가 일어난 구체적인 순간과 원인을 깊이 관찰하도록 유도해줘. '왜 그렇게 됐을까?' '무엇이 부족했을까?'라는 질문으로 학생 스스로 원인을 추론하게 도와줘.",
        
        'SUCCESS_WITHOUT_PRINCIPLE': "너는 성공을 과학적 원리로 연결하는 교사야. 학생이 성공했다고 할 때는 먼저 축하하고, 그 다음 '단지 높여서 성공한 걸까?'라고 물으며 현상 이면의 과학 원리를 탐구하게 유도해줘. '높이'→'위치에너지', '빨라짐'→'운동에너지'로 점진적으로 과학 용어를 도입하되, 학생이 먼저 현상을 설명하게 한 후에 용어를 제시해줘.",
        
        'HYPOTHESIS_INQUIRY': "너는 과학적 사고를 칭찬하고 심화시키는 멘토야. 학생이 가설을 제시했을 때는 '훌륭한 과학적 사고다!'라고 크게 격려하고, 그 가설을 검증할 구체적인 실험 방법을 학생 스스로 설계하게 도와줘. '어떻게 확인해볼 수 있을까?' '결과를 어떻게 비교할까?'라는 질문으로 실험 설계 능력을 기르게 해줘."
    };
    
    // 커스텀 프롬프트가 있으면 우선 사용, 없으면 기본 프롬프트 사용
    if (customPrompts && customPrompts[responseType]) {
        return customPrompts[responseType];
    }
    
    return defaultPrompts[responseType] || defaultPrompts['DEFAULT'];
}

// 기본 프롬프트 함수 (호환성 유지)
function getDefaultPrompt() {
    return getPromptByResponseType('DEFAULT', null);
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
6. 친절하고 격려하는 동료 탐험가 같은 말투를 사용하라. 한국어로만 대답해야 한다.
7. **중요**: 답변에 마크다운 문법(*, **, #, ## 등)을 사용하지 말고 순수한 텍스트로만 작성해라.`;

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
    
    // 클라이언트로부터 teacherCode, userMessage, conversationHistory, 그리고 학생 정보를 받습니다.
    const { teacherCode, userMessage, conversationHistory, studentName, sessionId } = data;

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

      // 2. 학생 응답 유형 분석
      const responseType = analyzeStudentResponse(userMessage);
      console.log(`학생 응답 유형 분석: ${responseType}`);
      
      // 3. 교사의 커스텀 프롬프트와 모델 설정 가져오기
      const customPrompts = teacherData.customPrompts || {}; // 유형별 커스텀 프롬프트
      const adaptivePrompt = getPromptByResponseType(responseType, customPrompts);
      const modelName = teacherData.modelName || 'gemini-2.0-flash-exp';

      // 4. 가져온 API 키와 모델로 Gemini를 호출합니다.
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      // 5. 적응적 프롬프트를 사용하여 최종 프롬프트 생성
      const fullPrompt = buildFullPrompt(adaptivePrompt, userMessage, conversationHistory);
      
      const result = await model.generateContent({
        contents: fullPrompt,
        generationConfig: {
          "temperature": 0.7,
          "topP": 0.9,
          "maxOutputTokens": 300
        }
      });
      
      const response = await result.response;
      const aiResponseText = response.text();
      
      // 6. 대화 기록 저장 (학생 이름과 세션 ID가 있는 경우에만)
      if (studentName && sessionId) {
        try {
          const conversationData = {
            teacherCode: teacherCode,
            studentName: studentName,
            sessionId: sessionId,
            userMessage: userMessage,
            aiResponse: aiResponseText,
            responseType: responseType,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            conversationLength: (conversationHistory ? conversationHistory.length : 0) + 1
          };
          
          // conversations 컬렉션에 개별 메시지 저장
          await db.collection('conversations').add(conversationData);
          
          // sessions 컬렉션에서 세션 정보 업데이트 또는 생성
          const sessionRef = db.collection('sessions').doc(sessionId);
          await sessionRef.set({
            teacherCode: teacherCode,
            studentName: studentName,
            sessionId: sessionId,
            lastActivity: admin.firestore.FieldValue.serverTimestamp(),
            messageCount: admin.firestore.FieldValue.increment(1),
            responseTypes: admin.firestore.FieldValue.arrayUnion(responseType)
          }, { merge: true });
          
        } catch (logError) {
          console.error('대화 기록 저장 실패:', logError);
          // 로그 저장 실패는 사용자 경험에 영향을 주지 않음
        }
      }
      
      return { text: aiResponseText };

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

    // 사용 가능한 모델 목록 (최신 Gemini 2.0 모델 포함)
    const availableModels = [
        'gemini-2.0-flash-exp',
        'gemini-2.0-flash-thinking-exp-1219',  
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

// 교사 유형별 프롬프트 업데이트
exports.updateTeacherPrompts = onCall(async (request) => {
    const { data, auth } = request;
    const { prompts } = data;
    
    if (!auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    
    if (!prompts || typeof prompts !== 'object') {
      throw new HttpsError('invalid-argument', '프롬프트 데이터가 필요합니다.');
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
        customPrompts: prompts,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { success: true };
    } catch (error) {
      console.error("유형별 프롬프트 업데이트 오류:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', '유형별 프롬프트 저장 중 오류가 발생했습니다.');
    }
});

// 교사 전체 설정 조회 (유형별 프롬프트 포함)
exports.getTeacherSettings = onCall(async (request) => {
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
      
      // 기본 프롬프트들 가져오기
      const defaultPrompts = {
        'DEFAULT': getPromptByResponseType('DEFAULT', null),
        'CONCEPT_QUESTION': getPromptByResponseType('CONCEPT_QUESTION', null),
        'EXPLORATION_DEADLOCK': getPromptByResponseType('EXPLORATION_DEADLOCK', null),
        'FAILURE_REPORT': getPromptByResponseType('FAILURE_REPORT', null),
        'SUCCESS_WITHOUT_PRINCIPLE': getPromptByResponseType('SUCCESS_WITHOUT_PRINCIPLE', null),
        'HYPOTHESIS_INQUIRY': getPromptByResponseType('HYPOTHESIS_INQUIRY', null)
      };
      
      return {
        hasApiKey: !!teacherData.apiKey,
        teacherCode: teacherData.teacherCode,
        modelName: teacherData.modelName || 'gemini-2.0-flash-exp',
        customPrompts: teacherData.customPrompts || {},
        defaultPrompts: defaultPrompts,
        availableModels: [
          'gemini-2.0-flash-exp',
          'gemini-2.0-flash-thinking-exp-1219',
          'gemini-1.5-flash',
          'gemini-1.5-pro',
          'gemini-1.0-pro'
        ]
      };
      
    } catch (error) {
      console.error("교사 설정 조회 오류:", error);
      throw new HttpsError('internal', '교사 설정 조회 중 오류가 발생했습니다.');
    }
});

// 교사별 학생 대화 세션 목록 조회
exports.getStudentSessions = onCall(async (request) => {
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
        throw new HttpsError('not-found', '교사 정보를 찾을 수 없습니다.');
      }
      
      const teacherDoc = querySnapshot.docs[0];
      const teacherData = teacherDoc.data();
      const teacherCode = teacherData.teacherCode;
      
      // 해당 교사의 학생 세션들 가져오기
      const sessionsSnapshot = await db.collection('sessions')
        .where('teacherCode', '==', teacherCode)
        .orderBy('lastActivity', 'desc')
        .limit(100)
        .get();
      
      const sessions = [];
      sessionsSnapshot.forEach(doc => {
        const sessionData = doc.data();
        sessions.push({
          sessionId: doc.id,
          studentName: sessionData.studentName,
          messageCount: sessionData.messageCount || 0,
          lastActivity: sessionData.lastActivity,
          responseTypes: sessionData.responseTypes || []
        });
      });
      
      return { sessions: sessions };
      
    } catch (error) {
      console.error("학생 세션 조회 오류:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', '학생 세션 조회 중 오류가 발생했습니다.');
    }
});

// 특정 학생 세션의 대화 기록 조회
exports.getStudentConversation = onCall(async (request) => {
    const { data, auth } = request;
    const { sessionId } = data;
    
    if (!auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    
    if (!sessionId) {
      throw new HttpsError('invalid-argument', '세션 ID가 필요합니다.');
    }

    try {
      const userId = auth.uid;
      
      // userId로 교사 정보 찾기
      const querySnapshot = await db.collection('teacher_keys')
        .where('userId', '==', userId)
        .limit(1)
        .get();
        
      if (querySnapshot.empty) {
        throw new HttpsError('not-found', '교사 정보를 찾을 수 없습니다.');
      }
      
      const teacherDoc = querySnapshot.docs[0];
      const teacherData = teacherDoc.data();
      const teacherCode = teacherData.teacherCode;
      
      // 세션 정보 가져오기
      const sessionDoc = await db.collection('sessions').doc(sessionId).get();
      if (!sessionDoc.exists) {
        throw new HttpsError('not-found', '세션을 찾을 수 없습니다.');
      }
      
      const sessionData = sessionDoc.data();
      
      // 교사 코드가 일치하는지 확인 (보안)
      if (sessionData.teacherCode !== teacherCode) {
        throw new HttpsError('permission-denied', '해당 세션에 접근할 권한이 없습니다.');
      }
      
      // 해당 세션의 대화 기록들 가져오기
      const conversationsSnapshot = await db.collection('conversations')
        .where('sessionId', '==', sessionId)
        .orderBy('timestamp', 'asc')
        .get();
      
      const conversations = [];
      conversationsSnapshot.forEach(doc => {
        const conversationData = doc.data();
        conversations.push({
          id: doc.id,
          userMessage: conversationData.userMessage,
          aiResponse: conversationData.aiResponse,
          responseType: conversationData.responseType,
          timestamp: conversationData.timestamp,
          conversationLength: conversationData.conversationLength
        });
      });
      
      return {
        session: {
          sessionId: sessionId,
          studentName: sessionData.studentName,
          teacherCode: sessionData.teacherCode,
          messageCount: sessionData.messageCount || 0,
          lastActivity: sessionData.lastActivity,
          responseTypes: sessionData.responseTypes || []
        },
        conversations: conversations
      };
      
    } catch (error) {
      console.error("대화 기록 조회 오류:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', '대화 기록 조회 중 오류가 발생했습니다.');
    }
});

// 학생 사고 발전 분석 생성
exports.generateStudentAnalysis = onCall(async (request) => {
    const { data, auth } = request;
    const { sessionId } = data;
    
    if (!auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    
    if (!sessionId) {
      throw new HttpsError('invalid-argument', '세션 ID가 필요합니다.');
    }

    try {
      const userId = auth.uid;
      
      // 교사 정보 및 권한 확인
      const querySnapshot = await db.collection('teacher_keys')
        .where('userId', '==', userId)
        .limit(1)
        .get();
        
      if (querySnapshot.empty) {
        throw new HttpsError('not-found', '교사 정보를 찾을 수 없습니다.');
      }
      
      const teacherDoc = querySnapshot.docs[0];
      const teacherData = teacherDoc.data();
      const teacherCode = teacherData.teacherCode;
      const apiKey = teacherData.apiKey;
      
      // 세션의 대화 기록 가져오기
      const conversationResult = await exports.getStudentConversation.handler({
        data: { sessionId },
        auth
      });
      
      const { session, conversations } = conversationResult;
      
      if (conversations.length === 0) {
        throw new HttpsError('invalid-argument', '분석할 대화가 없습니다.');
      }
      
      // 대화 내용을 분석용 텍스트로 변환
      const conversationText = conversations.map((conv, index) => {
        return `[${index + 1}번째 대화 - ${conv.responseType}]\n학생: ${conv.userMessage}\nAI 튜터: ${conv.aiResponse}\n`;
      }).join('\n');
      
      // 분석용 프롬프트 생성
      const analysisPrompt = `당신은 교육 전문가입니다. 다음은 한 학생이 그래비트랙스 물리 실험에서 AI 튜터와 나눈 대화 기록입니다.

학생 이름: ${session.studentName}
총 대화 횟수: ${conversations.length}회
주요 응답 유형: ${session.responseTypes.join(', ')}

=== 대화 기록 ===
${conversationText}

=== 분석 요청 ===
위 대화를 바탕으로 다음 관점에서 학생의 사고 발전 과정을 분석해주세요:

1. **학습 진행 단계**: 학생이 어떤 단계를 거쳐 학습했는가?
2. **사고 유형 변화**: 질문 유형이 어떻게 발전했는가?
3. **과학적 탐구 능력**: 가설 설정, 실험 설계, 결과 해석 능력은?
4. **개념 이해도**: 위치에너지, 운동에너지 개념을 얼마나 이해했는가?
5. **개선 제안**: 향후 학습을 위한 구체적인 제안사항

각 항목을 명확하고 구체적으로 분석하되, 교사가 쉽게 이해할 수 있도록 작성해주세요.`;
      
      // Gemini API 호출하여 분석 생성
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
        generationConfig: {
          "temperature": 0.3,
          "topP": 0.8,
          "maxOutputTokens": 1000
        }
      });
      
      const response = await result.response;
      const analysisText = response.text();
      
      // 분석 결과를 데이터베이스에 저장
      const analysisData = {
        sessionId: sessionId,
        studentName: session.studentName,
        teacherCode: teacherCode,
        analysisText: analysisText,
        conversationCount: conversations.length,
        responseTypes: session.responseTypes,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedBy: userId
      };
      
      const analysisRef = await db.collection('student_analyses').add(analysisData);
      
      return {
        analysisId: analysisRef.id,
        analysisText: analysisText,
        session: session
      };
      
    } catch (error) {
      console.error("학생 분석 생성 오류:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', '학생 분석 생성 중 오류가 발생했습니다.');
    }
});

// 영재성 평가를 위한 학생 대화 분석
exports.analyzeStudentConversations = onCall(async (request) => {
    const { data, auth } = request;
    const { sessionId } = data;
    
    if (!auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    
    if (!sessionId) {
      throw new HttpsError('invalid-argument', '세션 ID가 필요합니다.');
    }

    try {
      const userId = auth.uid;
      
      // 교사 정보 및 권한 확인
      const querySnapshot = await db.collection('teacher_keys')
        .where('userId', '==', userId)
        .limit(1)
        .get();
        
      if (querySnapshot.empty) {
        throw new HttpsError('not-found', '교사 정보를 찾을 수 없습니다.');
      }
      
      const teacherDoc = querySnapshot.docs[0];
      const teacherData = teacherDoc.data();
      const teacherCode = teacherData.teacherCode;
      const apiKey = teacherData.apiKey;
      const modelName = teacherData.modelName || 'gemini-2.0-flash-exp';
      
      // 1. 먼저 기존 분석 결과가 있는지 확인
      const existingAnalysisSnapshot = await db.collection('conversation_analyses')
        .where('sessionId', '==', sessionId)
        .where('teacherCode', '==', teacherCode)
        .where('analysisType', '==', 'gifted_assessment')
        .orderBy('generatedAt', 'desc')
        .limit(1)
        .get();
      
      // 기존 분석이 있으면 바로 반환
      if (!existingAnalysisSnapshot.empty) {
        const existingAnalysisDoc = existingAnalysisSnapshot.docs[0];
        const existingAnalysis = existingAnalysisDoc.data();
        const analysisId = existingAnalysisDoc.id;
        
        console.log(`기존 분석 결과 발견: ${analysisId}`);
        
        return {
          analysisId: analysisId,
          analysis: existingAnalysis.analysisText,
          sessionInfo: {
            sessionId: sessionId,
            studentName: existingAnalysis.studentName,
            conversationCount: existingAnalysis.conversationCount,
            responseTypes: existingAnalysis.responseTypes || []
          },
          isExistingAnalysis: true, // 기존 분석임을 표시
          generatedAt: existingAnalysis.generatedAt ? existingAnalysis.generatedAt.toDate() : new Date()
        };
      }
      
      // 세션의 대화 기록 가져오기
      const sessionDoc = await db.collection('sessions').doc(sessionId).get();
      if (!sessionDoc.exists) {
        throw new HttpsError('not-found', '세션을 찾을 수 없습니다.');
      }
      
      const sessionData = sessionDoc.data();
      
      // 교사 코드가 일치하는지 확인 (보안)
      if (sessionData.teacherCode !== teacherCode) {
        throw new HttpsError('permission-denied', '해당 세션에 접근할 권한이 없습니다.');
      }
      
      // 해당 세션의 대화 기록들 가져오기
      const conversationsSnapshot = await db.collection('conversations')
        .where('sessionId', '==', sessionId)
        .orderBy('timestamp', 'asc')
        .get();
      
      const conversations = [];
      conversationsSnapshot.forEach(doc => {
        const conversationData = doc.data();
        conversations.push({
          userMessage: conversationData.userMessage,
          aiResponse: conversationData.aiResponse,
          responseType: conversationData.responseType,
          timestamp: conversationData.timestamp
        });
      });
      
      if (conversations.length === 0) {
        throw new HttpsError('invalid-argument', '분석할 대화가 없습니다.');
      }
      
      // 대화 내용을 분석용 텍스트로 변환
      const conversationText = conversations.map((conv, index) => {
        const timestamp = conv.timestamp ? conv.timestamp.toDate().toLocaleString('ko-KR') : '시간 정보 없음';
        return `[${index + 1}번째 대화 - ${timestamp} - ${conv.responseType || 'DEFAULT'}]\n학생: ${conv.userMessage}\nAI 튜터: ${conv.aiResponse}\n`;
      }).join('\n');
      
      // 영재성 평가를 위한 성장 추적 중심 분석 프롬프트
      const giftedAnalysisPrompt = `학생의 그래비트랙스 실험 AI 튜터 대화를 분석하여 성장 가능성과 발달 단계를 평가해주세요.

학생 정보:
- 학생 이름: ${sessionData.studentName}
- 총 대화 횟수: ${conversations.length}회
- 주요 응답 유형: ${sessionData.responseTypes ? sessionData.responseTypes.join(', ') : '분류되지 않음'}

대화 분석 대상:
${conversationText}

성장 분석 틀:

1. 현재 발달 단계 (Bloom의 교육목표 분류학 기반)
- 기억 단계: 기본 개념과 사실 기억
- 이해 단계: 개념의 의미 파악
- 적용 단계: 학습한 내용을 새로운 상황에 적용
- 분석 단계: 복잡한 개념을 요소별로 분해
- 종합 단계: 여러 요소를 결합하여 새로운 아이디어 창출
- 평가 단계: 기준에 따라 판단하고 평가

현재 주요 단계와 도달한 최고 단계를 분석해주세요.

2. 과학적 사고 발달 지표
구체적 조작기에서 형식적 조작기로의 전환 분석:
- 구체적 경험 의존도: 5점 만점으로 평가 (구체적 경험에 얼마나 의존하는가)
- 추상적 사고 능력: 5점 만점으로 평가 (개념과 원리를 추상적으로 사고하는 능력)
- 가설-연역적 추론: 5점 만점으로 평가 (가설을 세우고 논리적으로 추론하는 능력)

3. 성장 예측 및 잠재력
- 단기 성장 가능 영역 (1-2개월): 구체적으로 어떤 영역에서 성장이 기대되는가
- 중기 성장 목표 (학기 단위): 학기 말까지 도달 가능한 수준
- 장기 발달 방향 (학년 단위): 향후 1년간의 발달 전망

4. 영재성 지표 분석
- 창의적 사고: 독창적이고 유연한 문제해결 접근을 보이는가
- 논리적 추론: 체계적이고 논리적인 사고 과정을 보이는가
- 호기심과 탐구심: 지속적이고 깊이 있는 질문을 하는가
- 자기주도성: 스스로 문제를 발견하고 해결하려는 의지가 있는가
- 메타인지: 자신의 사고 과정을 인식하고 조절하는가

5. 맞춤형 성장 지원 전략
- 현재 수준에 맞는 도전 과제: 구체적인 활동 제안
- 다음 단계 발달을 위한 비계 설정: 교사가 제공해야 할 지원
- 동기 부여 방안: 학생의 흥미와 관심을 유지하는 방법
- 영재교육 연계 제안: 필요시 영재교육 프로그램 참여 권장 여부

각 항목을 구체적인 대화 예시를 들어 분석하고, 교사가 실제 교육에 활용할 수 있는 실용적인 제안을 포함해주세요.

매우 중요한 응답 형식 지침:
- 절대로 마크다운 문법을 사용하지 마세요 (*, **, #, ##, ###, [], (), \` 등 금지)
- 제목이나 강조가 필요한 경우 단순히 대문자나 줄바꿈으로 구분하세요
- 목록은 숫자나 하이픈(-)으로 시작하되, 별표(*)는 절대 사용하지 마세요
- 모든 응답은 순수한 일반 텍스트로만 구성해주세요`;
      
      // Gemini API 호출하여 분석 생성
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: giftedAnalysisPrompt }] }],
        generationConfig: {
          "temperature": 0.2,
          "topP": 0.8,
          "maxOutputTokens": 2000
        }
      });
      
      const response = await result.response;
      const analysisText = response.text();
      
      // 분석 결과를 데이터베이스에 저장
      const analysisData = {
        sessionId: sessionId,
        studentName: sessionData.studentName,
        teacherCode: teacherCode,
        analysisType: 'gifted_assessment',
        analysisText: analysisText,
        conversationCount: conversations.length,
        responseTypes: sessionData.responseTypes || [],
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        generatedBy: userId,
        modelUsed: modelName
      };
      
      const analysisRef = await db.collection('conversation_analyses').add(analysisData);
      
      return {
        analysisId: analysisRef.id,
        analysis: analysisText,
        sessionInfo: {
          sessionId: sessionId,
          studentName: sessionData.studentName,
          conversationCount: conversations.length,
          responseTypes: sessionData.responseTypes || []
        }
      };
      
    } catch (error) {
      console.error("학생 대화 분석 오류:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', '학생 대화 분석 중 오류가 발생했습니다.');
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
