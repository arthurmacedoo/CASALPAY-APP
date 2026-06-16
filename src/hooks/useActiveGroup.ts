/**
 * useActiveGroup.ts
 *
 * Hook que mantém o estado do grupo ativo do usuário logado.
 *
 * Etapa 1: lê grupos de /groups/{groupId} e membros de /groups/{groupId}/members.
 * O grupo ativo é lido/gravado em /users/{uid}.activeGroupId.
 *
 * Etapa 1.5 (futuro): transactions/apple_pay_events/fcm_tokens migrarão para
 * /groups/{groupId}/... — nenhuma mudança neste hook será necessária.
 */
import { useState, useEffect, useCallback } from "react";
import {
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  writeBatch,
  doc,
  arrayUnion,
  query,
  where,
  getDocs,
  arrayRemove,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import {
  db,
  groupDocRef,
  userDocRef,
} from "../lib/firebase";
import type { Group, GroupMember, ActiveGroupState } from "../types";


export interface UseActiveGroupReturn extends ActiveGroupState {
  /** Altera o grupo ativo do usuário (salva em users/{uid}.activeGroupId) */
  switchGroup: (groupId: string) => Promise<void>;
  createGroup: (name: string) => Promise<void>; // NOVO
  updateGroup: (newName: string) => Promise<void>;
  deleteGroup: () => Promise<void>;
  joinGroup: (groupId: string) => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  activeGroupId: string | null;
}

export function useActiveGroup(user: User | null): UseActiveGroupReturn {
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);

  const currentMember = user ? members.find(m => m.userId === user.uid) || null : null;
  const currentUserRole = currentMember?.role;
  const isCurrentUserAdmin = Boolean(user && group && group.createdBy === user.uid);

  const clearActiveGroup = useCallback(() => {
    localStorage.removeItem('casalpay_active_group');
    setGroup(null);
    setMembers([]);
    setLoading(false);
    setActiveGroupId(null);
  }, []);

  // ── 1. Resolve qual groupId está ativo para este usuário ─────────────────
  useEffect(() => {
    if (!user) {
      clearActiveGroup();
      return;
    }

    let cancelled = false;

    const resolveGroupId = async () => {
      setLoading(true);
      setError(null);
      try {
        const userSnap = await getDoc(userDocRef(user.uid));
        const storedGroupId = userSnap.exists()
          ? (userSnap.data()?.activeGroupId as string | null)
          : null;

        const resolvedId = storedGroupId ?? null;

        if (!cancelled) {
          setActiveGroupId(resolvedId);
          // Se não houver grupo, precisamos tirar do loading explicitamente,
          // pois o useEffect do activeGroupId não será trigado se o valor já era null
          if (!resolvedId) {
            setLoading(false);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          if (err.code === "permission-denied") {
            clearActiveGroup();
          } else {
            setActiveGroupId(null);
            setLoading(false);
          }
        }
      }
    };

    resolveGroupId();
    return () => { cancelled = true; };
  }, [user]);

  // ── 2. Ouve o documento do grupo ativo em tempo real ─────────────────────
  useEffect(() => {
    if (!activeGroupId) { setGroup(null); setMembers([]); setLoading(false); return; }

    const unsubGroup = onSnapshot(
      groupDocRef(activeGroupId),
      (snap) => {
        if (snap.exists()) {
          setGroup({ id: snap.id, ...snap.data() } as Group);
        } else {
          setError("Grupo não encontrado.");
          setGroup(null);
        }
        setLoading(false);
      },
      (error: any) => {
        if (error.code === 'permission-denied') {
          setError("Sem permissão para acessar este grupo.");
          setLoading(false);
        } else {
          console.error("Erro inesperado no snapshot de grupo:", error);
          setError(`Erro: ${error.message}`);
          setLoading(false);
        }
      }
    );

    return unsubGroup;
  }, [activeGroupId]);

  // ── 3. Ouve a subcoleção de membros do grupo ativo ───────────────────────
  useEffect(() => {
    if (!activeGroupId) { setGroup(null); setMembers([]); setLoading(false); return; }

    const unsubMembers = onSnapshot(
      collection(db, "groups", activeGroupId, "members"),
      (snap) => {
        const docs: GroupMember[] = snap.docs.map(
          (d) => ({ userId: d.id, ...d.data() } as GroupMember)
        );
        // Garantir que a array seja resetada/sobrescrita e sem duplicação (proteção adicional)
        const uniqueMembers = Array.from(new Map(docs.map(m => [m.userId, m])).values());
        setMembers(uniqueMembers);
      },
      (error: any) => {
        if (error.code === 'permission-denied') {
          setError("Sem permissão para acessar membros.");
          setLoading(false);
        } else {
          console.error("Erro inesperado no snapshot de membros:", error);
          setError(`Erro: ${error.message}`);
          setLoading(false);
        }
      }
    );

    return unsubMembers;
  }, [activeGroupId]);

  // ── 4. Permite trocar o grupo ativo ──────────────────────────────────────
  const switchGroup = useCallback(
    async (groupId: string) => {
      if (!user) return;
      try {
        await setDoc(
          userDocRef(user.uid),
          { activeGroupId: groupId, updatedAt: serverTimestamp() },
          { merge: true }
        );
        setActiveGroupId(groupId);
      } catch (err) {
        console.error("[useActiveGroup] Erro ao trocar grupo:", err);
      }
    },
    [user]
  );

  const createGroup = useCallback(
    async (name: string) => {
      if (!user) return;

      const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', user.uid));
      const userGroupsSnap = await getDocs(q);
      if (userGroupsSnap.size >= 4) {
        throw new Error("Você atingiu o limite máximo de 4 grupos.");
      }

      const newGroupRef = doc(collection(db, 'groups'));
      const memberRef = doc(db, 'groups', newGroupRef.id, 'members', user.uid);
      const userProfileRef = userDocRef(user.uid);

      // Fallbacks estritos: Firebase rejeita campos undefined/null
      const displayName: string = user.displayName ?? user.email?.split('@')[0] ?? 'Arthur';
      const email: string = user.email ?? 'arthur@casalpay.local';

      console.log('[CasalPay] Criando grupo:', { id: newGroupRef.id, name, displayName, email, uid: user.uid });

      const batch = writeBatch(db);

      // 1. Documento do Grupo
      batch.set(newGroupRef, {
        name: name.trim(),
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        memberIds: [user.uid],
      });

      // 2. Membro criador (sem campos undefined/null)
      batch.set(memberRef, {
        userId: user.uid,
        name: displayName,
        email: email,
        role: 'admin' as const,
        status: 'active' as const,
        joinedAt: serverTimestamp(),
      });

      // 3. Perfil do usuário: atualiza activeGroupId no mesmo batch (atômico)
      batch.set(userProfileRef, {
        activeGroupId: newGroupRef.id,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await batch.commit();
      console.log('[CasalPay] Grupo criado com sucesso:', newGroupRef.id);

      // Switch local imediato (sem nova chamada ao Firestore)
      setActiveGroupId(newGroupRef.id);
    },
    [user]
  );

  const updateGroup = useCallback(async (newName: string) => {
    if (!user || !activeGroupId || !isCurrentUserAdmin) return;
    try {
      await setDoc(groupDocRef(activeGroupId), { 
        name: newName.trim(), 
        updatedAt: serverTimestamp() 
      }, { merge: true });
    } catch (err) {
      console.error("[CasalPay] Erro ao atualizar grupo:", err);
      throw err;
    }
  }, [user, activeGroupId, isCurrentUserAdmin]);

  const deleteGroup = useCallback(async () => {
    if (!user || !activeGroupId || !isCurrentUserAdmin) return;
    try {
      const batch = writeBatch(db);
      
      // 1. Exclui o documento do grupo
      batch.delete(groupDocRef(activeGroupId));
      
      // 2. Exclui o membro do criador para limpar a subcoleção
      batch.delete(doc(db, 'groups', activeGroupId, 'members', user.uid));
      
      // 3. Reseta o activeGroupId
      batch.set(userDocRef(user.uid), { 
        activeGroupId: null, 
        updatedAt: serverTimestamp() 
      }, { merge: true });

      await batch.commit();
      
      // Atualiza o estado local imediatamente
      setActiveGroupId(null);
    } catch (err) {
      console.error("[CasalPay] Erro ao excluir grupo:", err);
      throw err;
    }
  }, [user, activeGroupId, isCurrentUserAdmin]);

  const joinGroup = useCallback(async (inviteCode: string) => {
    if (!user) return;
    const groupId = inviteCode.trim();
    if (!groupId) throw new Error("Código de convite inválido.");

    const groupRef = doc(db, 'groups', groupId);
    const memberRef = doc(db, 'groups', groupId, 'members', user.uid);
    const userProfileRef = userDocRef(user.uid);

    // Valida se o grupo existe antes de tentar entrar
    const groupSnap = await getDoc(groupRef);
    if (!groupSnap.exists()) {
      throw new Error("Grupo não encontrado. Verifique o código.");
    }

    const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', user.uid));
    const userGroupsSnap = await getDocs(q);
    if (userGroupsSnap.size >= 4) {
      throw new Error("Você atingiu o limite máximo de 4 grupos.");
    }

    const displayName = user.displayName ?? user.email?.split('@')[0] ?? 'Convidado';
    const email = user.email ?? '';

    const batch = writeBatch(db);

    // 1. Adiciona o usuário na array memberIds do grupo
    batch.update(groupRef, {
      memberIds: arrayUnion(user.uid),
      updatedAt: serverTimestamp()
    });

    // 2. Cria o documento do membro
    batch.set(memberRef, {
      userId: user.uid,
      name: displayName,
      email: email,
      role: 'member', // Convidado entra como member padrão
      status: 'active',
      joinedAt: serverTimestamp(),
    });

    // 3. Atualiza o grupo ativo do usuário
    batch.set(userProfileRef, {
      activeGroupId: groupId,
      updatedAt: serverTimestamp(),
    }, { merge: true });

    await batch.commit();
    setActiveGroupId(groupId);
  }, [user]);

  const removeMember = useCallback(async (targetUserId: string) => {
    if (!user || !activeGroupId || !isCurrentUserAdmin) return;
    if (targetUserId === user.uid) throw new Error("Você não pode remover a si mesmo.");

    try {
      const batch = writeBatch(db);
      
      // 1. Remove o UID do array principal
      batch.update(groupDocRef(activeGroupId), {
        memberIds: arrayRemove(targetUserId),
        updatedAt: serverTimestamp()
      });
      
      // 2. Remove o documento da subcoleção members
      batch.delete(doc(db, 'groups', activeGroupId, 'members', targetUserId));
      
      await batch.commit();
    } catch (err) {
      console.error("[CasalPay] Erro ao remover membro:", err);
      throw err;
    }
  }, [user, activeGroupId, isCurrentUserAdmin]);

  return { 
    group, 
    members, 
    loading, 
    error, 
    activeGroupId, 
    switchGroup,
    createGroup,
    updateGroup,
    deleteGroup,
    joinGroup,
    removeMember,
    currentMember,
    currentUserRole,
    isCurrentUserAdmin
  };
}
