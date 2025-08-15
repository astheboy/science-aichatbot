const fs = require('fs');
const path = require('path');
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");
const { GoogleGenerativeAI } = require("@google/generative-ai");

// 글로벌 설정
setGlobalOptions({ region: "asia-northeast3" });

admin.initializeApp();
const db = admin.firestore();

// 과목별 프롬프트 데이터 캐시
let subjectPrompts = {};

// 과목별 프롬프트 JSON 로드 함수
function loadSubjectPrompts(subject) {
    if (subjectPrompts[subject]) {
        return subjectPrompts[subject];
    }
    
    try {
        const filePath = path.join(__dirname, 'prompts', `${subject}_prompts.json`);
        const data = fs.readFileSync(filePath, 'utf8');
        subjectPrompts[subject] = JSON.parse(data);
        return subjectPrompts[subject];
    } catch (error) {
        console.error(`과목 '${subject}' 프롬프트 파일 로드 실패:`, error);
        // 기본값으로 과학 프롬프트 반환
        return getDefaultSciencePrompts();
    }
}

// 기본 과학 프롬프트 (현재 시스템과 호환성 유지)
function getDefaultSciencePrompts() {
    return {
        "subject": "science",
        "name": "과학",
        "responsePatterns": {
            "CONCEPT_QUESTION": [
                "/(무엇|뭐|뭘).*[이에]?요?\\?*$/", 
                "/왜.*[이에]?요?\\?*$/", 
                "/.*[이란|이게|란] 뭐/", 
                "/(알려|설명).*주[세시]/", 
                "/(에너지|위치에너지|운동에너지|힘|속도).*[이가] 뭐/"
            ],
            "EXPLORATION_DEADLOCK": [
                "/어떻게.*해야.*모르겠/", 
                "/뭘.*바꿔야/", 
                "/안.*되나.*봐/", 
                "/막막/", 
                "/포기/", 
                "/못.*하겠/", 
                "/안.*돼/"
            ],
            "FAILURE_REPORT": [
                "/구슬이.*떨어짐/", 
                "/점프.*못/", 
                "/지나가/", 
                "/닿지.*않/", 
                "/멈췄/", 
                "/실패/", 
                "/안.*움직임/"
            ],
            "SUCCESS_WITHOUT_PRINCIPLE": [
                "/성공/", 
                "/됐다/", 
                "/되네/", 
                "/건너갔/", 
                "/(높게|높이).*만드니까.*됐/", 
                "/드디어.*됐/"
            ],
            "HYPOTHESIS_INQUIRY": [
                "/만약.*하면/", 
                "/.*해서.*그런가/", 
                "/.*[면서].*될까/", 
                "/경사를.*하면/", 
                "/높이를.*하면/", 
                "/무거우면.*더/"
            ]
        },
        "prompts": {
            // 현재 시스템의 기본 프롬프트들...
        },
        "learningContext": {
            "defaultPhase": "전개 (활동3 - 인지적 갈등 유발 미션)",
            "defaultMission": "낮은 출발점에서 시작하여 끊어진 레일(2칸 너비)을 점프해서 건너기"
        }
    };
}

// 범용 학생 응답 분석 함수
function analyzeStudentResponse(userMessage, subjectData) {
    const message = userMessage.toLowerCase().trim();
    const patterns = subjectData.responsePatterns;
    
    // 각 응답 유형별로 패턴 매칭
    for (const [responseType, regexList] of Object.entries(patterns)) {
        for (const regexStr of regexList) {
            try {
                // JSON의 문자열을 실제 정규식으로 변환
                const regex = new RegExp(regexStr.replace(/^\/|\/$/g, ''));
                if (regex.test(message)) {
                    return responseType;
                }
            } catch (error) {
                console.error(`정규식 파싱 오류: ${regexStr}`, error);
                continue;
            }
        }
    }
    
    return 'DEFAULT';
}

