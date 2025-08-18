/**
 * 게임화 시스템 관리 모듈
 * 국어, 수학, 사회, 과학 4개 과목의 특성을 반영한 경험치 및 성취 시스템
 */

// Firebase Admin은 index.js에서 이미 초기화되므로 여기서는 받아서 사용
let admin;
let db;

// 초기화 함수
function initialize(adminInstance) {
    admin = adminInstance;
    db = admin.firestore();
}

// 과목별 응답 유형에 따른 경험치 보상 설정
const EXP_REWARDS = {
    // 과학 과목 (실험과 탐구 중심)
    science: {
        'HYPOTHESIS_INQUIRY': 15,      // 가설 탐구: 과학적 사고의 핵심
        'FAILURE_REPORT': 12,          // 실패 보고: 실험 과정의 중요 부분
        'SUCCESS_WITHOUT_PRINCIPLE': 10, // 성공 후 원리 탐색
        'CONCEPT_QUESTION': 5,         // 개념 질문
        'EXPLORATION_DEADLOCK': 3,     // 탐구 교착 (격려)
        'DEFAULT': 2                   // 기본 대화
    },
    
    // 수학 과목 (논리적 사고와 문제 해결)
    math: {
        'PROBLEM_SOLVING_ATTEMPT': 15,  // 문제 해결 시도
        'PATTERN_DISCOVERY': 12,        // 패턴 발견
        'CALCULATION_ERROR': 8,          // 계산 오류 인식
        'CONCEPTUAL_CONFUSION': 5,       // 개념 혼동
        'FRUSTRATION_EXPRESSION': 3,     // 좌절 표현 (격려)
        'DEFAULT': 2                     // 기본 대화
    },
    
    // 국어 과목 (읽기, 쓰기, 표현력)
    korean: {
        'CRITICAL_INQUIRY': 15,          // 비판적 탐구: 깊이 있는 분석
        'INTERPRETATION_CONFUSION': 10,   // 해석 혼란: 다양한 관점 탐색
        'EXPRESSION_STRUGGLE': 8,         // 표현 어려움: 노력 인정
        'TEXT_COMPREHENSION_QUESTION': 5, // 텍스트 이해 질문
        'SURFACE_UNDERSTANDING': 3,       // 표면적 이해 (개선 여지)
        'DEFAULT': 2                      // 기본 대화
    },
    
    // 사회 과목 (사회 현상 이해와 비판적 사고)
    social: {
        'CRITICAL_THINKING': 15,         // 비판적 사고
        'CAUSE_EFFECT_ANALYSIS': 12,     // 인과관계 분석
        'HISTORICAL_CURIOSITY': 10,      // 역사적 호기심
        'CONCEPTUAL_QUESTION': 5,        // 개념적 질문
        'SIMPLE_MEMORIZATION': 3,        // 단순 암기 (발전 필요)
        'DEFAULT': 2                     // 기본 대화
    }
};

// 레벨업 공식 (피보나치 기반 - 점진적으로 어려워짐)
function getRequiredExp(level) {
    if (level <= 1) return 0;
    if (level === 2) return 50;
    if (level === 3) return 100;
    
    // 레벨 4부터는 피보나치 수열 기반 증가
    return Math.floor(50 * Math.pow(1.5, level - 1));
}

// 레벨에 따른 칭호 시스템
const LEVEL_TITLES = {
    1: { name: '탐구자', icon: '🌱', description: '학습의 첫걸음' },
    5: { name: '도전자', icon: '🌿', description: '꾸준한 성장' },
    10: { name: '연구원', icon: '🌳', description: '진지한 학습자' },
    15: { name: '전문가', icon: '🎓', description: '깊이 있는 이해' },
    20: { name: '학자', icon: '🏆', description: '탁월한 성취' },
    25: { name: '마스터', icon: '⭐', description: '최고의 경지' }
};

