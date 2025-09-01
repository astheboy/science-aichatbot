const SubjectLoader = require('./subjectLoader');
const fs = require('fs').promises;
const path = require('path');

/**
 * JSON 설정 기반 학생 응답 분석 시스템
 */
class ResponseAnalyzer {
    
    /**
     * 과목별 JSON 설정을 기반으로 학생 응답을 분석합니다
     * @param {string} userMessage - 학생 메시지
     * @param {string} subject - 과목명 (korean, math, science, social)
     * @param {Array} conversationHistory - 대화 이력 (선택사항)
     * @returns {Object} 분석 결과 { type, config, confidence, metacognitive_needs }
     */
    static async analyzeStudentResponse(userMessage, subject = 'science', conversationHistory = []) {
        try {
            console.log(`[응답 분석 시작] 과목: ${subject}, 메시지: "${userMessage}"`);
            
            // 과목별 설정 로드
            const subjectConfig = await SubjectLoader.loadSubjectConfig(subject);
            const responseTypes = subjectConfig.response_types;
            
            // 메타인지 스캐폴딩 설정 로드
            const metacognitiveConfig = await this.loadMetacognitiveConfig();
            
            // 성찰적 학습 설정 로드
            const reflectiveConfig = await this.loadReflectiveLearningConfig();
            
            console.log(`[응답 분석] 로드된 응답 유형들:`, Object.keys(responseTypes));
            
            // 메시지 전처리
            const processedMessage = this.preprocessMessage(userMessage);
            
            console.log(`[응답 분석] 전처리된 메시지: "${processedMessage}"`);
            
            // 1. 메타인지 스캐폴딩 필요성 분석
            const metacognitiveAnalysis = this.analyzeMetacognitiveNeeds(
                processedMessage, 
                conversationHistory, 
                metacognitiveConfig
            );
            
            // 2. 성찰적 학습 필요성 분석
            const reflectiveAnalysis = this.analyzeReflectiveLearningNeeds(
                processedMessage,
                conversationHistory,
                reflectiveConfig
            );
            
            // 3. 각 응답 유형별로 매칭 점수 계산
            const matchResults = [];
            
            for (const [typeKey, typeConfig] of Object.entries(responseTypes)) {
                const confidence = this.calculateMatchConfidence(processedMessage, typeConfig.patterns);
                
                console.log(`[패턴 매칭] ${typeKey}: 신뢰도 ${confidence.toFixed(3)} (패턴 수: ${typeConfig.patterns.length})`);
                
                if (confidence > 0) {
                    console.log(`[패턴 매칭 성공] ${typeKey} 매칭됨!`);
                    matchResults.push({
                        type: typeKey,
                        config: typeConfig,
                        confidence: confidence
                    });
                }
            }
            
            console.log(`[매칭 결과] 총 ${matchResults.length}개 유형이 매칭됨:`, matchResults.map(r => `${r.type}(${r.confidence.toFixed(3)})`));
            
            // 가장 높은 점수의 응답 유형 선택
            if (matchResults.length > 0) {
                // 점수 순으로 정렬
                matchResults.sort((a, b) => b.confidence - a.confidence);
                const bestMatch = matchResults[0];
                
                console.log(`응답 분석 결과 (${subject}): ${bestMatch.type} (신뢰도: ${bestMatch.confidence.toFixed(2)})`);
                
                // 맥락 정보 추가
                const contextualAnalysis = this.addContextualInfo(bestMatch, conversationHistory, subjectConfig);
                
                // 메타인지 분석 결과 추가
                contextualAnalysis.metacognitive_needs = metacognitiveAnalysis;
                
                // 성찰적 학습 분석 결과 추가
                contextualAnalysis.reflective_needs = reflectiveAnalysis;
                
                return contextualAnalysis;
            }
            
            // 매칭되는 패턴이 없으면 DEFAULT 반환
            console.log(`기본 응답 유형 사용 (${subject}): DEFAULT`);
            return {
                type: 'DEFAULT',
                config: responseTypes.DEFAULT,
                confidence: 0.1,
                context: {
                    isFirstMessage: conversationHistory.length === 0,
                    previousTypes: this.extractPreviousTypes(conversationHistory)
                },
                metacognitive_needs: metacognitiveAnalysis,
                reflective_needs: reflectiveAnalysis
            };
            
        } catch (error) {
            console.error('응답 분석 중 오류:', error);
            
            // 오류 시 기본 과학 설정의 DEFAULT 사용
            const fallbackConfig = await SubjectLoader.loadSubjectConfig('science');
            return {
                type: 'DEFAULT',
                config: fallbackConfig.response_types.DEFAULT,
                confidence: 0.1,
                error: error.message
            };
        }
    }
    
