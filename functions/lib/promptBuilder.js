const SubjectLoader = require('./subjectLoader');

/**
 * JSON 설정 기반 프롬프트 생성 시스템
 */
class PromptBuilder {
    
    /**
     * 분석 결과와 맥락을 기반으로 최종 프롬프트를 생성합니다
     * @param {Object} analysisResult - 응답 분석 결과
     * @param {string} userMessage - 사용자 메시지
     * @param {Array} conversationHistory - 대화 이력
     * @param {Object} teacherData - 교사 설정 데이터
     * @param {string|null} aiInstructions - AI 튜터 핵심 역할 지시사항 (교사가 작성한 지시사항)
     * @param {Array|null} lessonResources - 수업 학습 자료 (링크, 파일 등)
     * @returns {Array} Gemini API 호출용 프롬프트 배열
     */
    static async buildFullPrompt(analysisResult, userMessage, conversationHistory = [], teacherData = {}, aiInstructions = null, lessonResources = null) {
        try {
            // 과목별 설정 로드
            const subject = teacherData.subject || 'science';
            const subjectConfig = await SubjectLoader.loadSubjectConfig(subject);
            
            // 1. 기본 프롬프트 선택
            const basePrompt = await this.selectBestPrompt(analysisResult, teacherData, subjectConfig);
            
            // 2. 교육학적 맥락 구축
            const educationalContext = this.buildEducationalContext(analysisResult, subjectConfig, teacherData);
            
            // 3. 대화 맥락 구성
            const conversationContext = this.buildConversationContext(conversationHistory, subjectConfig);
            
            // 4. 과목별 특화 규칙 적용
            const subjectRules = this.buildSubjectRules(subjectConfig, teacherData);
            
            // 5. 최종 프롬프트 조합 (AI 지시사항 및 학습 자료 추가)
            const systemInstruction = this.combinePromptElements(
                basePrompt,
                educationalContext,
                subjectRules,
                conversationContext,
                teacherData,
                aiInstructions,
                lessonResources
            );
            
            // 6. Gemini API 형식으로 변환
            return this.formatForGeminiApi(systemInstruction, userMessage, conversationHistory);
            
        } catch (error) {
            console.error('프롬프트 생성 중 오류:', error);
            // 폴백: 기본 과학 프롬프트 사용
            return this.buildFallbackPrompt(userMessage, conversationHistory);
        }
    }
    
    /**
     * 분석 결과와 설정에 기반하여 최적의 프롬프트를 선택합니다
     * @param {Object} analysisResult - 응답 분석 결과
     * @param {Object} teacherData - 교사 설정
     * @param {Object} subjectConfig - 과목별 설정
     * @returns {string} 선택된 기본 프롬프트
     */
    static async selectBestPrompt(analysisResult, teacherData, subjectConfig) {
        const { type, config, context } = analysisResult;
        
        // 1. 교사의 커스텀 프롬프트 우선 확인
        if (teacherData.customPrompts && teacherData.customPrompts[type]) {
            console.log(`교사 커스텀 프롬프트 사용: ${type}`);
            return teacherData.customPrompts[type];
        }
        
        // 2. JSON의 ai_tutor_prompt 필드 우선 사용
        if (config.ai_tutor_prompt) {
            console.log(`과목별 AI 튜터 프롬프트 사용: ${type}`);
            return config.ai_tutor_prompt;
        }
        
        // 3. 폴백: sample_prompts에서 선택 (기존 호환성 유지)
        const samplePrompts = config.sample_prompts;
        if (!samplePrompts || samplePrompts.length === 0) {
            console.log(`sample_prompts가 없어서 기본 전략 사용: ${type}`);
            return config.prompt_strategy || '학생과 친근하고 교육적인 대화를 나누어 주세요.';
        }
        
        // 대화 맥락에 따른 프롬프트 선택 (sample_prompts 사용)
        let selectedPrompt;
        
        if (context.isFirstMessage) {
            // 첫 메시지: 가장 환영적이고 격려하는 프롬프트
            selectedPrompt = this.findPromptByKeywords(samplePrompts, ['환영', '함께', '시작']);
        } else if (context.learningProgression.stage === 'struggling') {
            // 어려움 단계: 격려와 지원 중심 프롬프트
            selectedPrompt = this.findPromptByKeywords(samplePrompts, ['격려', '천천히', '괜찮']);
        } else if (context.learningProgression.stage === 'analyzing') {
            // 분석 단계: 더 깊이 있는 탐구 유도 프롬프트
            selectedPrompt = this.findPromptByKeywords(samplePrompts, ['훌륭', '더', '발전']);
        } else {
            // 기본: 첫 번째 프롬프트 사용
            selectedPrompt = samplePrompts[0];
        }
        
        // 적절한 프롬프트가 없으면 첫 번째 사용
        if (!selectedPrompt) {
            selectedPrompt = samplePrompts[0];
        }
        
        console.log(`JSON sample_prompts에서 선택: ${type} - ${selectedPrompt.substring(0, 50)}...`);
        return selectedPrompt;
    }
    
