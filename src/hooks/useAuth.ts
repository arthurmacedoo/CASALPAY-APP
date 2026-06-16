import { useState, useEffect } from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "firebase/auth";
import type { User } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthorized: boolean;
  unauthorizedReason: string | null;
  login: (email: string, pass: string, remember?: boolean) => Promise<void>;
  register: (name: string, email: string, pass: string, remember?: boolean) => Promise<void>;
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
        setIsAuthorized(true);
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

  const login = async (email: string, pass: string, remember: boolean = true) => {
    setError(null);
    setUnauthorizedReason(null);
    setLoading(true);
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: any) {
      console.error("[useAuth] Erro no login:", err);
      setError(err.message || 'Erro ao fazer login. Verifique as credenciais.');
    } finally {
      setLoading(false);
    }
  };

  const register = async (name: string, email: string, pass: string, remember: boolean = true) => {
    setError(null);
    setUnauthorizedReason(null);
    setLoading(true);
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      const userCred = await createUserWithEmailAndPassword(auth, email, pass);
      
      // Atualiza o displayName no Auth
      await updateProfile(userCred.user, { displayName: name.trim() });
      
      // Cria o perfil inicial zerado no Firestore (activeGroupId null até ele criar/entrar em um)
      await setDoc(doc(db, 'users', userCred.user.uid), {
        userId: userCred.user.uid,
        name: name.trim(),
        email: email.trim(),
        activeGroupId: null,
        defaultGroupId: null,
        updatedAt: serverTimestamp()
      });
      
    } catch (err: any) {
      console.error("[useAuth] Erro no cadastro:", err);
      setError(err.message || 'Erro ao criar conta.');
      await signOut(auth);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    console.log("Deslogando usuário...");
    await signOut(auth);
    setIsAuthorized(false);
    setUnauthorizedReason(null);
  };

  return { user, loading, error, isAuthorized, unauthorizedReason, login, register, logout };
}
