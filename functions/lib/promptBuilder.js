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
        const { type, config, context, metacognitive_needs, reflective_needs } = analysisResult;
        
        // 1. 성찰적 학습이 필요한 경우 전용 프롬프트 사용 (우선순위)
        if (reflective_needs && this.requiresReflectiveLearning(reflective_needs)) {
            console.log('성찰적 학습 프롬프트 적용:', reflective_needs.summary_trigger_type || 'general_reflection');
            return await this.getReflectiveLearningPrompt(reflective_needs, conversationHistory, subjectConfig);
        }
        
        // 2. 메타인지 스캐폴딩이 필요한 경우 전용 프롬프트 사용
        if (metacognitive_needs && this.requiresMetacognitiveIntervention(metacognitive_needs)) {
            console.log('메타인지 스캐폴딩 프롬프트 적용:', metacognitive_needs.scaffolding_type);
            return await this.getMetacognitivePrompt(metacognitive_needs, subjectConfig);
        }
        
        // 3. 교사의 커스텀 프롬프트 우선 확인
        if (teacherData.customPrompts && teacherData.customPrompts[type]) {
            console.log(`교사 커스텀 프롬프트 사용: ${type}`);
            return teacherData.customPrompts[type];
        }
        
        // 4. JSON의 ai_tutor_prompt 필드 우선 사용
        if (config.ai_tutor_prompt) {
            console.log(`과목별 AI 튜터 프롬프트 사용: ${type}`);
            return config.ai_tutor_prompt;
        }
        
        // 5. 폴백: sample_prompts에서 선택 (기존 호환성 유지)
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
        
        // 1-1. 학습 자료 정보 추가 (지능형 처리)
        if (lessonResources && lessonResources.length > 0) {
            systemInstruction += `### 📚 참고 학습 자료 ###\n`;
            
            // 지능형 자료인지 기본 목록인지 확인
            const hasIntelligentData = lessonResources.some(r => r.relevanceScore !== undefined);
            
            if (hasIntelligentData) {
                // 지능형 자료: 관련성과 내용 포함
                systemInstruction += `학생의 현재 질문과 관련도 높은 자료들입니다:\n\n`;
                
                lessonResources.forEach((resource, index) => {
                    const relevance = resource.relevanceScore ? `(관련도: ${(resource.relevanceScore * 100).toFixed(0)}%)` : '';
                    const icon = resource.resource ? (resource.resource.type === 'link' ? '🔗' : '📎') : '📄';
                    const title = resource.resource ? resource.resource.title : resource.title;
                    
                    systemInstruction += `${index + 1}. ${icon} ${title} ${relevance}\n`;
                    
                    // 추출된 내용이 있으면 핵심 내용 포함
                    if (resource.extractedContent && resource.extractedContent.text) {
                        const preview = resource.extractedContent.text.substring(0, 150);
                        systemInstruction += `   핵심 내용: ${preview}${resource.extractedContent.text.length > 150 ? '...' : ''}\n`;
                    }
                    
                    // 관련 콘텐츠 청크가 있으면 포함
                    if (resource.relevantChunks && resource.relevantChunks.length > 0) {
                        systemInstruction += `   관련 부분: "${resource.relevantChunks[0].substring(0, 100)}..."\n`;
                    }
                    
                    systemInstruction += `\n`;
                });
                
                systemInstruction += `위 자료의 관련 내용을 바탕으로 학생에게 더 구체적이고 정확한 안내를 제공하세요.\n`;
                systemInstruction += `학생이 2-3회 이상 어려움을 표현할 때만 자료를 제안하고, 자료 내용을 직접 언급하여 학습을 도우세요.\n\n`;
                
            } else {
                // 기존 방식: 메타데이터만 사용
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
    
    /**
     * 메타인지 개입이 필요한지 판단합니다
     * @param {Object} metacognitiveNeeds - 메타인지 분석 결과
     * @returns {boolean} 개입 필요 여부
     */
    static requiresMetacognitiveIntervention(metacognitiveNeeds) {
        return metacognitiveNeeds.requires_diagnosis_first || 
               metacognitiveNeeds.requires_evaluation_prompt ||
               metacognitiveNeeds.requires_problem_specification;
    }
    
    /**
     * 메타인지 스캐폴딩용 프롬프트를 생성합니다
     * @param {Object} metacognitiveNeeds - 메타인지 분석 결과
     * @param {Object} subjectConfig - 과목별 설정
     * @returns {string} 메타인지 스캐폴딩 프롬프트
     */
    static async getMetacognitivePrompt(metacognitiveNeeds, subjectConfig) {
        try {
            // 메타인지 설정 로드
            const fs = require('fs').promises;
            const path = require('path');
            const configPath = path.join(__dirname, '../config/metacognitive_scaffolding.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const metacognitiveConfig = JSON.parse(configData).metacognitive_scaffolding;
            
            const scaffoldingType = metacognitiveNeeds.scaffolding_type;
            const studentLevel = metacognitiveNeeds.student_ability_level || 'medium';
            
            console.log(`메타인지 스캐폴딩: ${scaffoldingType}, 학생 수준: ${studentLevel}`);
            
            // 기본 프롬프트 선택
            let basePrompt = '';
            
            if (scaffoldingType && metacognitiveConfig.response_types[scaffoldingType]) {
                const templates = metacognitiveConfig.response_types[scaffoldingType].prompt_templates || [];
                if (templates.length > 0) {
                    // 랜덤하게 선택하여 다양성 제공
                    const randomIndex = Math.floor(Math.random() * templates.length);
                    basePrompt = templates[randomIndex];
                }
            }
            
            // 학생 수준별 적응형 프롬프트 추가
            const adaptiveConfig = metacognitiveConfig.adaptive_scaffolding;
            if (studentLevel === 'high' && adaptiveConfig.high_ability_students) {
                const additionalPrompts = adaptiveConfig.high_ability_students.prompts || [];
                if (additionalPrompts.length > 0) {
                    const randomPrompt = additionalPrompts[Math.floor(Math.random() * additionalPrompts.length)];
                    basePrompt += `\n\n${randomPrompt}`;
                }
            } else if (studentLevel === 'low' && adaptiveConfig.struggling_students) {
                const additionalPrompts = adaptiveConfig.struggling_students.prompts || [];
                if (additionalPrompts.length > 0) {
                    const randomPrompt = additionalPrompts[Math.floor(Math.random() * additionalPrompts.length)];
                    basePrompt += `\n\n${randomPrompt}`;
                }
            }
            
            // 메타인지 규칙 추가
            basePrompt += this.getMetacognitiveRules(metacognitiveNeeds, subjectConfig);
            
            return basePrompt || '학생의 사고 과정을 이해하고 스스로 답을 찾을 수 있도록 도와주세요.';
            
        } catch (error) {
            console.error('메타인지 프롬프트 생성 오류:', error);
            return '학생이 스스로 생각하고 탐구할 수 있도록 안내해주세요.';
        }
    }
    
    /**
     * 메타인지 스캐폴딩 규칙을 생성합니다
     * @param {Object} metacognitiveNeeds - 메타인지 분석 결과
     * @param {Object} subjectConfig - 과목별 설정
     * @returns {string} 메타인지 규칙 문자열
     */
    static getMetacognitiveRules(metacognitiveNeeds, subjectConfig) {
        let rules = `\n\n### 메타인지 스캐폴딩 지침 ###\n`;
        
        if (metacognitiveNeeds.requires_diagnosis_first) {
            rules += `- 🎯 **진단 우선**: 학생이 스스로 문제를 진단하도록 유도한 후 도움 제공\n`;
            rules += `- 학생의 현재 이해 상태와 구체적 어려움을 먼저 파악하세요\n`;
            rules += `- "무엇이 어려운가요?" "어느 부분에서 막혔나요?" 같은 진단 질문 활용\n`;
        }
        
        if (metacognitiveNeeds.requires_problem_specification) {
            rules += `- 🔍 **구체화 유도**: 막연한 문제를 구체적으로 명시하도록 안내\n`;
            rules += `- "어떤 실험을 하고 계신가요?" "예상과 어떻게 달랐나요?" 질문 활용\n`;
            rules += `- 문제를 단계별로 나누어 생각하도록 유도\n`;
        }
        
        if (metacognitiveNeeds.requires_evaluation_prompt) {
            rules += `- ✅ **평가 촉진**: 응답 후 학생의 이해도와 만족도 확인\n`;
            rules += `- "이해가 되시나요?" "더 궁금한 점이 있나요?" 같은 평가 질문 필수\n`;
            rules += `- 학생이 배운 내용을 자신만의 말로 설명하도록 요청\n`;
        }
        
        // 대화 맥락 고려사항
        const context = metacognitiveNeeds.conversation_context;
        if (context.consecutive_executive_requests > 2) {
            rules += `- ⚠️ **접근 방식 변경**: 연속된 직접적 요청 감지, 다른 방식으로 접근\n`;
            rules += `- 학습자의 좌절감을 인정하고 단계를 더 세분화\n`;
        }
        
        if (context.time_since_last_evaluation > 5) {
            rules += `- 🔄 **중간 점검**: 오랜 대화 후 학습 상태 재확인 필요\n`;
            rules += `- 지금까지의 대화 내용을 간단히 요약하고 이해도 점검\n`;
        }
        
        rules += `\n**핵심 원칙**: 정답을 직접 제공하기보다, 학생이 스스로 발견할 수 있도록 사고 과정을 안내하세요.\n`;
        
        return rules;
    }
    
    /**
     * 성찰적 학습이 필요한지 판단합니다
     * @param {Object} reflectiveNeeds - 성찰적 학습 분석 결과
     * @returns {boolean} 성찰적 학습 필요 여부
     */
    static requiresReflectiveLearning(reflectiveNeeds) {
        return reflectiveNeeds.requires_summary ||
               reflectiveNeeds.requires_connection_making ||
               reflectiveNeeds.requires_metacognitive_reflection;
    }
    
    /**
     * 성찰적 학습용 프롬프트를 생성합니다
     * @param {Object} reflectiveNeeds - 성찰적 학습 분석 결과
     * @param {Array} conversationHistory - 대화 이력
     * @param {Object} subjectConfig - 과목별 설정
     * @returns {string} 성찰적 학습 프롬프트
     */
    static async getReflectiveLearningPrompt(reflectiveNeeds, conversationHistory, subjectConfig) {
        try {
            // 성찰적 학습 설정 로드
            const fs = require('fs').promises;
            const path = require('path');
            const configPath = path.join(__dirname, '../config/reflective_learning.json');
            const configData = await fs.readFile(configPath, 'utf8');
            const reflectiveConfig = JSON.parse(configData).reflective_learning;
            
            let basePrompt = '';
            
            // 1. 대화 요약이 필요한 경우
            if (reflectiveNeeds.requires_summary) {
                basePrompt += this.generateConversationSummary(reflectiveNeeds, conversationHistory, reflectiveConfig);
            }
            
            // 2. 개념 연결이 필요한 경우
            if (reflectiveNeeds.requires_connection_making) {
                basePrompt += this.generateConnectionMaking(reflectiveNeeds, conversationHistory, reflectiveConfig);
            }
            
            // 3. 메타인지적 성찰이 필요한 경우
            if (reflectiveNeeds.requires_metacognitive_reflection) {
                basePrompt += this.generateMetacognitiveReflection(reflectiveNeeds, reflectiveConfig);
            }
            
            // 4. 학습 깊이에 따른 적응형 질문 추가
            const depthLevel = reflectiveNeeds.conversation_context.learning_depth_level;
            basePrompt += this.getDepthBasedQuestions(depthLevel, reflectiveConfig);
            
            // 5. 성찰적 학습 규칙 추가
            basePrompt += this.getReflectiveLearningRules(reflectiveNeeds);
            
            return basePrompt || '지금까지의 학습 경험을 되돌아보며 깊이 생각해보세요.';
            
        } catch (error) {
            console.error('성찰적 학습 프롬프트 생성 오류:', error);
            return '지금까지의 대화를 되돌아보고 새롭게 알게 된 점을 생각해보세요.';
        }
    }
    
    /**
     * 대화 요약 프롬프트를 생성합니다
     * @param {Object} reflectiveNeeds - 성찰적 학습 분석 결과
     * @param {Array} conversationHistory - 대화 이력
     * @param {Object} reflectiveConfig - 성찰적 학습 설정
     * @returns {string} 대화 요약 프롬프트
     */
    static generateConversationSummary(reflectiveNeeds, conversationHistory, reflectiveConfig) {
        const templates = reflectiveConfig.conversation_summary?.summary_templates || [];
        if (templates.length === 0) {
            return '지금까지의 대화를 요약하고 가장 중요한 학습 내용을 생각해보세요.';
        }
        
        // 간단한 키 개념 추출
        const keyConceptsFromHistory = this.extractKeyConcepts(conversationHistory);
        const mainDiscoveryFromHistory = this.extractMainDiscovery(conversationHistory);
        
        // 템플릿 선택 및 치환
        const template = templates[Math.floor(Math.random() * templates.length)];
        return template
            .replace('{key_concepts}', keyConceptsFromHistory.join(', '))
            .replace('{main_discovery}', mainDiscoveryFromHistory)
            .replace('{learning_progression}', '가설 설정부터 검증까지')
            + '\n\n';
    }
    
    /**
     * 개념 연결 프롬프트를 생성합니다
     * @param {Object} reflectiveNeeds - 성찰적 학습 분석 결과
     * @param {Array} conversationHistory - 대화 이력
     * @param {Object} reflectiveConfig - 성찰적 학습 설정
     * @returns {string} 개념 연결 프롬프트
     */
    static generateConnectionMaking(reflectiveNeeds, conversationHistory, reflectiveConfig) {
        const connectionTemplates = reflectiveConfig.connection_making?.previous_conversation_references?.connection_templates || [];
        if (connectionTemplates.length === 0) {
            return '앞서 나눠 낸 이야기와 지금 상황을 연결해보세요. ';
        }
        
        const previousTopics = this.extractPreviousTopics(conversationHistory);
        const currentTopic = this.extractCurrentTopic(conversationHistory);
        
        const template = connectionTemplates[Math.floor(Math.random() * connectionTemplates.length)];
        return template
            .replace('{previous_topic}', previousTopics[0] || '에너지 변환')
            .replace('{current_topic}', currentTopic || '현재 실험')
            + '\n\n';
    }
    
    /**
     * 메타인지적 성찰 프롬프트를 생성합니다
     * @param {Object} reflectiveNeeds - 성찰적 학습 분석 결과
     * @param {Object} reflectiveConfig - 성찰적 학습 설정
     * @returns {string} 메타인지적 성찰 프롬프트
     */
    static generateMetacognitiveReflection(reflectiveNeeds, reflectiveConfig) {
        const thinkingReview = reflectiveConfig.metacognitive_reflection?.thinking_process_review || [];
        const strategyAssessment = reflectiveConfig.metacognitive_reflection?.learning_strategy_assessment || [];
        
        let prompt = '';
        
        if (thinkingReview.length > 0) {
            const randomReview = thinkingReview[Math.floor(Math.random() * thinkingReview.length)];
            prompt += randomReview + ' ';
        }
        
        if (strategyAssessment.length > 0) {
            const randomAssessment = strategyAssessment[Math.floor(Math.random() * strategyAssessment.length)];
            prompt += randomAssessment + ' ';
        }
        
        return prompt + '\n\n';
    }
    
    /**
     * 학습 깊이에 따른 질문을 생성합니다
     * @param {number} depthLevel - 학습 깊이 수준 (1-6)
     * @param {Object} reflectiveConfig - 성찰적 학습 설정
     * @returns {string} 깊이별 질문 프롬프트
     */
    static getDepthBasedQuestions(depthLevel, reflectiveConfig) {
        const depthLevels = reflectiveConfig.progressive_questioning?.depth_levels || {};
        
        const levelKeys = [
            'level_1_recall', 'level_2_comprehension', 'level_3_application',
            'level_4_analysis', 'level_5_synthesis', 'level_6_evaluation'
        ];
        
        let questions = '';
        
        // 현재 수준과 다음 단계 질문 제시
        for (let i = depthLevel - 1; i <= Math.min(depthLevel, 5); i++) {
            const levelKey = levelKeys[i];
            const levelQuestions = depthLevels[levelKey] || [];
            
            if (levelQuestions.length > 0) {
                const randomQuestion = levelQuestions[Math.floor(Math.random() * levelQuestions.length)];
                questions += randomQuestion + ' ';
                break; // 한 개만 선택
            }
        }
        
        return questions + '\n\n';
    }
    
    /**
     * 성찰적 학습 규칙을 생성합니다
     * @param {Object} reflectiveNeeds - 성찰적 학습 분석 결과
     * @returns {string} 성찰적 학습 규칙 문자열
     */
    static getReflectiveLearningRules(reflectiveNeeds) {
        let rules = `\n### 성찰적 학습 지침 ###\n`;
        
        rules += `- 🔄 **연결 사고**: 이전 경험과 현재 상황을 연결하여 통합적 이해 촉진\n`;
        rules += `- 🧐 **사고 과정 성찰**: 학생이 어떻게 생각하고 문제를 해결했는지 되돌아보도록 안내\n`;
        
        if (reflectiveNeeds.requires_summary) {
            rules += `- 📝 **요약 및 정리**: 학습 내용을 체계적으로 정리하여 기억 정착도 증진\n`;
        }
        
        if (reflectiveNeeds.requires_connection_making) {
            rules += `- ⚡ **개념 연결**: 새로운 개념을 기존 지식과 연결하여 의미 있는 학습 창조\n`;
        }
        
        if (reflectiveNeeds.requires_metacognitive_reflection) {
            rules += `- 🎯 **전략 인식**: 효과적인 학습 방법을 인식하고 다음에 활용할 수 있도록 지원\n`;
        }
        
        const depthLevel = reflectiveNeeds.conversation_context.learning_depth_level;
        if (depthLevel >= 4) {
            rules += `- 🔍 **심층 분석**: 고차원적 사고를 통해 복잡한 개념들을 종합적으로 이해\n`;
        }
        
        rules += `\n**핵심 원칙**: 학생이 스스로 학습 경험을 되돌아보고 의미를 찾을 수 있도록 안내하세요.\n`;
        
        return rules;
    }
    
    /**
     * 대화에서 핵심 개념들을 추출합니다
     * @param {Array} conversationHistory - 대화 이력
     * @returns {Array} 핵심 개념 배열
     */
    static extractKeyConcepts(conversationHistory) {
        const concepts = [];
        const keywords = ['에너지', '중력', '마찰', '운동', '속도', '힘'];
        
        conversationHistory.slice(-6).forEach(turn => {
            if (turn.role === 'user' && turn.parts && turn.parts[0]) {
                const text = turn.parts[0].text;
                keywords.forEach(keyword => {
                    if (text.includes(keyword) && !concepts.includes(keyword)) {
                        concepts.push(keyword);
                    }
                });
            }
        });
        
        return concepts.length > 0 ? concepts : ['물리 현상'];
    }
    
    /**
     * 대화에서 주요 발견을 추출합니다
     * @param {Array} conversationHistory - 대화 이력
     * @returns {string} 주요 발견
     */
    static extractMainDiscovery(conversationHistory) {
        // 간단한 패턴 기반 발견 추출
        const discoveryPatterns = ['알았어', '발견했어', '깨달았어', '이해했어'];
        
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
            const turn = conversationHistory[i];
            if (turn.role === 'user' && turn.parts && turn.parts[0]) {
                const text = turn.parts[0].text;
                for (const pattern of discoveryPatterns) {
                    if (text.includes(pattern)) {
                        return text.substring(0, 50) + '...';
                    }
                }
            }
        }
        
        return '중요한 과학 원리를 이해하게 되었다는 점';
    }
    
    /**
     * 이전 주제들을 추출합니다
     * @param {Array} conversationHistory - 대화 이력
     * @returns {Array} 이전 주제 배열
     */
    static extractPreviousTopics(conversationHistory) {
        return ['에너지 변환', '운동과 정지', '마찰력의 영향']; // 예시
    }
    
    /**
     * 현재 주제를 추출합니다
     * @param {Array} conversationHistory - 대화 이력
     * @returns {string} 현재 주제
     */
    static extractCurrentTopic(conversationHistory) {
        return '현재 실험 결과'; // 예시
    }
}

module.exports = PromptBuilder;
