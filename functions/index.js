const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 새로운 JSON 기반 시스템 모듈
const SubjectLoader = require('./lib/subjectLoader');
const ResponseAnalyzer = require('./lib/responseAnalyzer');
const PromptBuilder = require('./lib/promptBuilder');
const gamificationModule = require('./lib/gamificationManager');

// 글로벌 설정
setGlobalOptions({ region: "asia-northeast3" });

admin.initializeApp();
const db = admin.firestore();

// GamificationManager 초기화
gamificationModule.initialize(admin);
const GamificationManager = gamificationModule.GamificationManager;

// 애플리케이션 시작 시 모든 과목 설정 미리 로드
SubjectLoader.preloadAllConfigs().catch(console.error);

// JSON 기반 학생 응답 분석 함수 (호환성 유지를 위한 래퍼)
async function analyzeStudentResponse(userMessage, subject = 'science', conversationHistory = []) {
    try {
        const analysisResult = await ResponseAnalyzer.analyzeStudentResponse(userMessage, subject, conversationHistory);
        return analysisResult.type; // 기존 함수와의 호환성을 위해 타입만 반환
    } catch (error) {
        console.error('응답 분석 오류:', error);
        return 'DEFAULT';
    }
}

// 응답 유형별 프롬프트 가져오기 (호환성 유지를 위한 래퍼)
async function getPromptByResponseType(responseType, customPrompts, subject = 'science') {
    try {
        // 커스텀 프롬프트가 있으면 우선 사용
        if (customPrompts && customPrompts[responseType]) {
            return customPrompts[responseType];
        }
        
        // JSON 설정에서 프롬프트 가져오기
        const responseTypeConfig = await SubjectLoader.getResponseTypeConfig(subject, responseType);
        
        if (responseTypeConfig.sample_prompts && responseTypeConfig.sample_prompts.length > 0) {
            return responseTypeConfig.sample_prompts[0]; // 첫 번째 샘플 프롬프트 사용
        }
        
        // 폴백: 기본 전략 사용
        return responseTypeConfig.prompt_strategy || '학생과 친근하고 교육적인 대화를 나누어 주세요.';
        
    } catch (error) {
        console.error('프롬프트 선택 오류:', error);
        // 오류 시 기본 프롬프트 반환
        return "너는 친근하고 격려하는 교육 튜터야. 학생들이 학습을 통해 스스로 답을 찾을 수 있도록 도와줘.";
    }
}

// 기본 프롬프트 함수 (호환성 유지)
function getDefaultPrompt() {
    return getPromptByResponseType('DEFAULT', null);
}

// 전체 프롬프트 생성 함수 (JSON 시스템 사용 + 학습 자료 추가)
async function buildFullPrompt(analysisResult, userMessage, conversationHistory = [], teacherData = {}, lessonDescription = null, lessonResources = null) {
    try {
        // 새로운 JSON 기반 프롬프트 생성 시스템 사용 (수업 설명 및 학습 자료 포함)
        return await PromptBuilder.buildFullPrompt(analysisResult, userMessage, conversationHistory, teacherData, lessonDescription, lessonResources);
    } catch (error) {
        console.error('프롬프트 생성 오류:', error);
        
        // 오류 시 폴백 프롬프트 사용
        const fallbackInstruction = `너는 친근하고 격려하는 교육 튜터야. 학생들이 학습을 통해 스스로 답을 찾을 수 있도록 도와줘. 
항상 긍정적이고 호기심을 유발하는 질문을 던져주고, 직접적인 답을 주기보다는 스스로 생각해볼 수 있도록 힌트를 제공해줘.
한국어로만 대답하고, 마크다운 문법을 사용하지 말아줘.`;
        
        return [{
            role: 'user',
            parts: [{
                text: `${fallbackInstruction}\n\n### 학생의 발화 ###\n${userMessage}`
            }]
        }];
    }
}

