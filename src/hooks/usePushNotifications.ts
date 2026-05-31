import { useEffect } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db, COUPLE_ID, getFirebaseMessaging } from "../lib/firebase";
import type { User } from "firebase/auth";

// Chave VAPID gerada no Firebase Console → Project Settings → Cloud Messaging
const VAPID_KEY =
  "BFmyiHlDxClXadDlgDj-87L_stYeIEBhnvuDRQlPkXyC1wnntnUFhxNue7C_diTDsi-vlQCWQ96gNDCN-vmyVOM";

export function usePushNotifications(user: User | null): void {
  useEffect(() => {
    // Sai sem fazer nada se não houver usuário logado
    if (!user) return;
    // Sai se o browser não suportar notificações
    if (!("Notification" in window)) return;
    if (!("serviceWorker" in navigator)) return;

    let cancelled = false;

    const setup = async () => {
      try {
        // 1. Solicita permissão de notificação (só pergunta uma vez ao usuário)
        let permission = Notification.permission;
        if (permission === "default") {
          permission = await Notification.requestPermission();
        }
        if (permission !== "granted" || cancelled) return;

        // 2. Registra o service worker do FCM
        const swReg = await navigator.serviceWorker.register(
          "/firebase-messaging-sw.js",
          { scope: "/" }
        );

        const messaging = getFirebaseMessaging();
        if (!messaging || cancelled) return;

        // 3. Obtém o token FCM do dispositivo atual
        const token = await getToken(messaging, {
          vapidKey: VAPID_KEY,
          serviceWorkerRegistration: swReg,
        });

        if (!token || cancelled) return;

        // 4. Salva o token no Firestore, associado ao UID do usuário logado
        await setDoc(
          doc(db, "couples", COUPLE_ID, "fcm_tokens", user.uid),
          {
            token,
            email: user.email,
            uid: user.uid,
            updatedAt: serverTimestamp(),
            platform: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
              ? "mobile"
              : "desktop",
          },
          { merge: true }
        );

        // 5. Exibe notificações quando o app estiver em FOREGROUND (aberto na tela)
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

        // Limpa o listener quando o componente desmontar
        return unsubscribe;
      } catch (err) {
        if (!cancelled) {
          console.warn("[FCM] Falha ao registrar push notifications:", err);
        }
      }
    };

    let cleanup: (() => void) | undefined;
    setup().then((fn) => {
      if (fn) cleanup = fn;
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [user]);
}
