// firebase-messaging-sw.js
// Service Worker para receber notificações push do Firebase Cloud Messaging
// Mesmo com o app fechado no celular

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

// Exibe notificação quando o app está em BACKGROUND ou FECHADO
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? 'CasalPay 💞', {
    body: body ?? '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: 'casalpay-message',
    renotify: true,
    vibrate: [200, 100, 200],
  });
});
