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

const HeartIcon = ({ filled }: { filled?: boolean }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
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
    {
      to: "/messages",
      label: "Mensagens",
      icon: <HeartIcon />,
      activeIcon: <HeartIcon filled />,
    },
  ];

  const activeIndex = navItems.findIndex((item) =>
    item.to === "/"
      ? location.pathname === "/"
      : location.pathname.startsWith(item.to)
  );

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-bg-card border-t border-border safe-bottom px-2">
      <div className="relative flex items-center w-full pt-2 pb-2">
        {/* Sliding Indicator */}
        {activeIndex !== -1 && (
          <div
            className="absolute top-2 bottom-2 transition-transform duration-300 z-0"
            style={{
              width: `${100 / navItems.length}%`,
              transform: `translateX(${activeIndex * 100}%)`,
              left: 0,
              transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
            }}
          >
            <div className="mx-1 h-full bg-accent-pink rounded-2xl shadow-[0_0_15px_rgba(232,121,160,0.3)]" />
          </div>
        )}

        {navItems.map((item, index) => {
          const isActive = index === activeIndex;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              id={`nav-${item.to.replace("/", "") || "home"}`}
              className="flex-1 relative z-10"
              aria-current={isActive ? "page" : undefined}
            >
              <div
                className={`flex flex-col items-center gap-1 py-1.5 transition-colors duration-200 ${
                  isActive ? "text-white" : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {isActive ? item.activeIcon : item.icon}
                <span className="text-[10px] font-medium tracking-wide">
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