exports.getTutorResponse = onCall(async (request) => {
    const { data } = request;
    
    // 클라이언트로부터 lessonCode, userMessage, conversationHistory, 그리고 학생 정보를 받습니다.
    const { lessonCode, userMessage, conversationHistory, studentName, sessionId } = data;

    if (!lessonCode) {
      throw new HttpsError('invalid-argument', '수업 코드가 필요합니다.');
    }

    if (!userMessage) {
      throw new HttpsError('invalid-argument', '사용자 메시지가 필요합니다.');
    }

    try {
      // 1. lessonCode를 사용해 Firestore에서 해당 수업의 문서를 찾습니다.
      const lessonSnapshot = await db.collection('lessons').where('lessonCode', '==', lessonCode).get();

      if (lessonSnapshot.empty) {
        throw new HttpsError('not-found', '유효하지 않은 수업 코드입니다.');
      }

      const lessonDoc = lessonSnapshot.docs[0];
      const lessonData = lessonDoc.data();
      
      // 수업이 활성화되어 있는지 확인
      if (!lessonData.isActive) {
        throw new HttpsError('permission-denied', '비활성화된 수업입니다.');
      }
      
      // 2. 수업의 teacherCode를 사용해 교사 정보를 찾습니다.
      const teacherDoc = await db.collection('teacher_keys').doc(lessonData.teacherCode).get();

      if (!teacherDoc.exists) {
        throw new HttpsError('not-found', '교사 정보를 찾을 수 없습니다.');
      }

      const teacherData = teacherDoc.data();
      const apiKey = teacherData.apiKey;

      if (!apiKey) {
        throw new HttpsError('internal', '해당 교사의 API 키가 등록되지 않았습니다.');
      }

      // 3. JSON 기반 학생 응답 분석 시스템 사용 (수업의 과목 사용)
      const subject = lessonData.subject || teacherData.subject || 'science';
      const analysisResult = await ResponseAnalyzer.analyzeStudentResponse(userMessage, subject, conversationHistory);
      const responseType = analysisResult.type;
      console.log(`응답 분석 결과 (${subject}): ${responseType} (신뢰도: ${analysisResult.confidence})`);
      
      // 4. 교사 설정과 모델 정보 가져오기
      const modelName = teacherData.modelName || 'gemini-2.0-flash';
      
      // 5. JSON 기반 프롬프트 생성 시스템 사용 (과목 정보 + 수업 설명 추가)
      const teacherDataWithSubject = {
        ...teacherData,
        subject: subject,  // 수업의 과목 정보 추가
        topic: lessonData.title  // 수업 제목 추가
      };
      
      // 수업 설명과 학습 자료를 추출
      const lessonDescription = lessonData.description || null;
      const lessonResources = lessonData.resources || null;
      
      // 학습 자료가 있으면 로그 출력
      if (lessonResources && lessonResources.length > 0) {
        console.log(`수업 '${lessonData.title}'의 학습 자료 ${lessonResources.length}개를 프롬프트에 포함합니다.`);
      }
      
      const fullPrompt = await buildFullPrompt(analysisResult, userMessage, conversationHistory, teacherDataWithSubject, lessonDescription, lessonResources);
      
      // 6. Gemini API 호출
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });
      
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
      
      // 7. 게임화 시스템 처리는 세션 업데이트 후에 수행
      let gamificationResult = null;
      let achievements = [];
      
      // 8. 대화 기록 저장 (학생 이름과 세션 ID가 있는 경우에만)
      if (studentName && sessionId) {
        try {
          const conversationData = {
            lessonCode: lessonCode,
            lessonId: lessonDoc.id,
            lessonTitle: lessonData.title,
            teacherCode: lessonData.teacherCode,
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
          const sessionData = {
            lessonCode: lessonCode,
            lessonId: lessonDoc.id,
            lessonTitle: lessonData.title,
            teacherCode: lessonData.teacherCode,
            studentName: studentName,
            sessionId: sessionId,
            lastActivity: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            messageCount: admin.firestore.FieldValue.increment(1),
            responseTypes: admin.firestore.FieldValue.arrayUnion(responseType)
          };
          
          // 세션이 새로 생성되는 경우 초기화
          try {
            const existingSession = await sessionRef.get();
            console.log(`세션 상태 확인: ${sessionId}, 존재여부: ${existingSession.exists}`);
            
            if (!existingSession.exists) {
              console.log(`새 세션 초기화: ${sessionId}, 학생이름: ${studentName}`);
              // 게임화 시스템 초기화
              const sessionInitResult = await GamificationManager.initializeSession(sessionId, studentName, {
                lessonCode: lessonCode,
                lessonId: lessonDoc.id,
                lessonTitle: lessonData.title || '',
                subject: subject,
                teacherCode: lessonData.teacherCode
              });
              console.log(`세션 초기화 결과:`, sessionInitResult);
            } else {
              // 기존 세션 업데이트
              await sessionRef.set(sessionData, { merge: true });
              console.log(`기존 세션 업데이트 완료: ${sessionId}`);
            }
            
            // 세션 초기화/업데이트 후 게임화 처리
            console.log(`게임화 처리 시작: ${sessionId}, 응답유형: ${responseType}`);
            try {
              gamificationResult = await GamificationManager.processExperience(sessionId, responseType, subject);
              console.log(`경험치 처리 결과:`, gamificationResult);
              
              achievements = await GamificationManager.checkAchievements(sessionId, responseType, subject);
              console.log(`성취 처리 결과:`, achievements);
            } catch (gamificationError) {
              console.error(`게임화 처리 오류:`, gamificationError);
            }
          } catch (sessionError) {
            console.error(`세션 초기화 오류:`, sessionError);
            // 세션 오류가 있어도 기본 대화기능은 유지
          }
          
        } catch (logError) {
          console.error('대화 기록 저장 실패:', logError);
          // 로그 저장 실패는 사용자 경험에 영향을 주지 않음
        }
      }
      
      // 응답에 게임화 정보 포함
      const responseData = { 
        text: aiResponseText,
        responseType: responseType
      };
      
      if (gamificationResult) {
        responseData.gamification = gamificationResult;
      }
      
      if (achievements && achievements.length > 0) {
        responseData.achievements = achievements;
      }
      
      return responseData;

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
        modelName: teacherData.modelName || 'gemini-2.0-flash'
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
        
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash',
        'gemini-2.0-flash-lite'
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

// 교사 유형별 프롬프트 업데이트 (과목별 지원)
exports.updateTeacherPrompts = onCall(async (request) => {
    const { data, auth } = request;
    const { prompts, subject } = data;
    
    if (!auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    
    if (!prompts || typeof prompts !== 'object') {
      throw new HttpsError('invalid-argument', '프롬프트 데이터가 필요합니다.');
    }
    
    if (!subject) {
      throw new HttpsError('invalid-argument', '과목 정보가 필요합니다.');
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
      const teacherData = teacherDoc.data();
      
      // 기존 과목별 프롬프트 데이터 가져오기
      const existingCustomPrompts = teacherData.customPrompts || {};
      
      // 과목별로 프롬프트 저장 (기존 구조 유지하면서 과목별 확장)
      const updatedCustomPrompts = {
        ...existingCustomPrompts,
        [subject]: prompts  // 해당 과목의 프롬프트 업데이트
      };
      
      console.log(`교사 ${userId}의 ${subject} 과목 프롬프트 업데이트:`, prompts);
      
      await teacherDoc.ref.update({
        customPrompts: updatedCustomPrompts,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return { 
        success: true, 
        updatedSubject: subject,
        promptCount: Object.keys(prompts).length 
      };
    } catch (error) {
      console.error(`유형별 프롬프트 업데이트 오류 (${subject}):`, error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', '유형별 프롬프트 저장 중 오류가 발생했습니다.');
    }
});

// 과목별 응답 유형 정보 조회
exports.getSubjectResponseTypes = onCall(async (request) => {
    const { data, auth } = request;
    const { subject } = data;
    
    if (!auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    
    if (!subject) {
      throw new HttpsError('invalid-argument', '과목이 필요합니다.');
    }

    try {
      // 과목별 설정 로드
      const subjectConfig = await SubjectLoader.loadSubjectConfig(subject);
      const responseTypes = subjectConfig.response_types;
      
      // 응답 유형별 정보 구성
      const responseTypeInfo = {};
      const defaultPrompts = {};
      
      for (const [typeKey, typeConfig] of Object.entries(responseTypes)) {
        responseTypeInfo[typeKey] = {
          name: typeConfig.name,
          description: typeConfig.description,
          examples: typeConfig.sample_prompts || [],
          patterns: typeConfig.patterns || []
        };
        
        // 디버깅을 위한 로그
        console.log(`${subject} - ${typeKey}: patterns =`, typeConfig.patterns || []);
        
        // 기본 프롬프트 (ai_tutor_prompt 사용, 없으면 sample_prompts 첫 번째, 그것도 없으면 기본값)
        if (typeConfig.ai_tutor_prompt) {
          defaultPrompts[typeKey] = typeConfig.ai_tutor_prompt;
        } else if (typeConfig.sample_prompts && typeConfig.sample_prompts.length > 0) {
          defaultPrompts[typeKey] = typeConfig.sample_prompts[0];
        } else {
          defaultPrompts[typeKey] = '학생과 친근하고 교육적인 대화를 나누어 주세요.';
        }
      }
      
      return {
        subject: subject,
        subjectName: subjectConfig.subject_name,
        responseTypes: responseTypeInfo,
        defaultPrompts: defaultPrompts
      };
      
    } catch (error) {
      console.error(`과목별 응답 유형 조회 오류 (${subject}):`, error);
      throw new HttpsError('internal', `${subject} 과목의 응답 유형 조회 중 오류가 발생했습니다.`);
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
      
      // 기본 프롬프트들은 각 과목별로 동적으로 로드되므로 빈 객체로 초기화
      // 실제 기본 프롬프트는 getSubjectResponseTypes에서 과목별로 제공됨
      const defaultPrompts = {};
      
      return {
        hasApiKey: !!teacherData.apiKey,
        teacherCode: teacherData.teacherCode,
        modelName: teacherData.modelName || 'gemini-2.0-flash',
        customPrompts: teacherData.customPrompts || {},
        defaultPrompts: defaultPrompts,
        supportedSubjects: SubjectLoader.getSupportedSubjects(),
        availableModels: [
          
          'gemini-2.5-flash-lite',
          'gemini-2.0-flash',
          'gemini-2.0-flash-lite'
        ]
      };
      
    } catch (error) {
      console.error("교사 설정 조회 오류:", error);
      throw new HttpsError('internal', '교사 설정 조회 중 오류가 발생했습니다.');
    }
});

// 교사별 학생 대화 세션 목록 조회 (수업별 필터링 지원)
exports.getStudentSessions = onCall(async (request) => {
    const { data, auth } = request;
    const { lessonId } = data || {}; // 선택적 매개변수
    
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
      
      // 세션 쿼리 생성 (수업별 필터링 지원)
      let sessionsQuery = db.collection('sessions')
        .where('teacherCode', '==', teacherCode);
      
      // lessonId가 제공된 경우 해당 수업의 학생들만 필터링
      if (lessonId) {
        console.log('수업별 세션 필터링 적용:', lessonId);
        sessionsQuery = sessionsQuery.where('lessonId', '==', lessonId);
      }
      
      const sessionsSnapshot = await sessionsQuery
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
          createdAt: sessionData.createdAt,
          updatedAt: sessionData.updatedAt,
          timestamp: sessionData.lastActivity || sessionData.updatedAt || sessionData.createdAt,
          responseTypes: sessionData.responseTypes || [],
          lessonId: sessionData.lessonId,
          lessonTitle: sessionData.lessonTitle,
          lessonCode: sessionData.lessonCode
        });
      });
      
      console.log(`세션 조회 완료: 총 ${sessions.length}개 세션 반환 (lessonId: ${lessonId || '전체'})`);
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
      const analysisPrompt = `당신은 교육 전문가입니다. 다음은 한 학생이 AI 튜터와 나눈 대화 기록입니다.

학생 이름: ${session.studentName}
총 대화 횟수: ${conversations.length}회
주요 응답 유형: ${session.responseTypes.join(', ')}

=== 대화 기록 ===
${conversationText}

=== 분석 요청 ===
위 대화를 바탕으로 다음 관점에서 학생의 사고 발전 과정을 분석해주세요:

1. **학습 진행 단계**: 학생이 어떤 단계를 거쳐 학습했는가?
2. **사고 유형 변화**: 질문 유형이 어떻게 발전했는가?
3. **탐구 능력**: 가설 설정, 실험 설계, 결과 해석 능력 등 수업 및 학습 주제에 대해 탐구하는 과정은?
4. **개념 이해도**: 위치에너지, 운동에너지 등 학습의 주요 개념을 얼마나 이해했는가?
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

// 사고 과정 평가를 위한 학생 대화 분석
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
      const modelName = teacherData.modelName || 'gemini-2.0-flash';
      
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
      const giftedAnalysisPrompt = `학생의 AI 튜터 대화를 분석하여 성장 가능성과 발달 단계를 평가해주세요.

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

2. 사고 발달 지표
구체적 조작기에서 형식적 조작기로의 전환 분석:
- 구체적 경험 의존도: 5점 만점으로 평가 (구체적 경험에 얼마나 의존하는가)
- 추상적 사고 능력: 5점 만점으로 평가 (개념과 원리를 추상적으로 사고하는 능력)
- 가설-연역적 추론: 5점 만점으로 평가 (가설을 세우고 논리적으로 추론하는 능력)

3. 성장 예측 및 잠재력
- 단기 성장 가능 영역 (1-2개월): 구체적으로 어떤 영역에서 성장이 기대되는가
- 중기 성장 목표 (학기 단위): 학기 말까지 도달 가능한 수준
- 장기 발달 방향 (학년 단위): 향후 1년간의 발달 전망

4. 사고 과정 분석
- 창의적 사고: 독창적이고 유연한 문제해결 접근을 보이는가
- 논리적 추론: 체계적이고 논리적인 사고 과정을 보이는가
- 호기심과 탐구심: 지속적이고 깊이 있는 질문을 하는가
- 자기주도성: 스스로 문제를 발견하고 해결하려는 의지가 있는가
- 메타인지: 자신의 사고 과정을 인식하고 조절하는가

5. 맞춤형 성장 지원 전략
- 현재 수준에 맞는 도전 과제: 구체적인 활동 제안
- 다음 단계 발달을 위한 비계 설정: 교사가 제공해야 할 지원
- 동기 부여 방안: 학생의 흥미와 관심을 유지하는 방법

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

// 수업 생성
exports.createLesson = onCall(async (request) => {
    const { data, auth } = request;
    const { title, subject, description, resources } = data;
    
    if (!auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    
    if (!title || !subject) {
      throw new HttpsError('invalid-argument', '수업 제목과 과목이 필요합니다.');
    }

    // 지원되는 과목 목록
    const validSubjects = ['korean', 'math', 'social', 'science'];
    if (!validSubjects.includes(subject)) {
        throw new HttpsError('invalid-argument', '지원되지 않는 과목입니다.');
    }

    try {
      const userId = auth.uid;
      const userEmail = auth.token.email;
      
      // 교사 정보 가져오기
      const querySnapshot = await db.collection('teacher_keys')
        .where('userId', '==', userId)
        .limit(1)
        .get();
        
      if (querySnapshot.empty) {
        throw new HttpsError('not-found', '교사 정보를 찾을 수 없습니다.');
      }
      
      const teacherDoc = querySnapshot.docs[0];
      const teacherData = teacherDoc.data();
      
      // 수업 코드 생성 (고유한 6자리 코드)
      const generateLessonCode = () => {
        const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 혼동하기 쉬운 문자 제외
        let result = '';
        for (let i = 0; i < 6; i++) {
          result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
      };
      
      let lessonCode;
      let isUnique = false;
      
      // 중복되지 않는 수업 코드 생성
      while (!isUnique) {
        lessonCode = generateLessonCode();
        const existingLesson = await db.collection('lessons').where('lessonCode', '==', lessonCode).get();
        if (existingLesson.empty) {
          isUnique = true;
        }
      }
      
      // 수업 데이터 생성
      const lessonData = {
        title: title,
        subject: subject,
        description: description || null,
        resources: resources || [], // 학습 자료 추가
        lessonCode: lessonCode,
        teacherId: userId,
        teacherEmail: userEmail,
        teacherCode: teacherData.teacherCode,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        isActive: true,
        studentCount: 0
      };
      
      // Firestore에 수업 저장
      const lessonRef = await db.collection('lessons').add(lessonData);
      
      return {
        success: true,
        lessonId: lessonRef.id,
        lessonCode: lessonCode,
        message: '수업이 성공적으로 생성되었습니다.'
      };
      
    } catch (error) {
      console.error("수업 생성 오류:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', '수업 생성 중 오류가 발생했습니다.');
    }
});

// 수업 수정
exports.updateLesson = onCall(async (request) => {
    const { data, auth } = request;
    const { lessonId, title, subject, description, resources } = data;
    
    if (!auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    
    if (!lessonId || !title || !subject) {
      throw new HttpsError('invalid-argument', '수업 ID, 제목, 과목이 필요합니다.');
    }

    // 지원되는 과목 목록
    const validSubjects = ['korean', 'math', 'social', 'science'];
    if (!validSubjects.includes(subject)) {
        throw new HttpsError('invalid-argument', '지원되지 않는 과목입니다.');
    }

    try {
      const userId = auth.uid;
      
      // 수업 존재 여부 및 권한 확인
      const lessonDoc = await db.collection('lessons').doc(lessonId).get();
      
      if (!lessonDoc.exists) {
        throw new HttpsError('not-found', '수업을 찾을 수 없습니다.');
      }
      
      const lessonData = lessonDoc.data();
      
      // 수업의 교사와 현재 사용자가 동일한지 확인
      if (lessonData.teacherId !== userId) {
        throw new HttpsError('permission-denied', '이 수업을 수정할 권한이 없습니다.');
      }
      
      // 수업 데이터 업데이트
      const updateData = {
        title: title,
        subject: subject,
        description: description || null,
        resources: resources || [], // 학습 자료 추가
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      await lessonDoc.ref.update(updateData);
      
      return {
        success: true,
        lessonId: lessonId,
        message: '수업이 성공적으로 수정되었습니다.'
      };
      
    } catch (error) {
      console.error("수업 수정 오류:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', '수업 수정 중 오류가 발생했습니다.');
    }
});

// 교사의 학생 세션 조회
exports.getLessons = onCall(async (request) => {
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
      
      // 인덱스 불필요하게 단순 쿼리로 변경 - teacherId만 필터링하고 클라이언트에서 정렬
      const lessonsSnapshot = await db.collection('lessons')
        .where('teacherId', '==', userId)
        .limit(100)
        .get();
      
      const lessons = [];
      
      // 각 수업별로 실시간 학생 수 계산
      for (const doc of lessonsSnapshot.docs) {
        const lessonData = doc.data();
        // 활성 수업만 필터링 (서버에서)
        if (lessonData.isActive === true) {
          
          // 해당 수업의 고유 학생 수를 실시간으로 계산
          const sessionQuery = await db.collection('sessions')
            .where('teacherCode', '==', teacherCode)
            .where('lessonId', '==', doc.id)
            .get();
          
          // 고유 학생 이름으로 중복 제거
          const uniqueStudents = new Set();
          sessionQuery.forEach(sessionDoc => {
            const sessionData = sessionDoc.data();
            if (sessionData.studentName) {
              uniqueStudents.add(sessionData.studentName);
            }
          });
          
          lessons.push({
            id: doc.id,
            title: lessonData.title,
            subject: lessonData.subject,
            description: lessonData.description,
            lessonCode: lessonData.lessonCode,
            createdAt: lessonData.createdAt,
            studentCount: uniqueStudents.size, // 실시간 계산된 학생 수
            isActive: lessonData.isActive
          });
        }
      }
      
      // 클라이언트에서 정렬하는 대신 서버에서 정렬
      lessons.sort((a, b) => {
        if (!a.createdAt && !b.createdAt) return 0;
        if (!a.createdAt) return 1;
        if (!b.createdAt) return -1;
        return b.createdAt.toMillis() - a.createdAt.toMillis();
      });
      
      console.log(`수업 목록 조회 완료: 총 ${lessons.length}개 수업`);
      
      // 최대 50개로 제한
      return { lessons: lessons.slice(0, 50) };
      
    } catch (error) {
      console.error("수업 목록 조회 오류:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', '수업 목록 조회 중 오류가 발생했습니다.');
    }
});

// 세션 삭제 함수
exports.deleteSession = onCall(async (request) => {
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
      
      // 교사 정보 찾기
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
      
      // 세션의 대화 기록들 삭제
      const conversationsSnapshot = await db.collection('conversations')
        .where('sessionId', '==', sessionId)
        .get();
      
      // 대화 기록 일괄 삭제
      const batch = db.batch();
      
      conversationsSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // 세션에 대한 분석 결과 삭제
      const analysesSnapshot = await db.collection('conversation_analyses')
        .where('sessionId', '==', sessionId)
        .get();
      
      analysesSnapshot.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      // 세션 자체 삭제
      batch.delete(sessionDoc.ref);
      
      // 일괄 삭제 실행
      await batch.commit();
      
      return {
        success: true,
        message: '세션과 관련 대화 기록이 성공적으로 삭제되었습니다.'
      };
      
    } catch (error) {
      console.error("세션 삭제 오류:", error);
      if (error instanceof HttpsError) {
        throw error;
      }
      throw new HttpsError('internal', '세션 삭제 중 오류가 발생했습니다.');
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
