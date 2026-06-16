import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot, getDoc, doc } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db, COUPLE_ID } from "../lib/firebase";
import type { Group } from "../types";

export function useUserGroups(user: User | null) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setGroups([]);
      setLoading(false);
      return;
    }

    // Busca grupos standard onde o usuário está no array memberIds
    const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', user.uid));
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const standardGroups = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Group));
      
      try {
        // Fallback blindado: Busca o grupo legado explicitamente
        const legacySnap = await getDoc(doc(db, 'groups', COUPLE_ID));
        let allGroups = standardGroups;

        if (legacySnap.exists()) {
          const legacyGroup = { id: legacySnap.id, ...legacySnap.data() } as Group;
          // Remove possível duplicata se o legado já tiver sido atualizado
          allGroups = [legacyGroup, ...standardGroups.filter(g => g.id !== COUPLE_ID)];
        }
        
        setGroups(allGroups);
      } catch (err) {
        console.error("[useUserGroups] Erro ao buscar grupo legado:", err);
        setGroups(standardGroups);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [user]);

  return { groups, loading };
}
