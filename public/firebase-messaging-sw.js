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
// O onBackgroundMessage chama showNotification manualmente — única forma garantida no iOS.
messaging.onBackgroundMessage(function(payload) {
  const title = (payload.data && payload.data.title) || 'CasalPay 💞';
  const body  = (payload.data && payload.data.body)  || '💌';

  self.registration.showNotification(title, {
    body:     body,
    icon:     '/icon-192.png',
    badge:    '/icon-192.png',
    tag:      'casalpay-love',
    renotify: true,
    data:     { url: self.registration.scope },
  });
});

// Abre o app ao tocar na notificação
self.addEventListener('notificationclick', function(event) {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    || self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(windowClients) {
      // Se o app já estiver aberto, foca nele
      for (var i = 0; i < windowClients.length; i++) {
        var client = windowClients[i];
        if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
          return client.focus();
        }
      }
      // Senão, abre uma nova janela
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
