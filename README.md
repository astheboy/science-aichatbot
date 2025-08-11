# 교사 코드 방식 AI 챗봇

## 프로젝트 개요

이 프로젝트는 **'교사 코드' 방식**으로 작동하는 AI 챗봇입니다. 여러 교사가 각자의 Google Gemini API 키를 사용하면서도, 학생들은 간단한 교사 코드만 입력하여 챗봇을 사용할 수 있습니다.

## 🏗️ 아키텍처

- **Frontend**: HTML, CSS, JavaScript (Vanilla JS)
- **Backend**: Firebase Functions (Node.js 20)
- **Database**: Firebase Firestore
- **Hosting**: Firebase Hosting
- **AI Model**: Google Gemini 1.5 Flash

## 🚀 배포된 사이트

- **메인 사이트**: https://science-aichatbot.web.app
- **관리자 페이지**: https://science-aichatbot.web.app/admin.html

## 📋 사용 방법

### 1. 교사 (개발자가 대신 등록)

1. **API 키 준비**: Google AI Studio에서 Gemini API 키를 발급받습니다.
2. **교사 등록**: `/admin.html` 페이지에서 교사 코드와 API 키를 등록합니다.
   - 교사 코드: `class2024a` (예시)
   - API 키: `AIzaSy...`
3. **학생들에게 코드 전달**: 등록된 교사 코드를 학생들에게 알려줍니다.

### 2. 학생

1. 메인 사이트에 접속합니다.
2. 우측 챗봇 영역에서 **교사 코드를 입력**하고 저장합니다.
3. 그래비트랙스 실험에 대해 AI 튜터와 대화를 나눕니다.

## 🔧 기술적 특징

### 보안성
- **API 키 숨김**: 학생들은 API 키를 직접 입력하지 않습니다.
- **서버사이드 처리**: 모든 AI 요청은 Firebase Functions에서 처리됩니다.
- **Firestore 보안 규칙**: 클라이언트에서 `teacher_keys` 컬렉션에 직접 접근할 수 없습니다.

### 확장성
- **다중 교사 지원**: 하나의 웹사이트에서 여러 교사가 각각의 API 키를 사용할 수 있습니다.
- **코드 기반 인증**: 복잡한 로그인 없이 간단한 코드로 접근합니다.

## 📊 예상 비용

1학급 20명, 월 150회 사용 기준:
- **Google AI (Gemini)**: 월 약 70원
- **Firebase**: 무료 (무료 제공량 내)
- **총 예상 비용**: **월 100원 미만**

## 🏁 다음 단계

1. **Firebase 콘솔 설정 완료**:
   - Firestore 데이터베이스 활성화
   - 보안 규칙 적용

2. **첫 번째 교사 등록**:
   - `/admin.html`에서 테스트 교사 등록

3. **테스트**:
   - 학생 입장에서 교사 코드 입력 후 챗봇 테스트

## 📁 파일 구조

```
# 🤖 Science AI Chatbot - 그래비트랙스 AI 튜터

초등학생들의 물리학 실험 학습을 돕는 AI 튜터 챗봇 시스템입니다.

## 🚀 주요 기능

### 👨‍🏫 교사용 기능
- **Google 로그인 기반 대시보드**: 안전한 OAuth 인증
- **API 키 관리**: 각자의 Gemini API 키로 개별 운영
- **커스텀 프롬프트**: AI 튜터의 성격과 교육 방식 맞춤 설정
- **교사 코드**: 학생들과 공유할 고유 코드 자동 생성

### 👨‍🎓 학생용 기능
- **간편한 접속**: 교사 코드만으로 AI 튜터와 대화 시작
- **실시간 AI 피드백**: 그래비트랙스 실험 관련 질문 응답
- **소크라테스식 학습**: 답을 직접 알려주지 않고 스스로 깨달을 수 있도록 유도

## 🔧 기술 스택

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Backend**: Firebase Functions (Node.js)
- **Database**: Firebase Firestore
- **AI**: Google Gemini API
- **Authentication**: Firebase Authentication (Google OAuth)
- **Hosting**: Firebase Hosting

## 🌐 배포 주소

- **메인 사이트**: https://science-aichatbot.web.app
- **교사 대시보드**: https://science-aichatbot.web.app/teacher.html
- **관리자 페이지**: https://science-aichatbot.web.app/admin.html

## 💰 운영 비용

### 1개 학급 (학생 20명) 기준
- **월간 예상 비용**: 약 100원 미만
- **10개 학급**: 월 약 700원

Firebase 무료 tier와 Gemini API의 저렴한 비용으로 거의 무료 운영이 가능합니다.

## 🛠 설치 및 실행

### 필수 요구사항
- Node.js (v14 이상)
- Firebase CLI
- Google Cloud Project (Gemini API 활성화)

### 로컬 개발 환경 설정

1. **저장소 클론**
   ```bash
   git clone https://github.com/astheboy/science-aichatbot.git
   cd science-aichatbot
   ```

2. **Firebase 설정**
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase init
   ```

