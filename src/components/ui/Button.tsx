import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  fullWidth?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "primary",
  size = "md",
  loading = false,
  fullWidth = false,
  children,
  className = "",
  disabled,
  ...props
}) => {
  const base =
    "inline-flex items-center justify-center font-semibold rounded-2xl transition-all duration-150 active:scale-95 select-none";

  const sizes = {
    sm: "px-4 py-2 text-sm",
    md: "px-5 py-3.5 text-base",
    lg: "px-6 py-4 text-base",
  };

  const variants = {
    primary:
      "bg-accent-pink text-white shadow-glow disabled:opacity-50",
    secondary:
      "bg-bg-elevated border border-border text-text-primary hover:border-border-light",
    ghost:
      "bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-elevated",
    danger:
      "bg-accent-red/20 border border-accent-red text-accent-red hover:bg-accent-red/30",
  };

  return (
    <button
      className={`
        ${base}
        ${sizes[size]}
        ${variants[variant]}
        ${fullWidth ? "w-full" : ""}
        ${disabled || loading ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span className="spinner mr-2" />
      ) : null}
      {children}
    </button>
  );
};
