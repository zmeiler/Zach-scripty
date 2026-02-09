import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "solid" | "ghost";
  size?: "default" | "icon";
};

export function Button({
  className = "",
  variant = "solid",
  size = "default",
  ...props
}: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-md";
  const variants = {
    solid: "bg-slate-900 text-white hover:bg-slate-800",
    ghost: "bg-transparent text-slate-600 hover:bg-slate-100",
  };
  const sizes = {
    default: "h-11 px-4 text-sm font-semibold",
    icon: "h-11 w-11",
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