    /**
     * 메시지를 전처리합니다 (정규화, 불용어 제거 등)
     * @param {string} message - 원본 메시지
     * @returns {string} 전처리된 메시지
     */
    static preprocessMessage(message) {
        return message
            .toLowerCase()
            .trim()
            // 반복 문자 정규화 (예: "모르겠어어어" -> "모르겠어")
            .replace(/(.)\1{2,}/g, '$1')
            // 의미 없는 공백 제거
            .replace(/\s+/g, ' ');
    }
    
    /**
     * 패턴과 메시지 간의 매칭 신뢰도를 계산합니다
     * @param {string} message - 전처리된 메시지
     * @param {Array} patterns - 정규표현식 패턴 배열
     * @returns {number} 매칭 신뢰도 (0.0 ~ 1.0)
     */
    static calculateMatchConfidence(message, patterns) {
        let maxConfidence = 0;
        let totalMatches = 0;
        
        for (const pattern of patterns) {
            try {
                const regex = new RegExp(pattern, 'i');
                const match = regex.exec(message);
                
                if (match) {
                    totalMatches++;
                    
                    // 매칭 길이와 위치를 고려한 신뢰도 계산
                    const matchLength = match[0].length;
                    const messageLength = message.length;
                    const matchPosition = match.index;
                    
                    // 기본 매칭 점수
                    let confidence = 0.3;
                    
                    // 매칭 길이가 길수록 높은 점수
                    confidence += Math.min(matchLength / messageLength * 0.4, 0.4);
                    
                    // 메시지 앞부분에서 매칭될수록 높은 점수
                    const positionBonus = (messageLength - matchPosition) / messageLength * 0.2;
                    confidence += positionBonus;
                    
                    // 완전 매칭 보너스
                    if (matchLength === messageLength) {
                        confidence += 0.1;
                    }
                    
                    maxConfidence = Math.max(maxConfidence, confidence);
                }
            } catch (error) {
                console.error(`패턴 매칭 오류: ${pattern}`, error);
            }
        }
        
        // 여러 패턴이 매칭되면 추가 보너스
        if (totalMatches > 1) {
            maxConfidence = Math.min(maxConfidence + (totalMatches - 1) * 0.1, 1.0);
        }
        
        return maxConfidence;
    }
    
    /**
     * 대화 맥락을 고려한 추가 정보를 분석 결과에 추가합니다
     * @param {Object} analysisResult - 기본 분석 결과
     * @param {Array} conversationHistory - 대화 이력
     * @param {Object} subjectConfig - 과목별 설정
     * @returns {Object} 맥락 정보가 추가된 분석 결과
     */
    static addContextualInfo(analysisResult, conversationHistory, subjectConfig) {
        const context = {
            isFirstMessage: conversationHistory.length === 0,
            conversationLength: conversationHistory.length,
            previousTypes: this.extractPreviousTypes(conversationHistory),
            learningProgression: this.analyzeLearningProgression(conversationHistory, subjectConfig),
            suggestedNextActions: this.suggestNextActions(analysisResult.type, conversationHistory, subjectConfig)
        };
        
        return {
            ...analysisResult,
            context: context
        };
    }
    
