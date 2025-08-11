// Firebase 설정
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Firebase 프로젝트 설정
const firebaseConfig = {
  apiKey: "AIzaSyD_EOWuMuWclKjC2UGsbNQRf9joFhugpoU",
  authDomain: "science-aichatbot.firebaseapp.com",
  projectId: "science-aichatbot",
  storageBucket: "science-aichatbot.firebasestorage.app",
  messagingSenderId: "435522764221",
  appId: "1:435522764221:web:343f466afcb0b6efef66d4",
  measurementId: "G-SG2BXFB50G"
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// Firebase 서비스들
export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, 'asia-northeast3');
