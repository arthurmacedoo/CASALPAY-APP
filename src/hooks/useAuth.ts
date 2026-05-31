import { useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, COUPLE_ID } from "../lib/firebase";

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthorized: boolean;
  unauthorizedReason: string | null;
  login: (username: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [unauthorizedReason, setUnauthorizedReason] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!mounted) return;

      console.log("Auth state changed:", {
        uid: currentUser?.uid ?? null,
        email: currentUser?.email ?? null,
      });

      setUser(currentUser);
      setUnauthorizedReason(null);
      setError(null);

      if (currentUser) {
        try {
          const coupleDocRef = doc(db, "couples", COUPLE_ID);
          const coupleDoc = await getDoc(coupleDocRef);
          
          if (coupleDoc.exists()) {
            const data = coupleDoc.data();
            const members = data?.members ?? {};
            const isMember = members[currentUser.uid] === true;

            if (isMember) {
              setIsAuthorized(true);
            } else {
              setIsAuthorized(false);
              setUnauthorizedReason(`Seu UID (${currentUser.uid}) não foi encontrado na lista de members ou não está marcado como true.`);
            }
          } else {
            setIsAuthorized(false);
            setUnauthorizedReason(`O documento do casal (/couples/${COUPLE_ID}) não foi encontrado no banco de dados.`);
          }
        } catch (firestoreError: any) {
          console.error("Erro ao ler o Firestore:", firestoreError);
          setIsAuthorized(false);
          setUnauthorizedReason(`Falha de permissão ao ler o Firestore. Erro: ${firestoreError.message}`);
        }
      } else {
        setIsAuthorized(false);
      }

      setLoading(false);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  const login = async (username: string, pass: string) => {
    setError(null);
    setUnauthorizedReason(null);
    setLoading(true);

    try {
      const emailTecnico = `${username.toLowerCase().trim()}@casalpay.local`;
      await signInWithEmailAndPassword(auth, emailTecnico, pass);
    } catch (err: any) {
      console.error("Erro no login:", err);
      if (err.code === "auth/invalid-credential" || err.code === "auth/user-not-found" || err.code === "auth/wrong-password") {
        setError("Usuário ou senha incorretos.");
      } else {
        setError(`Falha ao logar: ${err.message}`);
      }
      setLoading(false);
    }
  };

  const logout = async () => {
    console.log("Deslogando usuário...");
    await signOut(auth);
    setIsAuthorized(false);
    setUnauthorizedReason(null);
  };

  return { user, loading, error, isAuthorized, unauthorizedReason, login, logout };
}