3. **Functions 의존성 설치**
   ```bash
   cd functions
   npm install
   cd ..
   ```

4. **로컬 서버 실행**
   ```bash
   firebase serve
   # 또는 에뮬레이터 사용
   firebase emulators:start
   ```

### 배포
```bash
# Functions 배포
firebase deploy --only functions

# Hosting 배포  
firebase deploy --only hosting

# 전체 배포
firebase deploy
```

## 📁 프로젝트 구조

```
science-aichatbot/
├── public/                 # 프론트엔드 파일
│   ├── index.html          # 학생용 메인 페이지 (챗봇)
│   ├── teacher.html        # 교사용 대시보드
│   ├── admin.html          # 관리자 페이지
│   ├── api.js              # API 호출 함수
│   ├── chatbot.js          # 챗봇 로직
│   ├── firebase-config.js  # Firebase 설정
│   └── main.js             # 메인 스크립트
├── functions/              # Firebase Functions
│   ├── index.js            # Cloud Functions 코드
│   └── package.json        # 의존성 관리
├── devlog.md              # 개발 로그
├── README.md              # 프로젝트 설명
└── .gitignore             # Git 제외 파일
```

## 🎯 사용법

### 교사용
1. https://science-aichatbot.web.app/teacher.html 접속
2. Google 계정으로 로그인
3. Gemini API 키 등록 ([API 키 발급](https://aistudio.google.com/apikey))
4. 원하는 경우 프롬프트 커스터마이징
5. 생성된 교사 코드를 학생들에게 공유

### 학생용
1. https://science-aichatbot.web.app 접속
2. 교사가 제공한 코드 입력
3. 그래비트랙스 실험에 대해 AI 튜터와 대화

## 🤝 기여하기

1. Fork 프로젝트
2. Feature 브랜치 생성 (`git checkout -b feature/AmazingFeature`)
3. 변경사항 커밋 (`git commit -m 'Add some AmazingFeature'`)
4. 브랜치에 Push (`git push origin feature/AmazingFeature`)
5. Pull Request 오픈

## 📝 라이선스

이 프로젝트는 MIT 라이선스를 따릅니다. [LICENSE](LICENSE) 파일에서 자세한 내용을 확인할 수 있습니다.

## 📞 문의

프로젝트에 대한 문의사항이나 버그 리포트는 GitHub Issues를 통해 남겨주세요.

---

**개발**: AI Assistant with Human Collaboration  
**최종 업데이트**: 2025년 1월 11일
├── public/
│   ├── index.html          # 메인 페이지
│   ├── admin.html          # 교사 등록 페이지  
│   ├── firebase-config.js  # Firebase 설정
│   ├── api.js              # API 호출 로직
│   ├── chatbot.js          # 챗봇 로직
│   └── ... (기타 파일들)
├── functions/
│   ├── index.js            # Firebase Functions
│   └── package.json
├── firebase.json           # Firebase 설정
├── firestore.rules         # Firestore 보안 규칙
└── README.md
```

## 🎯 핵심 기능

### Cloud Functions
- `getTutorResponse`: 교사 코드로 API 키를 조회하고 Gemini API 호출
- `addTeacher`: 새로운 교사 코드와 API 키 등록

### 프론트엔드
- 교사 코드 입력 및 저장
- 실시간 AI 챗봇 대화
- 그래비트랙스 물리 학습 콘텐츠

이제 Firebase 콘솔에서 Firestore를 활성화하고 첫 번째 교사를 등록하면 완전히 작동하는 시스템이 됩니다!
