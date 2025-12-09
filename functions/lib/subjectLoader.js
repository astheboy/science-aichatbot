const fs = require('fs').promises;
const path = require('path');

// JSON 설정 캐시
const configCache = new Map();

/**
 * 과목별 JSON 설정을 로드하고 캐시하는 시스템
 */
class SubjectLoader {
    
    /**
     * 과목별 설정 파일을 로드합니다
     * @param {string} subject - 과목명 (korean, math, science, social)
     * @returns {Object} 과목별 설정 객체
     */
    static async loadSubjectConfig(subject) {
        // 캐시에서 먼저 확인
        if (configCache.has(subject)) {
            console.log(`캐시에서 ${subject} 설정 로드`);
            return configCache.get(subject);
        }
        
        try {
            const configPath = path.join(__dirname, '..', 'prompts', `student_response_analysis_${subject}.json`);
            const configData = await fs.readFile(configPath, 'utf8');
            const config = JSON.parse(configData);
            
            // 설정 유효성 검증
            this.validateConfig(config);
            
            // 캐시에 저장
            configCache.set(subject, config);
            console.log(`${subject} 설정 파일 로드 완료`);
            
            return config;
        } catch (error) {
            console.error(`과목 설정 로드 실패: ${subject}`, error);
            
            // 기본 과학 설정으로 폴백
            if (subject !== 'science') {
                console.log('기본 과학 설정으로 폴백');
                return await this.loadSubjectConfig('science');
            }
            
            throw error;
        }
    }
    
    /**
     * 모든 지원 과목의 설정을 미리 로드합니다
     * @returns {Promise<void>}
     */
    static async preloadAllConfigs() {
        const subjects = ['korean', 'math', 'science', 'social', 'counseling'];
        const loadPromises = subjects.map(subject => this.loadSubjectConfig(subject));
        
        try {
            await Promise.all(loadPromises);
            console.log('모든 과목 설정 미리 로드 완료');
        } catch (error) {
            console.error('과목 설정 미리 로드 실패', error);
        }
    }
    
    /**
     * JSON 설정의 유효성을 검증합니다
     * @param {Object} config - 검증할 설정 객체
     */
    static validateConfig(config) {
        const requiredFields = [
            'subject',
            'subject_name', 
            'response_types',
            'theoretical_foundation',
            'conversation_context'
        ];
        
        for (const field of requiredFields) {
            if (!config[field]) {
                throw new Error(`필수 필드 누락: ${field}`);
            }
        }
        
        // response_types 구조 검증
        const responseTypes = config.response_types;
        for (const [typeKey, typeConfig] of Object.entries(responseTypes)) {
            if (!typeConfig.name || !typeConfig.patterns || !typeConfig.sample_prompts) {
                throw new Error(`응답 유형 '${typeKey}' 설정이 불완전합니다`);
            }
        }
        
        console.log(`${config.subject} 설정 검증 완료`);
    }
    
    /**
     * 특정 과목의 응답 유형 목록을 반환합니다
     * @param {string} subject - 과목명
     * @returns {Array} 응답 유형 키 배열
     */
    static async getResponseTypes(subject) {
        const config = await this.loadSubjectConfig(subject);
        return Object.keys(config.response_types);
    }
    
    /**
     * 특정 과목의 응답 유형 정보를 반환합니다
     * @param {string} subject - 과목명
     * @param {string} responseType - 응답 유형
     * @returns {Object} 응답 유형 설정 객체
     */
    static async getResponseTypeConfig(subject, responseType) {
        const config = await this.loadSubjectConfig(subject);
        return config.response_types[responseType] || config.response_types.DEFAULT;
    }
    
    /**
     * 과목별 적응형 전략을 반환합니다
     * @param {string} subject - 과목명
     * @param {string} level - 학습 수준 (beginner_level, intermediate_level, advanced_level 등)
     * @returns {Object} 적응형 전략 객체
     */
    static async getAdaptiveStrategy(subject, level) {
        const config = await this.loadSubjectConfig(subject);
        return config.adaptive_strategies[level] || config.adaptive_strategies.beginner_level;
    }
    
    /**
     * 과목별 평가 기준을 반환합니다
     * @param {string} subject - 과목명
     * @returns {Object} 평가 기준 객체
     */
    static async getAssessmentCriteria(subject) {
        const config = await this.loadSubjectConfig(subject);
        return config.assessment_criteria || {};
    }
    
    /**
     * 대화 맥락 설정을 반환합니다
     * @param {string} subject - 과목명
     * @returns {Object} 대화 맥락 설정 객체
     */
    static async getConversationContext(subject) {
        const config = await this.loadSubjectConfig(subject);
        return config.conversation_context;
    }
    
    /**
     * 캐시를 초기화합니다 (개발/테스트 용도)
     */
    static clearCache() {
        configCache.clear();
        console.log('설정 캐시 초기화 완료');
    }
    
    /**
     * 지원하는 모든 과목 목록을 반환합니다
     * @returns {Array} 지원 과목 배열
     */
    static getSupportedSubjects() {
        return ['korean', 'math', 'science', 'social', 'counseling'];
    }
    
    /**
     * 과목명을 한국어명으로 변환합니다
     * @param {string} subject - 영문 과목명
     * @returns {string} 한국어 과목명
     */
    static getSubjectDisplayName(subject) {
        const names = {
            korean: '국어',
            math: '수학', 
            science: '과학',
            social: '사회',
            counseling: '상담/감정케어'
        };
        return names[subject] || subject;
    }
}

module.exports = SubjectLoader;
