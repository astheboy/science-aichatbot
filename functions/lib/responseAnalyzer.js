const SubjectLoader = require('./subjectLoader');

/**
 * JSON 설정 기반 학생 응답 분석 시스템
 */
class ResponseAnalyzer {
    
    /**
     * 과목별 JSON 설정을 기반으로 학생 응답을 분석합니다
     * @param {string} userMessage - 학생 메시지
     * @param {string} subject - 과목명 (korean, math, science, social)
     * @param {Array} conversationHistory - 대화 이력 (선택사항)
     * @returns {Object} 분석 결과 { type, config, confidence }
     */
    static async analyzeStudentResponse(userMessage, subject = 'science', conversationHistory = []) {
        try {
            console.log(`[응답 분석 시작] 과목: ${subject}, 메시지: "${userMessage}"`);
            
            // 과목별 설정 로드
            const subjectConfig = await SubjectLoader.loadSubjectConfig(subject);
            const responseTypes = subjectConfig.response_types;
            
            console.log(`[응답 분석] 로드된 응답 유형들:`, Object.keys(responseTypes));
            
            // 메시지 전처리
            const processedMessage = this.preprocessMessage(userMessage);
            
            console.log(`[응답 분석] 전처리된 메시지: "${processedMessage}"`);
            
            // 각 응답 유형별로 매칭 점수 계산
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
                }
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
}

module.exports = ResponseAnalyzer;
