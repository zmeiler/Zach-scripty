import type { PropsWithChildren } from "react";

type ThemeProviderProps = PropsWithChildren<{
  defaultTheme?: "light" | "dark";
  switchable?: boolean;
}>;

export function ThemeProvider({ children }: ThemeProviderProps) {
  return <>{children}</>;
}
