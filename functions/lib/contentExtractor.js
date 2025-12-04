const admin = require('firebase-admin');
const pdfParse = require('pdf-parse');
const { createWorker } = require('tesseract.js');
const cheerio = require('cheerio');
const axios = require('axios');
const crypto = require('crypto');

/**
 * 학습 자료 내용 추출 시스템
 * PDF, 이미지(OCR), 텍스트 파일의 실제 내용을 추출합니다
 * Firestore 캐싱을 지원하여 반복적인 추출 작업을 방지합니다.
 */
class ContentExtractor {
    
    /**
     * 자료 내용을 추출하고 캐싱합니다. (권장 사용 메서드)
     * @param {Object} db - Firestore 인스턴스
     * @param {Object} resource - 자료 객체
     * @returns {Object} 추출된 내용
     */
    static async extractAndCacheContent(db, resource) {
        try {
            // 1. 캐시 키 생성 (URL 기반 해시)
            const cacheKey = this.generateCacheKey(resource.url);
            const cacheRef = db.collection('resource_cache').doc(cacheKey);
            
            // 2. 캐시 확인
            const cacheDoc = await cacheRef.get();
            if (cacheDoc.exists) {
                const cacheData = cacheDoc.data();
                // 캐시 유효기간 체크 (예: 30일)
                const cacheAge = Date.now() - cacheData.cachedAt.toDate().getTime();
                const MAX_CACHE_AGE = 30 * 24 * 60 * 60 * 1000;
                
                if (cacheAge < MAX_CACHE_AGE) {
                    console.log(`[ContentExtractor] 캐시 히트: ${resource.title} (${cacheKey})`);
                    return {
                        ...cacheData.result,
                        fromCache: true
                    };
                }
            }
            
            // 3. 캐시 미스 - 실제 추출 수행
            console.log(`[ContentExtractor] 캐시 미스 - 추출 시작: ${resource.title}`);
            const result = await this.extractContent(resource);
            
            // 4. 성공 시 캐시 저장
            if (result.success) {
                await cacheRef.set({
                    url: resource.url,
                    type: resource.type,
                    title: resource.title || '',
                    result: result,
                    cachedAt: admin.firestore.FieldValue.serverTimestamp(),
                    hash: cacheKey
                });
                console.log(`[ContentExtractor] 캐시 저장 완료: ${cacheKey}`);
            }
            
            return {
                ...result,
                fromCache: false
            };
            
        } catch (error) {
            console.error(`[ContentExtractor] 캐싱 처리 중 오류:`, error);
            // 캐싱 오류가 발생해도 추출은 시도하거나, 이미 추출된 결과를 반환
            return await this.extractContent(resource);
        }
    }

    /**
     * URL 기반 고유 해시 생성
     */
    static generateCacheKey(url) {
        return crypto.createHash('md5').update(url).digest('hex');
    }

    /**
     * 파일 유형에 따른 내용 추출 라우터
     * @param {Object} resource - 자료 객체 {type, url, fileName, title}
     * @returns {Object} 추출된 내용과 메타데이터
     */
    static async extractContent(resource) {
        try {
            console.log(`[ContentExtractor] 자료 내용 추출 시작: ${resource.title}`);
            
            if (resource.type === 'link') {
                return await this.extractWebContent(resource);
            } else if (resource.type === 'file') {
                return await this.extractFileContent(resource);
            }
            
            throw new Error(`지원하지 않는 자료 유형: ${resource.type}`);
            
        } catch (error) {
            console.error(`[ContentExtractor] 추출 실패: ${resource.title}`, error);
            return this.createErrorResult(resource, error.message);
        }
    }
    
    /**
     * 파일 내용 추출 (PDF, 이미지, 텍스트)
     * @param {Object} resource - 파일 자료 객체
     * @returns {Object} 추출 결과
     */
    static async extractFileContent(resource) {
        const { url, fileName, title } = resource;
        
        // Firebase Storage에서 파일 다운로드
        const fileBuffer = await this.downloadFileFromStorage(url);
        const fileExtension = this.getFileExtension(fileName);
        
        let extractedText = '';
        let metadata = {
            fileType: fileExtension,
            fileSize: fileBuffer.length,
            extractionMethod: ''
        };
        
        switch (fileExtension.toLowerCase()) {
            case 'pdf':
                const pdfResult = await this.extractFromPDF(fileBuffer);
                extractedText = pdfResult.text;
                metadata.extractionMethod = 'pdf-parse';
                metadata.pageCount = pdfResult.numpages;
                break;
                
            case 'jpg':
            case 'jpeg':
            case 'png':
            case 'gif':
                extractedText = await this.extractFromImage(fileBuffer);
                metadata.extractionMethod = 'tesseract-ocr';
                break;
                
            case 'txt':
                extractedText = fileBuffer.toString('utf-8');
                metadata.extractionMethod = 'direct-text';
                break;
                
            default:
                throw new Error(`지원하지 않는 파일 형식: ${fileExtension}`);
        }
        
        return this.createSuccessResult(resource, extractedText, metadata);
    }
    