    /**
     * 이전 대화의 응답 유형들을 추출합니다
     * @param {Array} conversationHistory - 대화 이력
     * @returns {Array} 이전 응답 유형 배열
     */
    static extractPreviousTypes(conversationHistory) {
        return conversationHistory
            .filter(turn => turn.responseType)
            .map(turn => turn.responseType)
            .slice(-5); // 최근 5개만 유지
    }
    
    /**
     * 대화 이력을 바탕으로 학습 진행 상황을 분석합니다
     * @param {Array} conversationHistory - 대화 이력
     * @param {Object} subjectConfig - 과목별 설정
     * @returns {Object} 학습 진행 분석 결과
     */
    static analyzeLearningProgression(conversationHistory, subjectConfig) {
        if (conversationHistory.length < 2) {
            return { stage: 'beginning', confidence: 'low' };
        }
        
        const recentTypes = this.extractPreviousTypes(conversationHistory);
        const typeDistribution = this.calculateTypeDistribution(recentTypes);
        
        // 과목별 학습 단계 분석 로직
        const progressionRules = this.getProgressionRules(subjectConfig.subject);
        
        for (const rule of progressionRules) {
            if (this.matchesProgressionRule(typeDistribution, rule)) {
                return {
                    stage: rule.stage,
                    confidence: rule.confidence,
                    description: rule.description
                };
            }
        }
        
        return { stage: 'intermediate', confidence: 'medium' };
    }
    
    /**
     * 응답 유형 분포를 계산합니다
     * @param {Array} types - 응답 유형 배열
     * @returns {Object} 유형별 빈도 객체
     */
    static calculateTypeDistribution(types) {
        const distribution = {};
        types.forEach(type => {
            distribution[type] = (distribution[type] || 0) + 1;
        });
        
        // 백분율로 변환
        const total = types.length;
        Object.keys(distribution).forEach(type => {
            distribution[type] = distribution[type] / total;
        });
        
        return distribution;
    }
    
    /**
     * 과목별 학습 진행 규칙을 반환합니다
     * @param {string} subject - 과목명
     * @returns {Array} 진행 규칙 배열
     */
    static getProgressionRules(subject) {
        const commonRules = [
            {
                stage: 'struggling',
                confidence: 'high',
                description: '학습에 어려움을 겪는 단계',
                condition: (dist) => (dist.EXPLORATION_DEADLOCK || 0) > 0.4 || (dist.FAILURE_REPORT || 0) > 0.3
            },
            {
                stage: 'questioning',
                confidence: 'medium',
                description: '적극적으로 질문하는 단계',
                condition: (dist) => (dist.CONCEPT_QUESTION || 0) > 0.5
            },
            {
                stage: 'analyzing',
                confidence: 'high',
                description: '분석적 사고를 보이는 단계',
                condition: (dist) => (dist.HYPOTHESIS_INQUIRY || 0) > 0.3 || (dist.CRITICAL_INQUIRY || 0) > 0.3
            }
        ];
        
        // 과목별 특화 규칙 추가 가능
        const subjectSpecificRules = {
            science: [
                {
                    stage: 'experimenting',
                    confidence: 'high',
                    description: '실험적 탐구 단계',
                    condition: (dist) => (dist.SUCCESS_WITHOUT_PRINCIPLE || 0) > 0.2 && (dist.HYPOTHESIS_INQUIRY || 0) > 0.1
                }
            ],
            math: [
                {
                    stage: 'problem_solving',
                    confidence: 'high',
                    description: '문제해결 중심 단계',
                    condition: (dist) => (dist.PROCEDURE_ERROR || 0) > 0.2 && (dist.MATHEMATICAL_REASONING || 0) > 0.1
                }
            ]
        };
        
        return [...commonRules, ...(subjectSpecificRules[subject] || [])];
    }
    
    /**
     * 진행 규칙과 매칭되는지 확인합니다
     * @param {Object} distribution - 유형 분포
     * @param {Object} rule - 진행 규칙
     * @returns {boolean} 매칭 여부
     */
    static matchesProgressionRule(distribution, rule) {
        return rule.condition(distribution);
    }
    
