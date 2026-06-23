import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

/**
 * Inicializa o Firebase Admin SDK (Singleton) se as variáveis de ambiente necessárias estiverem configuradas.
 */
export function initFirebaseAdmin(): void {
  if (!getApps().length) {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");

    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && privateKey) {
      initializeApp({
        credential: cert({
          projectId:   process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        }),
      });
    } else {
      console.error("[Firebase Admin] Variáveis de ambiente do Firebase Admin SDK ausentes ou inválidas.");
    }
  }
}

/**
 * Verifica o Firebase ID Token enviado pelo cliente e retorna o UID do usuário.
 */
export async function verifyUserToken(authHeader: string | undefined): Promise<string> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }
  const token = authHeader.substring(7);
  const decodedToken = await getAuth().verifyIdToken(token);
  return decodedToken.uid;
}