// 응답 유형별 프롬프트 가져오기 (범용)
function getPromptByResponseType(responseType, customPrompts, subjectData) {
    // 1순위: 교사의 커스텀 프롬프트
    if (customPrompts && customPrompts[responseType]) {
        return customPrompts[responseType];
    }
    
    // 2순위: 과목별 기본 프롬프트
    if (subjectData.prompts && subjectData.prompts[responseType]) {
        return subjectData.prompts[responseType];
    }
    
    // 3순위: 과목별 DEFAULT 프롬프트
    return subjectData.prompts.DEFAULT || "친근하고 격려하는 튜터로서 학생을 도와주세요.";
}

// 범용 프롬프트 생성 함수
function buildFullPrompt(customPrompt, userMessage, conversationHistory = [], teacherData) {
    const subjectData = loadSubjectPrompts(teacherData.subject || 'science');
    const learningContext = teacherData.learningContext || subjectData.learningContext;
    
    let systemInstruction = `${customPrompt}\n\n### 너의 핵심 규칙 ###\n`;
    
    // 과목별 규칙 추가
    if (subjectData.subjectRules) {
        subjectData.subjectRules.forEach((rule, index) => {
            systemInstruction += `${index + 1}. ${rule}\n`;
        });
    }
    
    // 공통 규칙 추가
    systemInstruction += `${subjectData.subjectRules ? subjectData.subjectRules.length + 1 : 1}. 친절하고 격려하는 동료 탐험가 같은 말투를 사용하라. 한국어로만 대답해야 한다.
${subjectData.subjectRules ? subjectData.subjectRules.length + 2 : 2}. **중요**: 답변에 마크다운 문법(*, **, #, ## 등)을 사용하지 말고 순수한 텍스트로만 작성해라.`;

    const recentHistory = conversationHistory.slice(-6);
    const contents = [];

    // 시스템 지시사항과 첫 사용자 메시지 결합
    if (recentHistory.length === 0) {
        contents.push({ 
            role: 'user', 
            parts: [{ 
                text: `${systemInstruction}

### 현재 학습 맥락 ###
- 과목: ${subjectData.name}
- 수업 단계: ${learningContext.defaultPhase}
- 현재 미션: ${learningContext.defaultMission}

### 학생의 현재 발화 ###
${userMessage}` 
            }] 
        });
    } else {
        // 대화 이력이 있는 경우 처리...
        recentHistory.forEach((turn, index) => {
            if (index === 0) {
                const userTextWithSystemPrompt = `${systemInstruction}

### 현재 학습 맥락 ###
- 과목: ${subjectData.name}
- 수업 단계: ${learningContext.defaultPhase}
- 현재 미션: ${learningContext.defaultMission}

### 학생의 현재 발화 ###
${turn.parts[0].text}`;
                contents.push({ role: 'user', parts: [{ text: userTextWithSystemPrompt }] });
            } else {
                contents.push(turn);
            }
        });
        
        contents.push({ role: 'user', parts: [{ text: userMessage }] });
    }

    return contents;
}

