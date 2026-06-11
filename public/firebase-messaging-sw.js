// firebase-messaging-sw.js
// Service Worker do Firebase Cloud Messaging — escopo isolado do SW do PWA/Workbox.
// O SDK FCM exibe as notificações automaticamente ao receber payloads com a chave "notification".
// NÃO usar onBackgroundMessage + showNotification — isso duplicaria as notificações.
// O fcmOptions.link no backend já cuida do clique → abre /messages.

importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBf61F6ftrRoGznbv0CS5ArlJCzDsK1Dhc",
  authDomain: "casalpay.firebaseapp.com",
  projectId: "casalpay",
  storageBucket: "casalpay.firebasestorage.app",
  messagingSenderId: "590507010136",
  appId: "1:590507010136:web:61e8d93e39bc0c6244422d",
});

const messaging = firebase.messaging();
