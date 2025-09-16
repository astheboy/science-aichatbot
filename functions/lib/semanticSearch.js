const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * 의미적 유사도 기반 학습 자료 검색 시스템
 * 학생 질문과 자료 내용 간의 관련성을 분석하여 최적의 자료를 추천합니다
 */
class SemanticSearch {
    
    /**
     * 학생 질문과 가장 관련성 높은 자료 내용을 찾습니다
     * @param {string} studentQuestion - 학생의 질문
     * @param {Array} extractedResources - 추출된 자료 내용들
     * @param {string} apiKey - Gemini API 키
     * @param {Object} context - 추가 맥락 (과목, 응답 유형 등)
     * @returns {Array} 관련성 순으로 정렬된 자료 내용들
     */
    static async findRelevantContent(studentQuestion, extractedResources, apiKey, context = {}) {
        try {
            console.log(`[SemanticSearch] 관련 자료 검색 시작 - 질문: "${studentQuestion.substring(0, 50)}..."`);
            
            if (!extractedResources || extractedResources.length === 0) {
                console.log('[SemanticSearch] 검색할 자료가 없습니다.');
                return [];
            }
            
            // 성공적으로 추출된 자료만 필터링
            const validResources = extractedResources.filter(r => r.success && r.extractedContent && r.extractedContent.text);
            
            if (validResources.length === 0) {
                console.log('[SemanticSearch] 유효한 추출 자료가 없습니다.');
                return [];
            }
            
            // 각 자료에 대해 관련성 점수 계산
            const scoredResources = await Promise.all(
                validResources.map(async (resource) => {
                    const relevanceScore = await this.calculateRelevance(
                        studentQuestion, 
                        resource, 
                        apiKey, 
                        context
                    );
                    
                    return {
                        ...resource,
                        relevanceScore,
                        // 관련성 높은 콘텐츠 청크 선별
                        relevantChunks: this.selectRelevantChunks(
                            resource.contentChunks, 
                            studentQuestion, 
                            resource.keywords
                        )
                    };
                })
            );
            
            // 관련성 점수로 정렬 (높은 순)
            const sortedResources = scoredResources
                .filter(r => r.relevanceScore > 0.3) // 최소 임계값 이상만 선택
                .sort((a, b) => b.relevanceScore - a.relevanceScore);
            
            console.log(`[SemanticSearch] 관련 자료 ${sortedResources.length}개 발견`);
            sortedResources.forEach((r, i) => {
                console.log(`  ${i + 1}. ${r.resource.title}: ${(r.relevanceScore * 100).toFixed(1)}%`);
            });
            
            return sortedResources;
            
        } catch (error) {
            console.error('[SemanticSearch] 자료 검색 중 오류:', error);
            return [];
        }
    }
    
