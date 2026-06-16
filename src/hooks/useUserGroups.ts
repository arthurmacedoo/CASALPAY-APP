import { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import type { User } from "firebase/auth";
import { db } from "../lib/firebase";
import type { Group } from "../types";

export function useUserGroups(user: User | null) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) { setGroups([]); setLoading(false); return; }

    const q = query(collection(db, 'groups'), where('memberIds', 'array-contains', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const standardGroups = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Group));
      setGroups(standardGroups);
      setLoading(false);
    }, (error) => {
      console.error("[useUserGroups] Erro ao buscar grupos:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  return { groups, loading };
}
