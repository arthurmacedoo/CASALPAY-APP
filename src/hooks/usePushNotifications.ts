import { useEffect, useState, useCallback } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "../lib/firebase";
import type { User } from "firebase/auth";

// A chave VAPID agora é injetada via Vercel Environment Variables
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

export function usePushNotifications(user: User | null) {
  const [permission, setPermission] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied"
  );

  const setupPush = useCallback(async () => {
    if (!user) return;
    if (!("Notification" in window)) return;
    if (!("serviceWorker" in navigator)) return;

    if (Notification.permission !== "granted") return;

    try {
      // 1. Registra o service worker do FCM
      const swReg = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: "/" }
      );

      const messaging = getFirebaseMessaging();
      if (!messaging) return;

      // 2. Obtém o token FCM do dispositivo atual
      if (!VAPID_KEY) {
        alert("⚠️ VAPID_KEY ausente! Por favor, configure VITE_FIREBASE_VAPID_KEY no painel da Vercel.");
        return;
      }

      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg,
      }).catch(err => {
        alert("Erro getToken: " + err.message);
        return null;
      });

      if (!token) {
        alert("Falha: Token gerado foi nulo.");
        console.warn("[FCM] getToken retornou nulo.");
        return;
      }
      
      // 3. Salva o token chamando a nossa API serverless (bypassa regras do Firestore client)
      try {
        const platformStr = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";
        const response = await fetch("/api/register-device", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            email: user.email,
            uid: user.uid,
            platform: platformStr
          }),
        });
        
        if (response.ok) {
          alert("Sucesso! Token salvo no banco via API.");
          console.log("[FCM] Token salvo no banco com sucesso via API!");
        } else {
          const errText = await response.text();
          alert("Erro na API ao salvar token: " + errText);
          console.error("[FCM] API falhou ao salvar token:", errText);
        }
      } catch (apiErr: any) {
        alert("Erro de rede ao salvar token: " + apiErr.message);
        console.error("[FCM] Erro na requisição para /api/register-device:", apiErr);
      }

      // 4. Exibe notificações quando o app estiver em FOREGROUND (aberto na tela)
      const unsubscribe = onMessage(messaging, (payload) => {
        const { title, body } = payload.notification ?? {};
        if (!title) return;
        // Usa a Notifications API nativamente
        if (Notification.permission === "granted") {
          new Notification(title, {
            body: body ?? "",
            icon: "/icon-192.png",
            badge: "/icon-192.png",
            tag: "casalpay-love",
          });
        }
      });

      return unsubscribe;
    } catch (err) {
      console.warn("[FCM] Falha ao configurar push notifications:", err);
    }
  }, [user]);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === "granted") {
        setupPush();
      }
    } catch (err) {
      console.error("Erro ao solicitar permissão", err);
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    if (permission === "granted") {
      setupPush().then((unsub) => {
        if (unsub) unsubscribe = unsub;
      });
    }
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [permission, setupPush]);

  return { permission, requestPermission };
}