    /**
     * 현재 응답 유형과 맥락에 따른 다음 권장 액션을 제안합니다
     * @param {string} currentType - 현재 응답 유형
     * @param {Array} conversationHistory - 대화 이력
     * @param {Object} subjectConfig - 과목별 설정
     * @returns {Array} 권장 액션 배열
     */
    static suggestNextActions(currentType, conversationHistory, subjectConfig) {
        // 기본 권장 액션 맵핑
        const actionMap = {
            'CONCEPT_QUESTION': ['provide_scaffolding', 'use_analogy', 'check_prerequisites'],
            'EXPLORATION_DEADLOCK': ['suggest_alternatives', 'break_down_problem', 'encourage'],
            'FAILURE_REPORT': ['analyze_error', 'find_learning_opportunity', 'adjust_approach'],
            'SUCCESS_WITHOUT_PRINCIPLE': ['connect_to_theory', 'generalize', 'apply_to_new_context'],
            'HYPOTHESIS_INQUIRY': ['validate_hypothesis', 'design_test', 'explore_implications'],
            'DEFAULT': ['assess_understanding', 'provide_guidance', 'engage_interest']
        };
        
        const baseActions = actionMap[currentType] || actionMap['DEFAULT'];
        
        // 대화 맥락에 따른 액션 조정
        const recentTypes = this.extractPreviousTypes(conversationHistory);
        if (recentTypes.length > 2) {
            const lastTwoTypes = recentTypes.slice(-2);
            
            // 같은 유형이 연속되면 접근 방식 변경 제안
            if (lastTwoTypes[0] === lastTwoTypes[1] && lastTwoTypes[1] === currentType) {
                baseActions.unshift('change_approach');
            }
        }
        
        return baseActions;
    }
    
    /**
     * 메타인지 스캐폴딩 설정을 로드합니다
     * @returns {Object} 메타인지 스캐폴딩 설정
     */
    static async loadMetacognitiveConfig() {
        try {
            const configPath = path.join(__dirname, '../config/metacognitive_scaffolding.json');
            const configData = await fs.readFile(configPath, 'utf8');
            return JSON.parse(configData).metacognitive_scaffolding;
        } catch (error) {
            console.warn('메타인지 스캐폴딩 설정 로드 실패:', error.message);
            return { response_types: {}, conversation_flow_management: {}, adaptive_scaffolding: {} };
        }
    }
    
    /**
     * 학생 메시지의 메타인지 스캐폴딩 필요성을 분석합니다
     * @param {string} message - 전처리된 메시지
     * @param {Array} conversationHistory - 대화 이력
     * @param {Object} metacognitiveConfig - 메타인지 스캐폴딩 설정
     * @returns {Object} 메타인지 분석 결과
     */
    static analyzeMetacognitiveNeeds(message, conversationHistory, metacognitiveConfig) {
        const needs = {
            requires_diagnosis_first: false,
            requires_evaluation_prompt: false,
            requires_problem_specification: false,
            scaffolding_type: null,
            student_ability_level: this.assessStudentAbility(message, conversationHistory, metacognitiveConfig),
            conversation_context: {
                consecutive_executive_requests: this.countConsecutiveExecutiveRequests(conversationHistory),
                previous_scaffolding_attempts: this.countPreviousScaffoldingAttempts(conversationHistory),
                time_since_last_evaluation: this.getTimeSinceLastEvaluation(conversationHistory)
            }
        };
        
        // 메타인지 응답 유형별 분석
        const responseTypes = metacognitiveConfig.response_types || {};
        
        // 1. 실행적 요청 분석
        if (responseTypes.EXECUTIVE_REQUEST) {
            const executiveConfidence = this.calculateMatchConfidence(message, responseTypes.EXECUTIVE_REQUEST.patterns);
            if (executiveConfidence > 0.5) {
                needs.requires_diagnosis_first = true;
                needs.scaffolding_type = 'EXECUTIVE_REQUEST';
            }
        }
        
        // 2. 막연한 문제 분석
        if (responseTypes.VAGUE_PROBLEM) {
            const vagueConfidence = this.calculateMatchConfidence(message, responseTypes.VAGUE_PROBLEM.patterns);
            if (vagueConfidence > 0.4) {
                needs.requires_problem_specification = true;
                needs.scaffolding_type = needs.scaffolding_type || 'VAGUE_PROBLEM';
            }
        }
        
        // 3. 자기 평가 요청 분석
        if (responseTypes.SELF_EVALUATION_REQUEST) {
            const evaluationConfidence = this.calculateMatchConfidence(message, responseTypes.SELF_EVALUATION_REQUEST.patterns);
            if (evaluationConfidence > 0.3 && conversationHistory.length > 0) {
                needs.requires_evaluation_prompt = true;
                needs.scaffolding_type = needs.scaffolding_type || 'SELF_EVALUATION_REQUEST';
            }
        }
        
        console.log('[메타인지 분석 결과]', needs);
        return needs;
    }
    