    /**
     * PDF 파일에서 텍스트 추출
     * @param {Buffer} buffer - PDF 파일 버퍼
     * @returns {Object} PDF 파싱 결과
     */
    static async extractFromPDF(buffer) {
        try {
            const data = await pdfParse(buffer);
            console.log(`[ContentExtractor] PDF 추출 완료: ${data.numpages}페이지, ${data.text.length}자`);
            return data;
        } catch (error) {
            console.error('[ContentExtractor] PDF 추출 실패:', error);
            throw new Error('PDF 파일을 읽을 수 없습니다.');
        }
    }
    
    /**
     * 이미지에서 OCR을 통한 텍스트 추출
     * @param {Buffer} buffer - 이미지 파일 버퍼
     * @returns {string} 추출된 텍스트
     */
    static async extractFromImage(buffer) {
        try {
            console.log('[ContentExtractor] OCR extraction started...');
            const worker = await createWorker('kor');
            await worker.setParameters({
                tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz가-힣ㄱ-ㅎㅏ-ㅣ ',
            });
            
            const { data: { text } } = await worker.recognize(buffer);
            await worker.terminate();
            
            console.log(`[ContentExtractor] OCR extraction complete: ${text.length} chars`);
            return text.trim();
        } catch (error) {
            console.error('[ContentExtractor] OCR extraction failed:', error);
            // OCR 실패 시 에러를 던지지 않고 대체 텍스트 반환 (시스템 안정성)
            return "이미지 텍스트 추출 실패 (OCR 오류)";
        }
    }
    
    /**
     * 웹페이지 내용 추출
     * @param {Object} resource - 웹링크 자료 객체
     * @returns {Object} 추출 결과
     */
    static async extractWebContent(resource) {
        try {
            const { url, title } = resource;
            
            // 안전한 URL인지 확인
            if (!this.isValidUrl(url)) {
                throw new Error('유효하지 않은 URL입니다.');
            }
            
            console.log(`[ContentExtractor] 웹페이지 스크래핑 시작: ${url}`);
            
            // HTTP 요청으로 웹페이지 가져오기
            const response = await axios.get(url, {
                timeout: 10000, // 10초 타임아웃
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; EducationBot/1.0)'
                },
                maxContentLength: 5 * 1024 * 1024 // 5MB 제한
            });
            
            const html = response.data;
            const $ = cheerio.load(html);
            
            // 메타데이터 추출
            const metadata = {
                title: $('title').text().trim() || title,
                description: $('meta[name="description"]').attr('content') || '',
                keywords: $('meta[name="keywords"]').attr('content') || '',
                author: $('meta[name="author"]').attr('content') || '',
                publishedTime: $('meta[property="article:published_time"]').attr('content') || '',
                url: url,
                extractionMethod: 'web-scraping'
            };
            
            // 주요 콘텐츠 추출 (다양한 선택자 시도)
            let mainContent = '';
            const contentSelectors = [
                'article',
                '.content',
                '.post-content',
                '.entry-content', 
                '.article-body',
                'main',
                '#content',
                '.container .text',
                'body'
            ];
            
            for (const selector of contentSelectors) {
                const element = $(selector).first();
                if (element.length > 0) {
                    // 불필요한 요소 제거
                    element.find('script, style, nav, header, footer, .ad, .advertisement, .sidebar').remove();
                    
                    mainContent = element.text().trim();
                    if (mainContent.length > 100) { // 의미있는 내용이 있으면 선택
                        console.log(`[ContentExtractor] 콘텐츠 추출 성공 (${selector}): ${mainContent.length}자`);
                        break;
                    }
                }
            }
            
            if (!mainContent || mainContent.length < 50) {
                throw new Error('웹페이지에서 의미있는 내용을 찾을 수 없습니다.');
            }
            
            // 텍스트 정리 (연속된 공백, 줄바꿈 정리)
            mainContent = mainContent.replace(/\s+/g, ' ').trim();
            
