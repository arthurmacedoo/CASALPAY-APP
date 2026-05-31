// firebase-messaging-sw.js
// Service Worker para receber notificações push do Firebase Cloud Messaging
// IMPORTANTE: Não chamar showNotification manualmente aqui.
// Quando o payload contém "notification" na raiz (enviado pela Vercel),
// o Firebase SW v9+ exibe o banner automaticamente no iOS/Android.
// Chamar showNotification manualmente em cima disso faz o iOS cancelar ambos.

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

// NÃO registrar onBackgroundMessage aqui quando o payload já tem "notification" na raiz.
// O Firebase SDK já intercepta e exibe automaticamente o banner do sistema operacional.
// Registrar um handler manual duplica a chamada e o iOS silencia as duas por segurança.
//
// Deixe este arquivo como está. O banner nativo aparecerá automaticamente
// quando a Vercel enviar: { notification: { title, body }, webpush: { ... } }