    /**
     * 학생의 능력 수준을 평가합니다
     * @param {string} message - 학생 메시지
     * @param {Array} conversationHistory - 대화 이력
     * @param {Object} metacognitiveConfig - 메타인지 설정
     * @returns {string} 'high', 'medium', 'low'
     */
    static assessStudentAbility(message, conversationHistory, metacognitiveConfig) {
        let score = 0;
        const adaptive = metacognitiveConfig.adaptive_scaffolding || {};
        
        // 고능력 지표 확인
        if (adaptive.high_ability_students) {
            const highIndicators = adaptive.high_ability_students.indicators || [];
            highIndicators.forEach(indicator => {
                if (message.includes(indicator.toLowerCase()) || 
                    this.checkPatternInHistory(conversationHistory, indicator)) {
                    score += 2;
                }
            });
        }
        
        // 저능력 지표 확인
        if (adaptive.struggling_students) {
            const lowIndicators = adaptive.struggling_students.indicators || [];
            lowIndicators.forEach(indicator => {
                if (message.includes(indicator.toLowerCase()) || 
                    this.checkPatternInHistory(conversationHistory, indicator)) {
                    score -= 1;
                }
            });
        }
        
        // 메시지 길이와 복잡성
        if (message.length > 50 && message.split(' ').length > 10) score += 1;
        if (message.length < 10) score -= 1;
        
        if (score >= 3) return 'high';
        if (score <= -2) return 'low';
        return 'medium';
    }
    
