// firebase-messaging-sw.js
// Service Worker para receber notificações push do Firebase Cloud Messaging

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

// ESTRATÉGIA DATA-ONLY:
// O backend envia apenas "webpush.data" sem "notification" na raiz.
// Isso faz o Firebase SDK NÃO tentar exibir automaticamente (que não funciona no iOS PWA).
// Em vez disso, o onBackgroundMessage dispara aqui e chamamos showNotification manualmente.
// É a única forma garantida de exibir banners no iOS Safari PWA.
messaging.onBackgroundMessage(function(payload) {
  console.log('[SW] Push recebido em background:', payload);

  const title = (payload.data && payload.data.title) || 'CasalPay 💞';
  const body  = (payload.data && payload.data.body)  || 'Você recebeu um carinho! 💌';

  self.registration.showNotification(title, {
    body: body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'casalpay-love',
    renotify: true,
  });
});
