// webapp/firebase-init.js

// ВАЖНО: Это ваши уникальные ключи для подключения к Firebase.
const firebaseConfig = {
  apiKey: "AIzaSyDavpcqDzqarvZD_OMEEbYgJCl_2Q3Vd6s",
  authDomain: "plan-hero.firebaseapp.com",
  projectId: "plan-hero",
  storageBucket: "plan-hero.firebasestorage.app",
  messagingSenderId: "1028522869443",
  appId: "1:1028522869443:web:003628ceac5be984815876",
  measurementId: "G-QLNT16M8KS"
};

// Инициализируем Firebase
firebase.initializeApp(firebaseConfig);

// Создаем удобную ссылку на нашу базу данных Firestore
const db = firebase.firestore();

console.log("Firebase initialized!"); // Сообщение для проверки, что все работает
