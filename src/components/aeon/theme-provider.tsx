"use client";
/**
 * ThemeProvider — wraps next-themes with A.E.O.N. defaults.
 * Default theme is "dark" (the HUD aesthetic). Light theme is available as an option.
 */
import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem={false}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
