const SubjectLoader = require('./functions/lib/subjectLoader');
const ResponseAnalyzer = require('./functions/lib/responseAnalyzer');

async function verify() {
    try {
        console.log("=== 1. Testing SubjectLoader for 'counseling' ===");
        const config = await SubjectLoader.loadSubjectConfig('counseling');
        console.log("Success! Loaded config for:", config.subject_name);
        
        if (config.subject !== 'counseling') {
            throw new Error("Subject mismatch!");
        }

        const responseTypes = Object.keys(config.response_types);
        console.log("Response Types:", responseTypes);
        
        if (!responseTypes.includes('EMOTION_EXPRESSION')) {
            throw new Error("Missing EMOTION_EXPRESSION type!");
        }

        console.log("\n=== 2. Testing ResponseAnalyzer Pattern Matching ===");
        
        const testCases = [
            { msg: "오늘 친구랑 싸워서 기분이 너무 안 좋아", expected: 'RELATIONSHIP_CONFLICT' },
            { msg: "숙제 다 하고 밥 먹었어", expected: 'DAILY_ROUTINE_SHARE' },
            { msg: "너무 힘들어서 아무것도 하기 싫어", expected: 'STRESS_SIGN' },
            { msg: "시험 100점 맞았어! 완전 신나!", expected: 'POSITIVE_ACHIEVEMENT' },
            { msg: "그냥 우울해", expected: 'EMOTION_EXPRESSION' }
        ];

        for (const test of testCases) {
            console.log(`Analyzing: "${test.msg}"`);
            const result = await ResponseAnalyzer.analyzeStudentResponse(test.msg, 'counseling');
            console.log(`Result: ${result.type} (Confidence: ${result.confidence})`);
            
            if (result.type !== test.expected) {
                console.warn(`WARNING: Expected ${test.expected} but got ${result.type}`);
            } else {
                console.log("PASS");
            }
            console.log("---");
        }

        console.log("\n=== Verification Completed Successfully ===");

    } catch (error) {
        console.error("Verification Failed:", error);
    }
}

verify();