    /**
     * 연속적인 실행적 요청 횟수를 계산합니다
     * @param {Array} conversationHistory - 대화 이력
     * @returns {number} 연속 실행적 요청 횟수
     */
    static countConsecutiveExecutiveRequests(conversationHistory) {
        let count = 0;
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
            const turn = conversationHistory[i];
            if (turn.role === 'user' && turn.metacognitive_analysis && 
                turn.metacognitive_analysis.scaffolding_type === 'EXECUTIVE_REQUEST') {
                count++;
            } else {
                break;
            }
        }
        return count;
    }
    
    /**
     * 이전 스캐폴딩 시도 횟수를 계산합니다
     * @param {Array} conversationHistory - 대화 이력
     * @returns {number} 스캐폴딩 시도 횟수
     */
    static countPreviousScaffoldingAttempts(conversationHistory) {
        return conversationHistory.filter(turn => 
            turn.role === 'model' && 
            turn.scaffolding_applied === true
        ).length;
    }
    
    /**
     * 마지막 평가 이후 시간을 계산합니다
     * @param {Array} conversationHistory - 대화 이력
     * @returns {number} 마지막 평가 이후 턴 수
     */
    static getTimeSinceLastEvaluation(conversationHistory) {
        for (let i = conversationHistory.length - 1; i >= 0; i--) {
            const turn = conversationHistory[i];
            if (turn.evaluation_requested === true) {
                return conversationHistory.length - 1 - i;
            }
        }
        return conversationHistory.length;
    }
    
    /**
     * 대화 이력에서 특정 패턴을 확인합니다
     * @param {Array} conversationHistory - 대화 이력
     * @param {string} pattern - 확인할 패턴
     * @returns {boolean} 패턴 존재 여부
     */
    static checkPatternInHistory(conversationHistory, pattern) {
        const recentTurns = conversationHistory.slice(-3);
        return recentTurns.some(turn => 
            turn.role === 'user' && 
            turn.parts && 
            turn.parts[0] && 
            turn.parts[0].text && 
            turn.parts[0].text.toLowerCase().includes(pattern.toLowerCase())
        );
    }
    
    /**
     * 성찰적 학습 설정을 로드합니다
     * @returns {Object} 성찰적 학습 설정
     */
    static async loadReflectiveLearningConfig() {
        try {
            const configPath = path.join(__dirname, '../config/reflective_learning.json');
            const configData = await fs.readFile(configPath, 'utf8');
            return JSON.parse(configData).reflective_learning;
        } catch (error) {
            console.warn('성찰적 학습 설정 로드 실패:', error.message);
            return { conversation_summary: {}, connection_making: {}, metacognitive_reflection: {} };
        }
    }
    
    /**
     * 학생 메시지의 성찰적 학습 필요성을 분석합니다
     * @param {string} message - 전처리된 메시지
     * @param {Array} conversationHistory - 대화 이력
     * @param {Object} reflectiveConfig - 성찰적 학습 설정
     * @returns {Object} 성찰적 학습 분석 결과
     */
    static analyzeReflectiveLearningNeeds(message, conversationHistory, reflectiveConfig) {
        const needs = {
            requires_summary: false,
            requires_connection_making: false,
            requires_metacognitive_reflection: false,
            summary_trigger_type: null,
            conversation_context: {
                turn_count: conversationHistory.length,
                topic_progression: this.analyzeTopicProgression(conversationHistory),
                learning_depth_level: this.assessLearningDepth(message, conversationHistory)
            },
            suggested_reflective_actions: []
        };
        
        // 1. 대화 요약 필요성 분석
        const summaryTriggers = reflectiveConfig.conversation_summary?.trigger_conditions || [];
        
        // 턴 수 기반 트리거
        const turnTrigger = summaryTriggers.find(t => t.type === 'turn_count');
        if (turnTrigger && conversationHistory.length >= turnTrigger.value) {
            needs.requires_summary = true;
            needs.summary_trigger_type = 'turn_count';
        }
        
        // 명시적 요청 트리거
        const explicitTrigger = summaryTriggers.find(t => t.type === 'explicit_request');
        if (explicitTrigger && explicitTrigger.patterns) {
            const explicitConfidence = this.calculateMatchConfidence(message, explicitTrigger.patterns);
            if (explicitConfidence > 0.4) {
                needs.requires_summary = true;
                needs.summary_trigger_type = 'explicit_request';
            }
        }
        
        // 2. 개념 연결 필요성 분석
        const connectionPatterns = reflectiveConfig.connection_making?.previous_conversation_references?.patterns || [];
        if (connectionPatterns.some(pattern => message.includes(pattern))) {
            needs.requires_connection_making = true;
            needs.suggested_reflective_actions.push('connect_to_previous_concepts');
        }
        
        // 3. 메타인지적 성찰 필요성 분석
        const reflectionTriggers = [
            /어떻게.*했/,
            /왜.*그렇게/,
            /처음.*생각/,
            /다르게.*접근/,
            /배운.*것/
        ];
        
        const reflectionConfidence = this.calculateMatchConfidence(message, reflectionTriggers.map(r => r.source));
        if (reflectionConfidence > 0.3 || conversationHistory.length > 8) {
            needs.requires_metacognitive_reflection = true;
            needs.suggested_reflective_actions.push('encourage_thinking_process_review');
        }
        
        // 4. 학습 깊이에 따른 성찰 활동 제안
        const depthLevel = needs.conversation_context.learning_depth_level;
        if (depthLevel >= 3) {
            needs.suggested_reflective_actions.push('encourage_application_thinking');
        }
        if (depthLevel >= 4) {
            needs.suggested_reflective_actions.push('encourage_analysis_synthesis');
        }
        
        console.log('[성찰적 학습 분석 결과]', needs);
        return needs;
    }
    
    /**
     * 대화에서 주제 진행 양상을 분석합니다
     * @param {Array} conversationHistory - 대화 이력
     * @returns {Object} 주제 진행 분석 결과
     */
    static analyzeTopicProgression(conversationHistory) {
        if (conversationHistory.length < 3) {
            return { stage: 'initial', topics: [], transitions: 0 };
        }
        
        // 간단한 주제 변화 감지 (키워드 기반)
        const scienceKeywords = {
            energy: ['에너지', '힘', '속도', '운동'],
            gravity: ['중력', '무게', '떨어지', '높이'],
            friction: ['마찰', '저항', '표면', '거칠'],
            motion: ['움직', '굴러', '미끄러', '회전']
        };
        
        let topicTransitions = 0;
        let currentTopics = [];
        let previousTopic = null;
        
        conversationHistory.slice(-6).forEach(turn => {
            if (turn.role === 'user' && turn.parts && turn.parts[0]) {
                const text = turn.parts[0].text.toLowerCase();
                
                for (const [topic, keywords] of Object.entries(scienceKeywords)) {
                    if (keywords.some(keyword => text.includes(keyword))) {
                        if (previousTopic && previousTopic !== topic) {
                            topicTransitions++;
                        }
                        if (!currentTopics.includes(topic)) {
                            currentTopics.push(topic);
                        }
                        previousTopic = topic;
                        break;
                    }
                }
            }
        });
        
        return {
            stage: topicTransitions > 2 ? 'complex' : topicTransitions > 0 ? 'developing' : 'focused',
            topics: currentTopics,
            transitions: topicTransitions
        };
    }
    
    /**
     * 학생의 학습 깊이 수준을 평가합니다 (Bloom's Taxonomy 기반)
     * @param {string} message - 학생 메시지
     * @param {Array} conversationHistory - 대화 이력
     * @returns {number} 학습 깊이 수준 (1-6)
     */
    static assessLearningDepth(message, conversationHistory) {
        let depth = 1; // 기본값: 기억/회상 수준
        
        // Level 2: 이해/이해 (Comprehension)
        const comprehensionPatterns = [/왜/, /어떻게/, /무슨.*의미/, /.*뜻/];
        if (comprehensionPatterns.some(pattern => pattern.test(message))) {
            depth = Math.max(depth, 2);
        }
        
        // Level 3: 적용 (Application)
        const applicationPatterns = [/다른.*상황/, /만약.*라면/, /.*적용/, /일상.*에서/];
        if (applicationPatterns.some(pattern => pattern.test(message))) {
            depth = Math.max(depth, 3);
        }
        
        // Level 4: 분석 (Analysis)
        const analysisPatterns = [/.*분석/, /요인/, /원인.*결과/, /비교.*하면/, /차이점/];
        if (analysisPatterns.some(pattern => pattern.test(message))) {
            depth = Math.max(depth, 4);
        }
        
        // Level 5: 종합 (Synthesis)
        const synthesisPatterns = [/.*연결/, /결합.*하면/, /새로운.*방법/, /창의.*적/];
        if (synthesisPatterns.some(pattern => pattern.test(message))) {
            depth = Math.max(depth, 5);
        }
        
        // Level 6: 평가 (Evaluation)
        const evaluationPatterns = [/.*평가/, /장단점/, /더.*나은/, /.*비판/, /검증/];
        if (evaluationPatterns.some(pattern => pattern.test(message))) {
            depth = Math.max(depth, 6);
        }
        
        // 대화 이력의 복잡성도 고려
        const historyComplexity = Math.min(Math.floor(conversationHistory.length / 3), 2);
        depth = Math.min(depth + historyComplexity, 6);
        
        return depth;
    }
}

module.exports = ResponseAnalyzer;
