import React, { createContext, useContext } from "react";
import type { ReactNode } from "react";
import { usePushNotifications } from "../hooks/usePushNotifications";
import { useAuth } from "../hooks/useAuth";

interface NotificationContextType {
  permission: NotificationPermission;
  requestPermission: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
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
