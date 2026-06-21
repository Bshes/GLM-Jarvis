"use client";
/**
 * ThemeToggle — switch between dark (HUD) and light modes.
 */
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — track mount state via event callback.
  const handleRef = (node: HTMLButtonElement | null) => {
    if (node && !mounted) setMounted(true);
  };

  if (!mounted) {
    return (
      <button
        ref={handleRef}
        className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background/40"
      >
        <Moon className="h-4 w-4 text-muted-foreground" />
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background/40 text-muted-foreground transition hover:border-[oklch(0.82_0.15_75)]/50 hover:text-foreground"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {isDark ? (
        <Sun className="h-4 w-4 text-[oklch(0.82_0.15_75)]" />
      ) : (
        <Moon className="h-4 w-4 text-[oklch(0.72_0.18_55)]" />
      )}
    </button>
  );
}
