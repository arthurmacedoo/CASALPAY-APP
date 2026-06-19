import React, { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";
import type { User } from "firebase/auth";

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
}

const AuthContext = createContext<UseAuthReturn | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
};

export const useAuthContext = (): UseAuthReturn => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext deve ser usado dentro de um AuthProvider");
  return ctx;
};