    /**
     * AI를 활용한 질문-자료 간 관련성 점수 계산
     * @param {string} question - 학생 질문
     * @param {Object} resource - 추출된 자료
     * @param {string} apiKey - API 키
     * @param {Object} context - 추가 맥락
     * @returns {number} 관련성 점수 (0-1)
     */
    static async calculateRelevance(question, resource, apiKey, context) {
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            
            const content = resource.extractedContent.text;
            const title = resource.resource.title;
            const keywords = resource.keywords.join(', ');
            
            const analysisPrompt = `
학생의 질문과 학습 자료 간의 관련성을 0.0에서 1.0 사이의 점수로 평가해주세요.

### 맥락 정보 ###
- 과목: ${context.subject || '일반'}
- 학습 단계: ${context.responseType || '일반'}
- 학년: ${context.gradeLevel || '미지정'}

### 학생 질문 ###
"${question}"

### 학습 자료 정보 ###
제목: ${title}
키워드: ${keywords}
내용 요약: ${content.substring(0, 500)}${content.length > 500 ? '...' : ''}

### 평가 기준 ###
1.0 - 직접적으로 질문에 답할 수 있는 핵심 자료
0.8 - 질문과 매우 관련성이 높은 자료
0.6 - 질문과 관련성이 있는 보충 자료
0.4 - 간접적으로 도움이 될 수 있는 자료
0.2 - 약간의 관련성이 있는 자료
0.0 - 질문과 전혀 관련 없는 자료

### 분석 요청 ###
위 기준에 따라 관련성 점수를 평가하고, 다음 형식으로 응답해주세요:

점수: [0.0~1.0의 숫자]
근거: [한 줄 설명]

예시:
점수: 0.8
근거: 분수 나눗셈의 핵심 개념을 다루고 있어 학생 질문과 직접적으로 관련됨
            `.trim();
            
            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
                generationConfig: { 
                    temperature: 0.1, // 일관성 있는 평가를 위해 낮은 온도
                    maxOutputTokens: 150
                }
            });
            
            const response = result.response.text();
            
            // 점수 추출
            const scoreMatch = response.match(/점수:\s*([0-9]*\.?[0-9]+)/);
            const score = scoreMatch ? parseFloat(scoreMatch[1]) : 0.0;
            
            // 근거 추출
            const reasonMatch = response.match(/근거:\s*(.+)/);
            const reason = reasonMatch ? reasonMatch[1].trim() : '분석 실패';
            
            console.log(`[SemanticSearch] ${title} → 점수: ${score}, 근거: ${reason}`);
            
            return Math.max(0, Math.min(1, score)); // 0-1 범위 보장
            
        } catch (error) {
            console.error('[SemanticSearch] 관련성 계산 실패:', error);
            
            // AI 분석 실패 시 폴백: 키워드 기반 단순 매칭
            return this.fallbackKeywordMatching(question, resource);
        }
    }
    
    /**
     * 폴백: 키워드 기반 단순 유사도 계산
     * @param {string} question - 학생 질문
     * @param {Object} resource - 자료
     * @returns {number} 키워드 매칭 점수
     */
    static fallbackKeywordMatching(question, resource) {
        try {
            const questionWords = question.match(/[가-힣a-zA-Z0-9]{2,}/g) || [];
            const resourceKeywords = resource.keywords || [];
            const resourceTitle = resource.resource.title || '';
            const resourceText = resource.extractedContent.text || '';
            
            let matchCount = 0;
            const totalWords = questionWords.length;
            
            if (totalWords === 0) return 0.1;
            
            questionWords.forEach(word => {
                // 제목에서 매칭 (가중치 2배)
                if (resourceTitle.includes(word)) {
                    matchCount += 2;
                }
                // 키워드에서 매칭 (가중치 1.5배)
                else if (resourceKeywords.some(keyword => keyword.includes(word) || word.includes(keyword))) {
                    matchCount += 1.5;
                }
                // 본문에서 매칭 (기본 가중치)
                else if (resourceText.includes(word)) {
                    matchCount += 1;
                }
            });
            
            const score = Math.min(matchCount / (totalWords * 2), 1.0);
            console.log(`[SemanticSearch] 폴백 매칭 - ${resource.resource.title}: ${score.toFixed(2)}`);
            
            return score;
            
        } catch (error) {
            console.error('[SemanticSearch] 폴백 매칭 실패:', error);
            return 0.1;
        }
    }
    
    /**
     * 관련성 높은 콘텐츠 청크를 선별합니다
     * @param {Array} chunks - 콘텐츠 청크들
     * @param {string} question - 학생 질문
     * @param {Array} keywords - 자료 키워드들
     * @returns {Array} 선별된 청크들
     */
    static selectRelevantChunks(chunks, question, keywords) {
        if (!chunks || chunks.length === 0) return [];
        
        const questionWords = question.match(/[가-힣a-zA-Z0-9]{2,}/g) || [];
        
        return chunks
            .map(chunk => {
                let relevanceScore = 0;
                
                // 질문 단어들과의 매칭 정도 계산
                questionWords.forEach(word => {
                    const regex = new RegExp(word, 'gi');
                    const matches = (chunk.match(regex) || []).length;
                    relevanceScore += matches;
                });
                
                // 키워드와의 매칭 정도 계산
                keywords.forEach(keyword => {
                    if (chunk.includes(keyword)) {
                        relevanceScore += 2; // 키워드는 가중치 부여
                    }
                });
                
                return {
                    text: chunk,
                    relevanceScore
                };
            })
            .filter(chunk => chunk.relevanceScore > 0)
            .sort((a, b) => b.relevanceScore - a.relevanceScore)
            .slice(0, 3) // 상위 3개 청크만 선택
            .map(chunk => chunk.text);
    }
    
    /**
     * 학습 상황에 맞는 자료 우선순위 조정
     * @param {Array} relevantResources - 관련 자료들
     * @param {Object} learningContext - 학습 맥락
     * @returns {Array} 우선순위 조정된 자료들
     */
    static adjustPriorityByLearningContext(relevantResources, learningContext) {
        const { responseType, difficultyLevel, previousAttempts } = learningContext;
        
        return relevantResources.map(resource => {
            let adjustedScore = resource.relevanceScore;
            
            // 응답 유형별 우선순위 조정
            if (responseType === 'EXPLORATION_DEADLOCK') {
                // 막힌 상황: 더 기초적이고 시각적인 자료 우선
                if (resource.resource.type === 'link' && 
                    (resource.resource.title.includes('동영상') || resource.resource.title.includes('시각'))) {
                    adjustedScore += 0.2;
                }
            } else if (responseType === 'SUCCESS_WITHOUT_PRINCIPLE') {
                // 원리 이해 필요: 이론적 설명이 포함된 자료 우선
                if (resource.extractedContent.text.includes('원리') || 
                    resource.extractedContent.text.includes('이론')) {
                    adjustedScore += 0.15;
                }
            }
            
            // 시도 횟수별 조정
            if (previousAttempts > 2) {
                // 여러 번 시도한 경우: 다른 접근법의 자료 우선
                adjustedScore += 0.1;
            }
            
            return {
                ...resource,
                adjustedScore: Math.min(adjustedScore, 1.0)
            };
        }).sort((a, b) => b.adjustedScore - a.adjustedScore);
    }
}

module.exports = SemanticSearch;