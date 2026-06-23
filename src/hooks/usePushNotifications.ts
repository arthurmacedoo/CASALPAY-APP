import { useEffect, useState, useCallback } from "react";
import { getToken, onMessage } from "firebase/messaging";
import { getFirebaseMessaging } from "../lib/firebase";
import type { User } from "firebase/auth";
import toast from "react-hot-toast";
import { OWNER_NAME, PARTNER_NAME } from "../constants/couple";

// VITE_FIREBASE_VAPID_KEY deve estar configurado na Vercel e no .env local
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Escopo dedicado para o Service Worker do FCM — evita conflito com o SW do PWA/Workbox
const FCM_SW_SCOPE = "/firebase-cloud-messaging-push-scope";

export type PushStatus =
  | "idle"
  | "registering"
  | "registered"
  | "error";

export function usePushNotifications(user: User | null, activeGroupId: string | null) {
  const [permission, setPermission] = useState<NotificationPermission>(
    "Notification" in window ? Notification.permission : "denied"
  );
  const [pushStatus, setPushStatus] = useState<PushStatus>("idle");
  const [pushError, setPushError] = useState<string | null>(null);

  const setupPush = useCallback(async () => {
    if (!user || !activeGroupId) return;

    // ── Diagnóstico de pré-condições ──────────────────────────────────────────
    if (!("Notification" in window)) {
      console.warn("[FCM] Este browser não suporta Notification API.");
      return;
    }
    if (!("serviceWorker" in navigator)) {
      console.warn("[FCM] Este browser não suporta Service Workers.");
      return;
    }
    if (Notification.permission !== "granted") {
      console.log(`[FCM] Permissão atual: ${Notification.permission}. Aguardando concessão.`);
      return;
    }
    if (!VAPID_KEY) {
      const err = "VITE_FIREBASE_VAPID_KEY não configurado. Adicione nas variáveis de ambiente da Vercel.";
      console.error("[FCM] ⚠️ " + err);
      setPushError(err);
      setPushStatus("error");
      return;
    }

    setPushStatus("registering");
    setPushError(null);

    try {
      // 1. Registra o SW do FCM com escopo dedicado (sem conflito com PWA/Workbox)
      console.log("[FCM] Registrando Service Worker em escopo:", FCM_SW_SCOPE);
      const swReg = await navigator.serviceWorker.register(
        "/firebase-messaging-sw.js",
        { scope: FCM_SW_SCOPE }
      );
      console.log("[FCM] ✅ SW registrado:", swReg.scope);

      const messaging = getFirebaseMessaging();
      if (!messaging) {
        console.error("[FCM] Firebase Messaging não disponível neste contexto.");
        setPushStatus("error");
        setPushError("Firebase Messaging não disponível.");
        return;
      }

      // 2. Obtém o token FCM usando EXATAMENTE o SW que acabamos de registrar
      console.log("[FCM] Solicitando token FCM com VAPID_KEY...");
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: swReg,
      }).catch((err: Error) => {
        console.error("[FCM] ❌ getToken falhou:", err.message);
        return null;
      });

      if (!token) {
        const errMsg = "Não foi possível obter o token FCM. Verifique as permissões e a VAPID key.";
        console.warn("[FCM] " + errMsg);
        setPushStatus("error");
        setPushError(errMsg);
        return;
      }

      console.log(`[FCM] ✅ Token obtido: ...${token.slice(-12)}`);

      // 3. Envia o token para a API serverless salvar no Firestore
      const isOwner  = (user.email ?? "").toLowerCase().startsWith("arthur");
      const userName = isOwner ? OWNER_NAME : PARTNER_NAME;
      const platform = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ? "mobile" : "desktop";

      console.log(`[FCM] Registrando dispositivo para ${userName} (${platform}) no grupo ${activeGroupId}...`);

      const idToken = await user.getIdToken();

      const response = await fetch("/api/register-device", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          token,
          user:      userName,
          platform,
          userAgent: navigator.userAgent,
          groupId:   activeGroupId,
        }),
      });

      const responseData = await response.json().catch(() => ({}));

      if (response.ok) {
        console.log(`[FCM] ✅ Aparelho registrado (doc: ${responseData.docId})`);
        setPushStatus("registered");
      } else {
        const errMsg = responseData.error ?? `Erro HTTP ${response.status} ao registrar dispositivo.`;
        console.error("[FCM] ❌ API register-device falhou:", errMsg);
        setPushStatus("error");
        setPushError(errMsg);
        return;
      }

      // 4. Exibe toast in-app quando chegar mensagem com o app em FOREGROUND
      const unsubscribe = onMessage(messaging, (payload) => {
        const title = payload.notification?.title || payload.data?.title;
        const body = payload.notification?.body || payload.data?.body;
        
        if (!title) return;
        console.log("[FCM] Mensagem em foreground recebida:", title, body);
        toast(`${title}\n${body ?? ""}`, {
          icon: "💌",
          duration: 5000,
        });
      });

      return unsubscribe;

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : "Erro desconhecido ao configurar push.";
      console.error("[FCM] ❌ Falha geral ao configurar push:", errMsg);
      setPushStatus("error");
      setPushError(errMsg);
    }
  }, [user, activeGroupId]);


  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      console.log(`[FCM] Permissão de notificação: ${perm}`);
      if (perm === "granted") {
        setupPush();
      }
    } catch (err) {
      console.error("[FCM] Erro ao solicitar permissão:", err);
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

  return { permission, requestPermission, pushStatus, pushError };
}
