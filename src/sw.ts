/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

// ── Workbox: Pre-cache ────────────────────────────────────────────────────
clientsClaim();
self.skipWaiting();

// O Vite PWA injeta a lista de arquivos para pre-cache aqui
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// ── Firebase Messaging ──────────────────────────────────────────────────────
// Importa o SDK compat via CDN (funciona em SW sem module bundler)
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.0/firebase-messaging-compat.js');

// @ts-ignore
firebase.initializeApp({
  apiKey: 'AIzaSyBf61F6ftrRoGznbv0CS5ArlJCzDsK1Dhc',
  authDomain: 'casalpay.firebaseapp.com',
  projectId: 'casalpay',
  storageBucket: 'casalpay.firebasestorage.app',
  messagingSenderId: '590507010136',
  appId: '1:590507010136:web:61e8d93e39bc0c6244422d',
});

// @ts-ignore
const messaging = firebase.messaging();

// ESTRATÉGIA DATA-ONLY: o backend envia apenas webpush.data (sem notification na raiz).
// O onBackgroundMessage chama showNotification manualmente — única forma garantida no iOS PWA.
// @ts-ignore
messaging.onBackgroundMessage(function (payload: any) {
  const title = (payload.data && payload.data.title) || 'CasalPay 💞';
  const body  = (payload.data && payload.data.body)  || '💌';

  self.registration.showNotification(title, {
    body,
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    tag:   'casalpay-love',
    data:  { url: self.registration.scope },
  } as NotificationOptions);
});

// Abre o app ao tocar na notificação
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const targetUrl =
    (event.notification.data && event.notification.data.url) ||
    self.registration.scope;

  event.waitUntil(
    (self as any).clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients: any[]) => {
        for (const client of windowClients) {
          if (client.url.startsWith(self.registration.scope) && 'focus' in client) {
            return client.focus();
          }
        }
        return (self as any).clients.openWindow(targetUrl);
      })
  );
});
