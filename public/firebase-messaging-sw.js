// firebase-messaging-sw.js
// Service Worker do Firebase Cloud Messaging — escopo isolado do SW do PWA/Workbox.
// O backend envia payloads data-only para que este service worker controle
// a exibição em background sem duplicar notificações do SDK FCM.
// O clique usa a rota enviada em data.url, normalmente /?view=pending.

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

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const data = payload.data || {};
  const notificationTitle = data.title || "CasalPay";
  const isPendingNotification =
    data.type === "pending-expense-registered" ||
    data.type === "pending-daily-reminder";
  const notificationOptions = {
    body: data.body,
    icon: data.icon || "/icon-192.png",
    badge: data.badge || (isPendingNotification ? "/pending-badge.svg" : "/icon-192.png"),
    tag: data.tag || "casalpay-msg",
    data: {
      url: data.url || "/messages",
    },
    vibrate: [200, 100, 200],
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || "/messages";
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if there is already a window/tab open with the target URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        // If so, just focus it.
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, then open the target URL in a new window/tab.
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
