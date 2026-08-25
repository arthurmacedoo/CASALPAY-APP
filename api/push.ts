import type { Firestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

export type PushKind = "pending-expense-registered" | "pending-daily-reminder" | "system";

export interface PushOptions {
  groupId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  targetUser?: string;
  kind?: PushKind;
}

export interface PushResult {
  targetUser?: string;
  tokenCount: number;
  successCount: number;
  failureCount: number;
  tokensRemoved: number;
}

const DEFAULT_ICON = "/icon-192.png";
const DEFAULT_BADGE = "/icon-192.png";

export function resolvePushTargetUser(deviceUser: unknown): string | undefined {
  if (typeof deviceUser !== "string") return undefined;

  const normalized = deviceUser.trim().toLowerCase();
  if (normalized === "arthur" || normalized === "owner") return "Arthur";
  if (normalized === "zara" || normalized === "namorada" || normalized === "partner") return "Zara";

  // Nome desconhecido: avisa o grupo para não silenciar uma compra legítima.
  return undefined;
}

export async function sendPendingExpenseRegistered(
  db: Firestore,
  groupId: string,
  details: { amountCents?: number; description?: string; deviceUser?: unknown }
): Promise<PushResult> {
  const amount = details.amountCents
    ? `R$ ${(details.amountCents / 100).toFixed(2).replace(".", ",")}`
    : "com valor indefinido";
  const description = details.description || "Compra Apple Pay";
  const userText = details.deviceUser ? ` por ${String(details.deviceUser)}` : "";
  const targetUser = resolvePushTargetUser(details.deviceUser);

  return sendPushToGroup(db, {
    groupId,
    targetUser,
    title: "✅ Sua despesa foi registrada",
    body: `A compra de ${amount} em "${description}"${userText} foi registrada em Pendentes e aguarda sua confirmação.`,
    url: "/?view=pending",
    tag: "casalpay-pending-expense",
    kind: "pending-expense-registered",
  });
}

/**
 * Envia uma mensagem FCM data-only para os dispositivos do grupo.
 * O service worker é o único responsável por exibir a notificação em background,
 * evitando a duplicidade causada por notification + showNotification manual.
 */
export async function sendPushToGroup(
  db: Firestore,
  options: PushOptions
): Promise<PushResult> {
  const tokensRef = db
    .collection("groups")
    .doc(options.groupId)
    .collection("fcm_tokens");

  const tokensSnap = options.targetUser
    ? await tokensRef.where("user", "==", options.targetUser).get()
    : await tokensRef.get();

  const tokenMap = new Map<string, string>();
  tokensSnap.forEach((docSnap) => {
    const token = docSnap.data()?.token;
    if (typeof token === "string" && token.length > 0) {
      tokenMap.set(token, docSnap.id);
    }
  });

  if (tokenMap.size === 0) {
    return {
      targetUser: options.targetUser,
      tokenCount: 0,
      successCount: 0,
      failureCount: 0,
      tokensRemoved: 0,
    };
  }

  const tokens = Array.from(tokenMap.keys());
  const messaging = getMessaging();
  const notificationBadge = options.badge ??
    (options.kind === "pending-expense-registered" || options.kind === "pending-daily-reminder"
      ? "/pending-badge.svg"
      : DEFAULT_BADGE);
  const response = await messaging.sendEachForMulticast({
    tokens,
    data: {
      type: options.kind ?? "system",
      title: options.title,
      body: options.body,
      url: options.url ?? "/messages",
      icon: options.icon ?? DEFAULT_ICON,
      badge: notificationBadge,
      tag: options.tag ?? "casalpay-msg",
    },
    webpush: {
      headers: {
        Urgency: "high",
        TTL: "86400",
      },
    },
  });

  const cleanupBatch = db.batch();
  let tokensRemoved = 0;
  response.responses.forEach((sendResponse, index) => {
    if (sendResponse.success) return;

    const errorCode = sendResponse.error?.code ?? "";
    const isInvalidToken =
      errorCode.includes("registration-token-not-registered") ||
      errorCode.includes("invalid-registration-token") ||
      errorCode.includes("sender-id-mismatch") ||
      errorCode.includes("mismatched-credential");

    if (!isInvalidToken) return;

    const token = tokens[index];
    const docId = tokenMap.get(token);
    if (!docId) return;

    cleanupBatch.delete(tokensRef.doc(docId));
    tokensRemoved += 1;
  });

  if (tokensRemoved > 0) {
    await cleanupBatch.commit();
  }

  return {
    targetUser: options.targetUser,
    tokenCount: tokens.length,
    successCount: response.successCount,
    failureCount: response.failureCount,
    tokensRemoved,
  };
}