    /**
     * 키워드를 포함한 프롬프트를 찾습니다
     * @param {Array} prompts - 프롬프트 배열
     * @param {Array} keywords - 검색할 키워드들
     * @returns {string|null} 찾은 프롬프트 또는 null
     */
    static findPromptByKeywords(prompts, keywords) {
        for (const keyword of keywords) {
            const found = prompts.find(prompt => prompt.includes(keyword));
            if (found) return found;
        }
        return null;
    }
    
    /**
     * 교육학적 맥락을 구축합니다
     * @param {Object} analysisResult - 분석 결과
     * @param {Object} subjectConfig - 과목별 설정
     * @param {Object} teacherData - 교사 설정
     * @returns {string} 교육학적 맥락 문자열
     */
    static buildEducationalContext(analysisResult, subjectConfig, teacherData) {
        const { config } = analysisResult;
        const foundation = subjectConfig.theoretical_foundation;
        
        let context = `\n### 교육학적 맥락 ###\n`;
        
        // 과목별 교육 원칙
        if (foundation.educational_principles) {
            context += `**교육 원칙:**\n`;
            foundation.educational_principles.forEach(principle => {
                context += `- ${principle}\n`;
            });
        }
        
        // 현재 응답 유형의 이론적 근거
        if (config.theoretical_basis) {
            context += `\n**이론적 근거:** ${config.theoretical_basis}\n`;
        }
        
        // 교수 전략
        if (config.prompt_strategy) {
            context += `**교수 전략:** ${config.prompt_strategy}\n`;
        }
        
        // 학습 목표 (교사 설정이 있는 경우)
        if (teacherData.learning_context && teacherData.learning_context.target_concepts) {
            context += `\n**현재 학습 목표:**\n`;
            teacherData.learning_context.target_concepts.forEach(concept => {
                context += `- ${concept}\n`;
            });
        }
        
        return context;
    }
    
    /**
     * 대화 맥락을 구성합니다
     * @param {Array} conversationHistory - 대화 이력
     * @param {Object} subjectConfig - 과목별 설정
     * @returns {string} 대화 맥락 문자열
     */
    static buildConversationContext(conversationHistory, subjectConfig) {
        const contextConfig = subjectConfig.conversation_context;
        const maxHistory = contextConfig.max_history || 6;
        
        let context = `\n### 대화 맥락 ###\n`;
        
        if (conversationHistory.length === 0) {
            context += `- 첫 번째 대화입니다\n`;
        } else {
            const recentHistory = conversationHistory.slice(-maxHistory);
            context += `- 대화 턴 수: ${conversationHistory.length + 1}\n`;
            
            // 최근 응답 유형 패턴
            const recentTypes = recentHistory
                .filter(turn => turn.responseType)
                .map(turn => turn.responseType)
                .slice(-3);
            
            if (recentTypes.length > 0) {
                context += `- 최근 응답 유형: ${recentTypes.join(' → ')}\n`;
            }
            
            // 대화 맥락 요소들 (JSON 설정에서)
            if (contextConfig.context_elements) {
                context += `- 고려할 맥락 요소: ${contextConfig.context_elements.join(', ')}\n`;
            }
        }
        
        return context;
    }
    