            return this.createSuccessResult(resource, mainContent, metadata);
            
        } catch (error) {
            console.error(`[ContentExtractor] 웹 스크래핑 실패: ${resource.url}`, error.message);
            
            if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
                return this.createErrorResult(resource, '웹페이지에 접근할 수 없습니다.');
            } else if (error.response && error.response.status >= 400) {
                return this.createErrorResult(resource, `웹페이지 오류 (${error.response.status})`);
            } else {
                return this.createErrorResult(resource, error.message);
            }
        }
    }
    
    /**
     * URL 유효성 검사
     * @param {string} url - 검사할 URL
     * @returns {boolean} 유효성 여부
     */
    static isValidUrl(url) {
        try {
            const urlObj = new URL(url);
            // HTTP/HTTPS만 허용
            return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
        } catch {
            return false;
        }
    }
    
    /**
     * Firebase Storage에서 파일 다운로드
     * @param {string} url - Storage URL
     * @returns {Buffer} 파일 버퍼
     */
    static async downloadFileFromStorage(url) {
        try {
            const bucket = admin.storage().bucket();
            const filePath = this.extractPathFromUrl(url);
            const file = bucket.file(filePath);
            
            const [buffer] = await file.download();
            console.log(`[ContentExtractor] 파일 다운로드 완료: ${filePath} (${buffer.length} bytes)`);
            return buffer;
        } catch (error) {
            console.error('[ContentExtractor] 파일 다운로드 실패:', error);
            throw new Error('파일을 다운로드할 수 없습니다.');
        }
    }
    
    /**
     * Storage URL에서 파일 경로 추출
     * @param {string} url - Storage URL
     * @returns {string} 파일 경로
     */
    static extractPathFromUrl(url) {
        // Firebase Storage URL 패턴 분석하여 파일 경로 추출
        const urlParts = url.split('/');
        const encodedPath = urlParts[urlParts.length - 1].split('?')[0];
        return decodeURIComponent(encodedPath);
    }
    
    /**
     * 파일 확장자 추출
     * @param {string} fileName - 파일명
     * @returns {string} 확장자
     */
    static getFileExtension(fileName) {
        return fileName.split('.').pop() || '';
    }
    
    /**
     * 성공 결과 객체 생성
     * @param {Object} resource - 원본 자료 객체
     * @param {string} content - 추출된 내용
     * @param {Object} metadata - 메타데이터
     * @returns {Object} 결과 객체
     */
    static createSuccessResult(resource, content, metadata = {}) {
        return {
            success: true,
            resource: resource,
            extractedContent: {
                text: content,
                length: content.length,
                extractedAt: admin.firestore.FieldValue.serverTimestamp(),
                ...metadata
            },
            // 내용을 청크 단위로 분할 (검색 최적화)
            contentChunks: this.splitIntoChunks(content),
            // 키워드 추출 (기본적인 방법)
            keywords: this.extractKeywords(content)
        };
    }
    
    /**
     * 오류 결과 객체 생성
     * @param {Object} resource - 원본 자료 객체
     * @param {string} error - 오류 메시지
     * @returns {Object} 오류 결과 객체
     */
    static createErrorResult(resource, error) {
        return {
            success: false,
            resource: resource,
            error: error,
            extractedAt: admin.firestore.FieldValue.serverTimestamp()
        };
    }
    
    /**
     * 플레이스홀더 결과 객체 생성
     * @param {Object} resource - 원본 자료 객체
     * @param {string} message - 플레이스홀더 메시지
     * @returns {Object} 플레이스홀더 결과 객체
     */
    static createPlaceholderResult(resource, message) {
        return {
            success: true,
            resource: resource,
            extractedContent: {
                text: message,
                length: 0,
                extractedAt: admin.firestore.FieldValue.serverTimestamp(),
                extractionMethod: 'placeholder'
            },
            contentChunks: [],
            keywords: []
        };
    }
    
    /**
     * 긴 텍스트를 검색 가능한 청크로 분할
     * @param {string} text - 원본 텍스트
     * @param {number} chunkSize - 청크 크기 (기본 500자)
     * @returns {Array} 청크 배열
     */
    static splitIntoChunks(text, chunkSize = 500) {
        if (!text || text.length <= chunkSize) {
            return [text];
        }
        
        const chunks = [];
        for (let i = 0; i < text.length; i += chunkSize) {
            chunks.push(text.substring(i, i + chunkSize));
        }
        return chunks;
    }
    
    /**
     * 기본적인 키워드 추출 (추후 고도화 예정)
     * @param {string} text - 원본 텍스트
     * @returns {Array} 키워드 배열
     */
    static extractKeywords(text) {
        if (!text) return [];
        
        // 한글 단어 추출 (2글자 이상)
        const koreanWords = text.match(/[가-힣]{2,}/g) || [];
        // 영문 단어 추출 (3글자 이상)
        const englishWords = text.match(/[a-zA-Z]{3,}/g) || [];
        // 숫자 패턴 추출
        const numbers = text.match(/\d+/g) || [];
        
        // 빈도수 기반 상위 키워드 선별
        const allWords = [...koreanWords, ...englishWords, ...numbers];
        const wordCount = {};
        
        allWords.forEach(word => {
            wordCount[word] = (wordCount[word] || 0) + 1;
        });
        
        // 빈도수 상위 10개 키워드 반환
        return Object.entries(wordCount)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 10)
            .map(([word]) => word);
    }
}

module.exports = ContentExtractor;