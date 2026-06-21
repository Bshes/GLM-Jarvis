"use client";
/**
 * ShortcutHelp — press `?` to toggle. Lists all keyboard shortcuts.
 */
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Command, X, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react";
import { useAeon } from "@/lib/store";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";

const SHORTCUTS: { group: string; color: string; items: { keys: string[]; label: string }[] }[] = [
  {
    group: "Global",
    color: "var(--a_core)",
    items: [
      { keys: ["⌘", "K"], label: "Open command palette" },
      { keys: ["?"], label: "Toggle this help overlay" },
      { keys: ["Esc"], label: "Close dialog / palette" },
    ],
  },
  {
    group: "Navigation",
    color: "var(--a_active)",
    items: [
      { keys: ["1"], label: "Go to Core" },
      { keys: ["2"], label: "Go to Agents" },
      { keys: ["3"], label: "Go to Memory" },
      { keys: ["4"], label: "Go to Sensory" },
      { keys: ["5"], label: "Go to Actions" },
      { keys: ["6"], label: "Go to Triggers" },
      { keys: ["7"], label: "Go to IoT" },
      { keys: ["8"], label: "Go to Console" },
      { keys: ["9"], label: "Go to Logs" },
      { keys: ["0"], label: "Go to Settings" },
    ],
  },
  {
    group: "Command Palette",
    color: "var(--a_warn)",
    items: [
      { keys: ["↑"], label: "Previous command" },
      { keys: ["↓"], label: "Next command" },
      { keys: ["↵"], label: "Run selected command" },
    ],
  },
  {
    group: "Core View",
    color: "var(--a_think)",
    items: [
      { keys: ["⌘", "↵"], label: "Run orchestration cycle (when focused in directive input)" },
    ],
  },
];

export function ShortcutHelp() {
  const open = useAeon((s) => s.shortcutHelpOpen);
  const setOpen = useAeon((s) => s.setShortcutHelpOpen);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;
      if (e.key === "?" && !typing) {
        e.preventDefault();
        setOpen(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden border-border bg-popover/95 p-0 backdrop-blur-xl [&>button]:hidden">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-md border border-[oklch(0.82_0.15_75)]/40 bg-[oklch(0.82_0.15_75)]/10">
            <Command className="h-4 w-4 text-[oklch(0.82_0.15_75)]" />
          </div>
          <div>
            <h2 className="font-mono text-sm font-bold text-foreground">KEYBOARD SHORTCUTS</h2>
            <p className="text-[10px] text-muted-foreground">Press ? anytime to toggle this overlay</p>
          </div>
          <button onClick={() => setOpen(false)} className="ml-auto text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Shortcut groups */}
        <div className="aeon-scroll max-h-[440px] overflow-y-auto p-3">
          {SHORTCUTS.map((group) => (
            <div key={group.group} className="mb-3 last:mb-0">
              <div className="mb-1.5 flex items-center gap-1.5 px-1">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: group.color }} />
                <span className="font-mono text-[9px] font-bold uppercase tracking-widest" style={{ color: group.color }}>
                  {group.group}
                </span>
              </div>
              <div className="space-y-0.5">
                {group.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-[oklch(0.82_0.15_75)]/5"
                  >
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, j) => (
                        <kbd
                          key={j}
                          className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-border/60 bg-background/60 px-1.5 font-mono text-[10px] font-bold text-foreground"
                          style={{ boxShadow: "0 1px 0 var(--border)" }}
                        >
                          {key}
                        </kbd>
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-border/60 bg-background/40 px-4 py-2 text-center">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            shortcuts are disabled while typing in inputs
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