    /**
     * 과목별 특화 규칙을 구성합니다
     * @param {Object} subjectConfig - 과목별 설정
     * @param {Object} teacherData - 교사 설정
     * @returns {string} 과목별 규칙 문자열
     */
    static buildSubjectRules(subjectConfig, teacherData) {
        const subject = subjectConfig.subject;
        const subjectName = subjectConfig.subject_name;
        
        let rules = `\n### ${subjectName} 교과 특화 규칙 ###\n`;
        
        // 기본 과목별 규칙
        const subjectRules = {
            science: [
                '절대로 정답을 직접 알려주지 말고 탐구 질문을 던져라',
                '실패를 중요한 단서로 인정하고 격려해라',
                '관찰 → 가설 → 실험 → 결론의 과학적 사고 과정을 유도해라',
                '일상 경험과 과학 원리를 연결하는 질문을 해라'
            ],
            math: [
                '공식을 바로 알려주지 말고 패턴을 발견하도록 유도해라',
                '틀린 답에서 사고 과정을 분석하게 해라',
                '구체적 예시에서 추상적 개념으로 연결해라',
                '여러 해결 방법이 있음을 인식시켜라'
            ],
            korean: [
                '텍스트를 다양한 관점에서 해석하도록 격려해라',
                '학생의 개인적 경험과 연결시켜 이해를 돕아라',
                '표현의 다양성과 창의성을 인정해줘라',
                '맥락과 상황을 고려한 의미 파악을 유도해라'
            ],
            social: [
                '다양한 관점에서 사회 현상을 분석하게 해라',
                '과거와 현재를 연결하여 사고하도록 도와라',
                '비판적 사고와 가치 판단 능력을 기르게 해라',
                '사회 참여 의식을 자극하는 질문을 해라'
            ]
        };
        
        const currentSubjectRules = subjectRules[subject] || subjectRules.science;
        currentSubjectRules.forEach((rule, index) => {
            rules += `${index + 1}. ${rule}\n`;
        });
        
        // 도메인별 특화 기능 (JSON에서)
        if (subjectConfig.domain_specific_features) {
            const features = subjectConfig.domain_specific_features;
            
            if (features.thinking_skills) {
                rules += `\n**중점 사고 기능:** ${features.thinking_skills.join(', ')}\n`;
            }
            
            if (features.assessment_criteria) {
                rules += `**평가 중점:** ${Object.keys(features.assessment_criteria).join(', ')}\n`;
            }
        }
        
        return rules;
    }
    
