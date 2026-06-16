import React, { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { usePushNotifications, type PushStatus } from "../hooks/usePushNotifications";
import { useAuthContext } from "./AuthContext";

interface NotificationContextType {
  permission: NotificationPermission;
  requestPermission: () => Promise<void>;
  pushStatus: PushStatus;
  pushError: string | null;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuthContext();
  const pushState = usePushNotifications(user);

  return (
    <NotificationContext.Provider value={pushState}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotificationContext = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotificationContext must be used within NotificationProvider");
  return ctx;
};