// 성취 시스템 정의
const ACHIEVEMENTS = {
    // 공통 성취
    first_question: { 
        name: '첫 질문', 
        icon: '❓', 
        expBonus: 10,
        description: '첫 번째 질문을 했어요!',
        condition: (stats) => stats.totalMessages === 1
    },
    
    active_learner: {
        name: '적극적 학습자',
        icon: '💪',
        expBonus: 30,
        description: '한 세션에서 10개 이상 대화',
        condition: (stats) => stats.sessionMessageCount >= 10
    },
    
    consistent_learner: {
        name: '꾸준한 학습자',
        icon: '📅',
        expBonus: 50,
        description: '3일 연속 학습',
        condition: (stats) => stats.consecutiveDays >= 3
    },
    
    // 과학 과목 전용 성취
    first_hypothesis: {
        name: '첫 가설',
        icon: '🔬',
        expBonus: 20,
        description: '첫 번째 가설을 세웠어요!',
        subject: 'science',
        condition: (stats) => stats.responseTypeCounts?.HYPOTHESIS_INQUIRY >= 1
    },
    
    failure_conqueror: {
        name: '실패 정복자',
        icon: '💡',
        expBonus: 40,
        description: '실패를 3번 극복했어요!',
        subject: 'science',
        condition: (stats) => stats.responseTypeCounts?.FAILURE_REPORT >= 3
    },
    
    // 수학 과목 전용 성취
    problem_solver: {
        name: '문제 해결사',
        icon: '🧮',
        expBonus: 25,
        description: '5개의 문제를 해결했어요!',
        subject: 'math',
        condition: (stats) => stats.responseTypeCounts?.PROBLEM_SOLVING_ATTEMPT >= 5
    },
    
    pattern_finder: {
        name: '패턴 발견자',
        icon: '🔢',
        expBonus: 35,
        description: '3개의 패턴을 발견했어요!',
        subject: 'math',
        condition: (stats) => stats.responseTypeCounts?.PATTERN_DISCOVERY >= 3
    },
    
    // 국어 과목 전용 성취
    critical_reader: {
        name: '비판적 독자',
        icon: '📚',
        expBonus: 30,
        description: '텍스트를 깊이 있게 분석했어요!',
        subject: 'korean',
        condition: (stats) => stats.responseTypeCounts?.CRITICAL_INQUIRY >= 2
    },
    
    expression_master: {
        name: '표현의 달인',
        icon: '✍️',
        expBonus: 25,
        description: '표현 어려움을 극복했어요!',
        subject: 'korean',
        condition: (stats) => stats.responseTypeCounts?.EXPRESSION_STRUGGLE >= 3
    },
    
    // 사회 과목 전용 성취
    social_thinker: {
        name: '사회적 사고자',
        icon: '🌍',
        expBonus: 30,
        description: '사회 현상을 비판적으로 분석했어요!',
        subject: 'social',
        condition: (stats) => stats.responseTypeCounts?.CRITICAL_THINKING >= 2
    },
    
    history_explorer: {
        name: '역사 탐험가',
        icon: '🏛️',
        expBonus: 25,
        description: '역사에 대한 호기심을 보였어요!',
        subject: 'social',
        condition: (stats) => stats.responseTypeCounts?.HISTORICAL_CURIOSITY >= 3
    }
};

class GamificationManager {
    /**
     * 경험치 계산 및 레벨업 처리
     */
    static async processExperience(sessionId, responseType, subject = 'science') {
        try {
            const sessionRef = db.collection('sessions').doc(sessionId);
            const sessionDoc = await sessionRef.get();
            
            if (!sessionDoc.exists) {
                console.error('세션을 찾을 수 없습니다:', sessionId);
                return null;
            }
            
            const sessionData = sessionDoc.data();
            const currentLevel = sessionData.level || 1;
            const currentExp = sessionData.exp || 0;
            
            // 과목별 경험치 보상 가져오기
            const subjectRewards = EXP_REWARDS[subject] || EXP_REWARDS.science;
            const expGained = subjectRewards[responseType] || subjectRewards.DEFAULT || 2;
            
            // 연속 학습 보너스 (같은 날 연속 대화)
            let bonusExp = 0;
            const messageCount = sessionData.messageCount || 0;
            if (messageCount > 0 && messageCount % 5 === 0) {
                bonusExp = 5; // 5개 메시지마다 보너스
            }
            
            const totalExpGained = expGained + bonusExp;
            const newExp = currentExp + totalExpGained;
            
            // 레벨업 체크
            let newLevel = currentLevel;
            let leveledUp = false;
            let nextLevelExp = getRequiredExp(currentLevel + 1);
            
            while (newExp >= nextLevelExp && newLevel < 100) {
                newLevel++;
                leveledUp = true;
                nextLevelExp = getRequiredExp(newLevel + 1);
            }
            
            // 레벨 칭호 확인
            let newTitle = null;
            if (leveledUp) {
                for (const [titleLevel, titleInfo] of Object.entries(LEVEL_TITLES)) {
                    if (newLevel >= parseInt(titleLevel) && 
                        (!sessionData.currentTitle || sessionData.currentTitle.level < parseInt(titleLevel))) {
                        newTitle = { ...titleInfo, level: parseInt(titleLevel) };
                    }
                }
            }
            
            // 업데이트 데이터 준비
            const updateData = {
                exp: newExp,
                level: newLevel,
                lastExpGain: totalExpGained,
                lastResponseType: responseType,
                expHistory: admin.firestore.FieldValue.arrayUnion({
                    amount: totalExpGained,
                    responseType: responseType,
                    timestamp: new Date().toISOString(),
                    bonusExp: bonusExp
                })
            };
            
            if (newTitle) {
                updateData.currentTitle = newTitle;
                updateData.unlockedTitles = admin.firestore.FieldValue.arrayUnion(newTitle.name);
            }
            
            // 세션 업데이트
            await sessionRef.update(updateData);
            
            return {
                expGained: totalExpGained,
                bonusExp: bonusExp,
                currentExp: newExp,
                currentLevel: newLevel,
                leveledUp: leveledUp,
                nextLevelExp: nextLevelExp,
                newTitle: newTitle,
                progressPercentage: Math.floor((newExp / nextLevelExp) * 100)
            };
            
        } catch (error) {
            console.error('경험치 처리 오류:', error);
            return null;
        }
    }
    