    /**
     * 모든 프롬프트 요소를 조합합니다
     * @param {string} basePrompt - 기본 프롬프트
     * @param {string} educationalContext - 교육학적 맥락
     * @param {string} subjectRules - 과목별 규칙
     * @param {string} conversationContext - 대화 맥락
     * @param {Object} teacherData - 교사 설정
     * @param {string|null} aiInstructions - AI 튜터 핵심 역할 지시사항
     * @param {Array|null} lessonResources - 수업 학습 자료
     * @returns {string} 최종 시스템 지시사항
     */
    static combinePromptElements(basePrompt, educationalContext, subjectRules, conversationContext, teacherData, aiInstructions, lessonResources) {
        let systemInstruction = "";
        
        // 1. AI 지시사항 (핵심 지식 및 역할) 최우선 배치
        if (aiInstructions && aiInstructions.trim()) {
            systemInstruction += `### 🎯 수업 목표 및 AI 튜터 핵심 역할 ###\n`;
            systemInstruction += `${aiInstructions.trim()}\n\n`;
            systemInstruction += `위의 수업 목표와 맥락을 바탕으로 학생을 가르치는 전문 AI 튜터로서 활동하세요.\n\n`;
        }
        
        // 1-1. 학습 자료 정보 추가
        if (lessonResources && lessonResources.length > 0) {
            systemInstruction += `### 📚 참고 학습 자료 ###\n`;
            systemInstruction += `교사가 이 수업을 위해 준비한 참고 자료들이 있습니다:\n\n`;
            
            lessonResources.forEach((resource, index) => {
                const icon = resource.type === 'link' ? '🔗' : '📎';
                systemInstruction += `${index + 1}. ${icon} ${resource.title}\n`;
                if (resource.type === 'link') {
                    systemInstruction += `   - URL: ${resource.url}\n`;
                } else if (resource.type === 'file') {
                    systemInstruction += `   - 파일명: ${resource.fileName || resource.title}\n`;
                }
            });
            
            systemInstruction += `\n학생이 탐구 과정에서 막히거나 추가 학습이 필요할 때, 위 자료를 적절히 안내해주세요.\n`;
            systemInstruction += `단, 학생이 스스로 탐구할 기회를 먼저 주고, 2-3회 이상 어려움을 표현할 때 자료를 제안하세요.\n\n`;
        }
        
        // 2. 기존 프롬프트 요소들 추가
        systemInstruction += basePrompt;
        
        // 교육학적 맥락 추가
        systemInstruction += educationalContext;
        
        // 과목별 규칙 추가
        systemInstruction += subjectRules;
        
        // 대화 맥락 추가
        systemInstruction += conversationContext;
        
        // 학습 환경 정보 (교사 설정에서)
        if (teacherData.learning_context) {
            const learningContext = teacherData.learning_context;
            systemInstruction += `\n### 현재 학습 환경 ###\n`;
            
            if (learningContext.current_phase) {
                systemInstruction += `- 수업 단계: ${learningContext.current_phase}\n`;
            }
            
            if (teacherData.topic) {
                systemInstruction += `- 학습 주제: ${teacherData.topic}\n`;
            }
            
            if (teacherData.grade_level) {
                systemInstruction += `- 학년 수준: ${teacherData.grade_level}\n`;
            }
        }
        
        // 공통 마무리 규칙
        systemInstruction += `\n### 공통 대화 규칙 ###\n`;
        systemInstruction += `- 친절하고 격려하는 동료 탐험가 같은 말투를 사용하라\n`;
        systemInstruction += `- 한국어로만 대답해야 한다\n`;
        systemInstruction += `- 마크다운 문법(*, **, #, ## 등)을 사용하지 말고 순수한 텍스트로만 작성해라\n`;
        systemInstruction += `- 답변은 반드시 학생의 다음 생각을 유도하는 '질문' 형태여야 한다\n`;
        
        return systemInstruction;
    }
    
    /**
     * Gemini API 호출 형식으로 변환합니다
     * @param {string} systemInstruction - 시스템 지시사항
     * @param {string} userMessage - 사용자 메시지
     * @param {Array} conversationHistory - 대화 이력
     * @returns {Array} Gemini API 호출용 contents 배열
     */
    static formatForGeminiApi(systemInstruction, userMessage, conversationHistory) {
        const recentHistory = conversationHistory.slice(-6);
        const contents = [];
        
        // 시스템 지시사항과 첫 사용자 메시지 결합
        if (recentHistory.length === 0) {
            contents.push({
                role: 'user',
                parts: [{
                    text: `${systemInstruction}\n\n### 학생의 현재 발화 ###\n${userMessage}`
                }]
            });
        } else {
            // 대화 이력이 있는 경우
            recentHistory.forEach((turn, index) => {
                if (index === 0) {
                    const userTextWithSystemPrompt = `${systemInstruction}\n\n### 학생의 현재 발화 ###\n${turn.parts[0].text}`;
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
    
    /**
     * 오류 상황에서 사용할 폴백 프롬프트를 생성합니다
     * @param {string} userMessage - 사용자 메시지
     * @param {Array} conversationHistory - 대화 이력
     * @returns {Array} 폴백 프롬프트 배열
     */
    static buildFallbackPrompt(userMessage, conversationHistory) {
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

module.exports = PromptBuilder;
