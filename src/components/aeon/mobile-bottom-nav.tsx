"use client";
/**
 * MobileBottomNav — native-app-style bottom navigation for mobile widths.
 *
 * Replaces the left sidebar nav on screens below `md` (768px). Renders a
 * horizontally-scrollable rail of 9 icon+label buttons (one per A.E.O.N.
 * view). The active button pulses softly, glows amber (var(--aeon-core)),
 * and carries a top accent line. Inactive buttons are muted.
 *
 * Hidden on desktop where AeonShell's left sidebar takes over.
 *
 * Layout contract: rendered as a flex-col sibling of the body row and the
 * sticky footer. `md:hidden` collapses it on desktop; on mobile its natural
 * height sits just above the footer (which keeps `mt-auto`). The body row
 * has `flex-1` so it pushes both this bar and the footer to the bottom —
 * no overlap, no fixed positioning needed.
 */
import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  Cpu,
  Activity,
  Radar,
  ShieldCheck,
  Terminal,
  Zap,
  House,
  MessageSquare,
} from "lucide-react";
import { useAeon, type View } from "@/lib/store";

const NAV: { id: View; label: string; icon: React.ElementType }[] = [
  { id: "core", label: "Core", icon: Brain },
  { id: "agents", label: "Agents", icon: Cpu },
  { id: "memory", label: "Memory", icon: Activity },
  { id: "sensory", label: "Sensory", icon: Radar },
  { id: "actions", label: "Actions", icon: ShieldCheck },
  { id: "triggers", label: "Triggers", icon: Zap },
  { id: "iot", label: "IoT", icon: House },
  { id: "console", label: "Console", icon: MessageSquare },
  { id: "logs", label: "Logs", icon: Terminal },
];

export function MobileBottomNav() {
  const view = useAeon((s) => s.view);
  const setView = useAeon((s) => s.setView);
  const railRef = useRef<HTMLDivElement>(null);

  // Keep the active button visible when the view changes (9 buttons don't
  // all fit on a 375px phone — this smooth-scrolls the rail so the active
  // item is centered).
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const activeBtn = rail.querySelector<HTMLElement>('[data-active="true"]');
    if (activeBtn) {
      activeBtn.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [view]);

  return (
    <div
      ref={railRef}
      role="navigation"
      aria-label="Primary navigation"
      className="aeon-scroll sticky bottom-0 z-40 flex shrink-0 items-stretch overflow-x-auto border-t border-border bg-background/95 backdrop-blur-md md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {NAV.map((item) => {
        const active = view === item.id;
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            data-active={active ? "true" : "false"}
            onClick={() => setView(item.id)}
            aria-label={item.label}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-14 w-[4.25rem] shrink-0 flex-col items-center justify-center gap-1 transition-colors ${
              active
                ? "text-[var(--aeon-core)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {/* top accent line — slides between buttons via layoutId */}
            {active && (
              <motion.span
                layoutId="mobile-nav-active"
                className="absolute left-2.5 right-2.5 top-0 h-0.5 rounded-full bg-[var(--aeon-core)]"
                style={{ boxShadow: "0 0 8px var(--aeon-core)" }}
              />
            )}

            <Icon
              className={`h-[18px] w-[18px] transition-transform ${
                active ? "animate-aeon-pulse" : ""
              }`}
              style={
                active
                  ? {
                      color: "var(--aeon-core)",
                      filter:
                        "drop-shadow(0 0 4px color-mix(in oklch, var(--aeon-core) 60%, transparent))",
                    }
                  : undefined
              }
            />

            <span className="font-mono text-[9px] font-semibold uppercase leading-none tracking-wider">
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