    /**
     * 성취 체크 및 보상
     */
    static async checkAchievements(sessionId, responseType, subject = 'science') {
        try {
            const sessionRef = db.collection('sessions').doc(sessionId);
            const sessionDoc = await sessionRef.get();
            
            if (!sessionDoc.exists) {
                return [];
            }
            
            const sessionData = sessionDoc.data();
            const unlockedAchievements = sessionData.achievements || [];
            const newAchievements = [];
            
            // 통계 준비
            const stats = {
                totalMessages: sessionData.messageCount || 0,
                sessionMessageCount: sessionData.messageCount || 0,
                responseTypeCounts: sessionData.responseTypeCounts || {},
                consecutiveDays: sessionData.consecutiveDays || 1
            };
            
            // 응답 유형 카운트 업데이트
            if (!stats.responseTypeCounts[responseType]) {
                stats.responseTypeCounts[responseType] = 0;
            }
            stats.responseTypeCounts[responseType]++;
            
            // 성취 조건 체크
            for (const [achievementId, achievement] of Object.entries(ACHIEVEMENTS)) {
                // 이미 달성한 성취는 건너뛰기
                if (unlockedAchievements.includes(achievementId)) {
                    continue;
                }
                
                // 과목별 성취 필터링
                if (achievement.subject && achievement.subject !== subject) {
                    continue;
                }
                
                // 조건 체크
                if (achievement.condition(stats)) {
                    newAchievements.push({
                        id: achievementId,
                        ...achievement,
                        unlockedAt: new Date().toISOString()
                    });
                }
            }
            
            // 새로운 성취가 있으면 업데이트
            if (newAchievements.length > 0) {
                const totalBonusExp = newAchievements.reduce((sum, a) => sum + a.expBonus, 0);
                
                await sessionRef.update({
                    achievements: admin.firestore.FieldValue.arrayUnion(...newAchievements.map(a => a.id)),
                    achievementHistory: admin.firestore.FieldValue.arrayUnion(...newAchievements),
                    exp: admin.firestore.FieldValue.increment(totalBonusExp),
                    responseTypeCounts: stats.responseTypeCounts
                });
                
                return newAchievements;
            }
            
            // 응답 유형 카운트만 업데이트
            await sessionRef.update({
                responseTypeCounts: stats.responseTypeCounts
            });
            
            return [];
            
        } catch (error) {
            console.error('성취 체크 오류:', error);
            return [];
        }
    }
    
    /**
     * 세션 초기화 (새 학생 시작 시)
     */
    static async initializeSession(sessionId, studentName, lessonData) {
        try {
            const sessionRef = db.collection('sessions').doc(sessionId);
            
            const initialData = {
                sessionId: sessionId,
                studentName: studentName,
                lessonCode: lessonData.lessonCode,
                lessonId: lessonData.lessonId,
                lessonTitle: lessonData.lessonTitle,
                subject: lessonData.subject || 'science',
                teacherCode: lessonData.teacherCode,
                
                // 게임화 초기값
                level: 1,
                exp: 0,
                achievements: [],
                currentTitle: LEVEL_TITLES[1],
                unlockedTitles: [LEVEL_TITLES[1].name],
                responseTypeCounts: {},
                expHistory: [],
                achievementHistory: [],
                
                // 세션 정보
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastActivity: admin.firestore.FieldValue.serverTimestamp(),
                messageCount: 0
            };
            
            await sessionRef.set(initialData, { merge: true });
            
            return {
                level: 1,
                exp: 0,
                currentTitle: LEVEL_TITLES[1],
                nextLevelExp: getRequiredExp(2)
            };
            
        } catch (error) {
            console.error('세션 초기화 오류:', error);
            return null;
        }
    }
    
    /**
     * 학습 통계 조회
     */
    static async getStudentStats(sessionId) {
        try {
            const sessionDoc = await db.collection('sessions').doc(sessionId).get();
            
            if (!sessionDoc.exists) {
                return null;
            }
            
            const data = sessionDoc.data();
            
            return {
                level: data.level || 1,
                exp: data.exp || 0,
                nextLevelExp: getRequiredExp((data.level || 1) + 1),
                progressPercentage: Math.floor(((data.exp || 0) / getRequiredExp((data.level || 1) + 1)) * 100),
                currentTitle: data.currentTitle || LEVEL_TITLES[1],
                achievements: data.achievementHistory || [],
                totalMessages: data.messageCount || 0,
                favoriteSubject: data.subject,
                responseTypeCounts: data.responseTypeCounts || {},
                recentExpGains: (data.expHistory || []).slice(-5)
            };
            
        } catch (error) {
            console.error('통계 조회 오류:', error);
            return null;
        }
    }
}

module.exports = {
    initialize,
    GamificationManager
};
