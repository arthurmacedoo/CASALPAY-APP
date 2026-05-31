import React from "react";
import { NavLink, useLocation } from "react-router-dom";

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
}

const HomeIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={filled ? "0" : "2"} strokeLinecap="round" strokeLinejoin="round">
    {filled ? (
      <path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9 21 9 15 12 15C15 15 15 21 15 21M9 21H15" />
    ) : (
      <path d="M3 12L5 10M5 10L12 3L19 10M5 10V20C5 20.5523 5.44772 21 6 21H9M19 10L21 12M19 10V20C19 20.5523 18.5523 21 18 21H15M9 21C9 21 9 15 12 15C15 15 15 21 15 21M9 21H15" />
    )}
  </svg>
);

const PlusIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <circle cx="12" cy="12" r="9" />
    <line x1="12" y1="8" x2="12" y2="16" />
    <line x1="8" y1="12" x2="16" y2="12" />
  </svg>
);

const HistoryIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={filled ? "2.5" : "2"} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8V12L15 15" />
    <path d="M3.05 11A9 9 0 1 0 4 7" strokeDasharray={filled ? "0" : "0"} />
    <path d="M3 3V7H7" />
  </svg>
);

export const BottomNav: React.FC = () => {
  const location = useLocation();

  const navItems: NavItem[] = [
    {
      to: "/",
      label: "Início",
      icon: <HomeIcon />,
      activeIcon: <HomeIcon filled />,
    },
    {
      to: "/add",
      label: "Adicionar",
      icon: <PlusIcon />,
      activeIcon: <PlusIcon />,
    },
    {
      to: "/history",
      label: "Histórico",
      icon: <HistoryIcon />,
      activeIcon: <HistoryIcon filled />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-bg-card border-t border-border safe-bottom">
      <div className="flex items-center justify-around px-2 pt-2 pb-2">
        {navItems.map((item) => {
          const isActive =
            item.to === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.to);

          const isAddButton = item.to === "/add";

          return (
            <NavLink
              key={item.to}
              to={item.to}
              id={`nav-${item.to.replace("/", "") || "home"}`}
              className="flex-1"
            >
              <div
                className={`flex flex-col items-center gap-1 py-1 transition-all duration-200 ${
                  isAddButton
                    ? `mx-2 py-2.5 rounded-2xl ${
                        isActive
                          ? "bg-accent-pink text-white shadow-glow"
                          : "bg-accent-pink text-white shadow-glow"
                      }`
                    : isActive
                    ? "text-accent-pink"
                    : "text-text-muted"
                }`}
              >
                {isActive && !isAddButton ? item.activeIcon : item.icon}
                <span
                  className={`text-[10px] font-medium ${
                    isAddButton ? "text-white" : ""
                  }`}
                >
                  {item.label}
                </span>
              </div>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
