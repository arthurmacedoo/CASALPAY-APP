// firebase-messaging-sw.js
// Service Worker EXCLUSIVO para Firebase Cloud Messaging.
// Escopo: /firebase-cloud-messaging-push-scope (isolado do SW do PWA/Workbox)

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

// Exibe notificação quando o app está em BACKGROUND ou FECHADO.
// "notification" na raiz é obrigatório para a Apple entregar Web Push.
messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  if (!title) return;

  self.registration.showNotification(title, {
    body: body ?? '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'casalpay-love',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: '/messages' },
  });
});

// Abre /messages ao tocar na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = (event.notification.data && event.notification.data.url)
    ? new URL(event.notification.data.url, self.location.origin).href
    : self.location.origin + '/messages';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
