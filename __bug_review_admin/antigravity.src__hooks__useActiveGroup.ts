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
} from "firebase/firestore";
import type { User } from "firebase/auth";
import {
  db,
  groupDocRef,
  userDocRef,
  COUPLE_ID,
} from "../lib/firebase";
import type { Group, GroupMember, ActiveGroupState } from "../types";

const DEFAULT_GROUP_ID = COUPLE_ID; // "arthur-namorada-2026" durante Etapa 1

export interface UseActiveGroupReturn extends ActiveGroupState {
  /** Altera o grupo ativo do usuário (salva em users/{uid}.activeGroupId) */
  switchGroup: (groupId: string) => Promise<void>;
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
  const isCurrentUserAdmin = currentUserRole === "admin";

  // ── 1. Resolve qual groupId está ativo para este usuário ─────────────────
  useEffect(() => {
    if (!user) {
      setGroup(null);
      setMembers([]);
      setLoading(false);
      setActiveGroupId(null);
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

        const resolvedId = storedGroupId ?? DEFAULT_GROUP_ID;

        if (!cancelled) {
          setActiveGroupId(resolvedId);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[useActiveGroup] Erro ao resolver groupId:", err);
          // Fallback seguro para o grupo inicial
          setActiveGroupId(DEFAULT_GROUP_ID);
        }
      }
    };

    resolveGroupId();
    return () => { cancelled = true; };
  }, [user]);

  // ── 2. Ouve o documento do grupo ativo em tempo real ─────────────────────
  useEffect(() => {
    if (!activeGroupId) return;

    const unsubGroup = onSnapshot(
      groupDocRef(activeGroupId),
      (snap) => {
        if (snap.exists()) {
          setGroup({ id: snap.id, ...snap.data() } as Group);
        } else {
          // Grupo não existe ainda (antes de rodar o script de migração)
          // Cria um estado fantasma para não travar o app
          setGroup({
            id: activeGroupId,
            name: "Grupo Arthur e Zara",
            createdBy: "",
            createdAt: null as any,
            updatedAt: null as any,
            legacyCoupleId: COUPLE_ID,
          });
        }
        setLoading(false);
      },
      (err) => {
        console.error("[useActiveGroup] Erro ao ouvir grupo:", err.message);
        setError(err.message);
        setLoading(false);
      }
    );

    return unsubGroup;
  }, [activeGroupId]);

  // ── 3. Ouve a subcoleção de membros do grupo ativo ───────────────────────
  useEffect(() => {
    if (!activeGroupId) return;

    const unsubMembers = onSnapshot(
      collection(db, "groups", activeGroupId, "members"),
      (snap) => {
        const docs: GroupMember[] = snap.docs.map(
          (d) => ({ userId: d.id, ...d.data() } as GroupMember)
        );
        setMembers(docs);
      },
      (err) => {
        console.warn("[useActiveGroup] Erro ao ouvir membros:", err.message);
        // Não bloqueia o app — membros são exibidos se disponíveis
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

  return { 
    group, 
    members, 
    loading, 
    error, 
    activeGroupId, 
    switchGroup,
    currentMember,
    currentUserRole,
    isCurrentUserAdmin
  };
}
