/**
 * GroupContext.tsx
 *
 * Context global que disponibiliza o grupo ativo em toda a árvore React.
 *
 * Uso:
 *   const { group, members, loading, activeGroupId, switchGroup } = useGroupContext();
 *
 * Etapa 1: group.name = "Grupo Arthur e Zara", members = [Arthur, Zara]
 * Etapa 2+: workspace switcher na Home usa switchGroup()
 */
import React, { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useActiveGroup, type UseActiveGroupReturn } from "../hooks/useActiveGroup";
import { useAuth } from "../hooks/useAuth";

const GroupContext = createContext<UseActiveGroupReturn | null>(null);

export const GroupProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const groupState = useActiveGroup(user);

  return (
    <GroupContext.Provider value={groupState}>
      {children}
    </GroupContext.Provider>
  );
};

export const useGroupContext = (): UseActiveGroupReturn => {
  const ctx = useContext(GroupContext);
  if (!ctx) throw new Error("useGroupContext deve ser usado dentro de GroupProvider");
  return ctx;
};
