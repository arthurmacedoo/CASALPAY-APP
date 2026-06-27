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
import { doc, setDoc, serverTimestamp, collection, query, where, getDocs, writeBatch } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

interface UseAuthReturn {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthorized: boolean;
  unauthorizedReason: string | null;
  login: (email: string, pass: string, remember?: boolean) => Promise<void>;
  register: (name: string, email: string, pass: string, remember?: boolean) => Promise<void>;
  updateUserName: (newName: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

// ── Tradução de erros do Firebase para Português ──────────────────────────────────
function firebaseErrorPT(code: string): string {
  const map: Record<string, string> = {
    "auth/invalid-credential":    "E-mail ou senha incorretos. Verifique e tente novamente.",
    "auth/wrong-password":        "Senha incorreta. Tente novamente.",
    "auth/user-not-found":        "Nenhuma conta encontrada com este e-mail.",
    "auth/invalid-email":         "E-mail inválido. Verifique o formato.",
    "auth/too-many-requests":     "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    "auth/user-disabled":         "Esta conta foi desativada. Entre em contato com o suporte.",
    "auth/network-request-failed":"Sem conexão com a internet. Verifique sua rede.",
    "auth/email-already-in-use":  "Este e-mail já está cadastrado. Tente fazer login.",
    "auth/weak-password":         "A senha deve ter pelo menos 6 caracteres.",
    "auth/operation-not-allowed": "Operação não permitida. Contate o suporte.",
    "auth/requires-recent-login": "Sessão expirada. Faça login novamente.",
    "auth/popup-closed-by-user":  "Login cancelado. Tente novamente.",
  };
  return map[code] ?? "Erro inesperado. Tente novamente.";
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

      setUser(currentUser);
      setUnauthorizedReason(null);
      // Não limpa o error aqui para preservar mensagem de credenciais inválidas

      if (currentUser) {
        setIsAuthorized(true);
        setError(null); // Limpa erro apenas quando login bem-sucedido
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

  const clearError = () => setError(null);

  const login = async (email: string, pass: string, remember: boolean = true) => {
    setError(null);
    setUnauthorizedReason(null);
    setLoading(true);
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      console.error("[useAuth] Erro no login:", err);
      setError(firebaseErrorPT(code));
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
      await updateProfile(userCred.user, { displayName: name.trim() });
      await setDoc(doc(db, 'users', userCred.user.uid), {
        userId: userCred.user.uid,
        name: name.trim(),
        email: email.trim(),
        activeGroupId: null,
        defaultGroupId: null,
        updatedAt: serverTimestamp()
      });
    } catch (err: unknown) {
      const code = (err as { code?: string }).code ?? "";
      console.error("[useAuth] Erro no cadastro:", err);
      setError(firebaseErrorPT(code));
      await signOut(auth);
    } finally {
      setLoading(false);
    }
  };

  const updateUserName = async (newName: string) => {
    if (!user) throw new Error("Usuário não autenticado");
    const nameStr = newName.trim();
    if (!nameStr) throw new Error("O nome não pode estar vazio");

    // 1. Atualiza no Auth
    await updateProfile(user, { displayName: nameStr });
    setUser({ ...user, displayName: nameStr } as User); // Força atualização local

    // 2. Prepara atualização em lote (Batch)
    const batch = writeBatch(db);

    // Atualiza no documento do usuário
    batch.update(doc(db, 'users', user.uid), { 
      name: nameStr,
      updatedAt: serverTimestamp()
    });

    // 3. Encontra todos os grupos que o usuário participa e atualiza o membro
    const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', user.uid));
    const groupsSnap = await getDocs(q);
    
    groupsSnap.forEach((groupDoc) => {
      const memberRef = doc(db, 'groups', groupDoc.id, 'members', user.uid);
      batch.update(memberRef, { 
        name: nameStr 
      });
    });

    // Executa tudo de forma atômica
    await batch.commit();
  };

  const logout = async () => {
    console.log("Deslogando usuário...");
    await signOut(auth);
    setIsAuthorized(false);
    setUnauthorizedReason(null);
  };

  return { user, loading, error, isAuthorized, unauthorizedReason, login, register, updateUserName, logout, clearError };
}