// 향상된 getTutorResponse 함수
exports.getTutorResponse = onCall(async (request) => {
    const { data } = request;
    const { teacherCode, userMessage, conversationHistory, studentName, sessionId } = data;

    if (!teacherCode || !userMessage) {
        throw new HttpsError('invalid-argument', '교사 코드와 사용자 메시지가 필요합니다.');
    }

    try {
        // 1. 교사 데이터 가져오기
        const teacherDoc = await db.collection('teacher_keys').doc(teacherCode).get();
        if (!teacherDoc.exists) {
            throw new HttpsError('not-found', '유효하지 않은 교사 코드입니다.');
        }

        const teacherData = teacherDoc.data();
        const apiKey = teacherData.apiKey;
        if (!apiKey) {
            throw new HttpsError('internal', '해당 교사의 API 키가 등록되지 않았습니다.');
        }

        // 2. 과목별 프롬프트 데이터 로드
        const subjectData = loadSubjectPrompts(teacherData.subject || 'science');
        
        // 3. 학생 응답 유형 분석 (과목별 패턴 사용)
        const responseType = analyzeStudentResponse(userMessage, subjectData);
        console.log(`[${subjectData.name}] 학생 응답 유형: ${responseType}`);
        
        // 4. 적응형 프롬프트 선택
        const customPrompts = teacherData.customPrompts || {};
        const adaptivePrompt = getPromptByResponseType(responseType, customPrompts, subjectData);
        
        // 5. AI 모델 호출
        const modelName = teacherData.modelName || 'gemini-2.0-flash-exp';
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: modelName });
        
        // 6. 범용 프롬프트 생성
        const fullPrompt = buildFullPrompt(adaptivePrompt, userMessage, conversationHistory, teacherData);
        
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
        
        // 7. 대화 기록 저장 (기존과 동일)
        if (studentName && sessionId) {
            try {
                await db.collection('conversations').add({
                    teacherCode,
                    studentName,
                    sessionId,
                    userMessage,
                    aiResponse: aiResponseText,
                    responseType,
                    subject: teacherData.subject || 'science',
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    conversationLength: (conversationHistory ? conversationHistory.length : 0) + 1
                });
                
                await db.collection('sessions').doc(sessionId).set({
                    teacherCode,
                    studentName,
                    sessionId,
                    subject: teacherData.subject || 'science',
                    lastActivity: admin.firestore.FieldValue.serverTimestamp(),
                    messageCount: admin.firestore.FieldValue.increment(1),
                    responseTypes: admin.firestore.FieldValue.arrayUnion(responseType)
                }, { merge: true });
                
            } catch (logError) {
                console.error('대화 기록 저장 실패:', logError);
            }
        }
        
        return { text: aiResponseText };

    } catch (error) {
        console.error("오류 발생:", error);
        if (error instanceof HttpsError) {
            throw error;
        }
        throw new HttpsError('internal', '서버 내부 오류가 발생했습니다.');
    }
});

// 과목 목록 및 템플릿 제공 함수
exports.getSubjectTemplates = onCall(async (request) => {
    const { data } = request;
    const { subject } = data;
    
    try {
        if (subject) {
            // 특정 과목의 템플릿 반환
            const subjectData = loadSubjectPrompts(subject);
            return { 
                success: true, 
                subject: subject,
                template: subjectData 
            };
        } else {
            // 사용 가능한 모든 과목 목록 반환
            const availableSubjects = ['science', 'math', 'art']; // 실제로는 prompts 폴더를 스캔
            return { 
                success: true, 
                subjects: availableSubjects 
            };
        }
    } catch (error) {
        console.error("템플릿 조회 오류:", error);
        throw new HttpsError('internal', '템플릿 조회 중 오류가 발생했습니다.');
    }
});

// 교사 설정 업데이트 (과목 정보 포함)
exports.updateTeacherSettings = onCall(async (request) => {
    const { data, auth } = request;
    const { subject, learningContext, customPrompts } = data;
    
    if (!auth) {
        throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    
    try {
        const userId = auth.uid;
        
        // userId로 교사 문서 찾기
        const querySnapshot = await db.collection('teacher_keys')
            .where('userId', '==', userId)
            .limit(1)
            .get();

        if (querySnapshot.empty) {
            throw new HttpsError('not-found', '등록된 교사가 아닙니다.');
        }

        const teacherDoc = querySnapshot.docs[0];
        const updateData = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        if (subject) updateData.subject = subject;
        if (learningContext) updateData.learningContext = learningContext;
        if (customPrompts) updateData.customPrompts = customPrompts;
        
        await teacherDoc.ref.update(updateData);
        
        return { success: true };
    } catch (error) {
        console.error("교사 설정 업데이트 오류:", error);
        throw new HttpsError('internal', '설정 업데이트 중 오류가 발생했습니다.');
    }
});
