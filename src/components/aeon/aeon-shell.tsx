"use client";
/**
 * AeonShell — the A.E.O.N. operating-system chrome.
 * Top status bar, left navigation rail, view router, sticky footer, and the
 * global sonner toast viewport. Mounts the live stream hook.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster as SonnerToaster } from "@/components/ui/sonner";
import {
  Brain, Cpu, Activity, Radar, ShieldCheck, Terminal, Zap, House,
  Wifi, WifiOff, Radio, ChevronRight, MessageSquare, Search, Settings, Sparkles,
} from "lucide-react";
import { useAeon, type View } from "@/lib/store";
import { useAeonStream } from "@/hooks/use-aeon-stream";
import { LOOP_PHASES, PHASE_META } from "@/lib/aeon";
import { clockString } from "@/components/aeon/ui";

import { CoreView } from "@/components/aeon/core-view";
import { AgentsPanel } from "@/components/aeon/agents-panel";
import MemoryGraphPanel from "@/components/aeon/memory-graph-panel";
import { SensoryPanel } from "@/components/aeon/sensory-panel";
import { ActionsPanel } from "@/components/aeon/actions-panel";
import { LogsTerminal } from "@/components/aeon/logs-terminal";
import TriggersPanel from "@/components/aeon/triggers-panel";
import { IoTPanel } from "@/components/aeon/iot-panel";
import { ConsolePanel } from "@/components/aeon/console-panel";
import { CommandPalette } from "@/components/aeon/command-palette";
import { MobileBottomNav } from "@/components/aeon/mobile-bottom-nav";
import { NotificationCenter } from "@/components/aeon/notification-center";
import { SettingsPanel } from "@/components/aeon/settings-panel";
import { SystemHealth } from "@/components/aeon/system-health";
import { ShortcutHelp } from "@/components/aeon/shortcut-help";
import { ThemeToggle } from "@/components/aeon/theme-toggle";
import { EnhancedConsole } from "@/components/aeon/enhanced-console";

const NAV: { id: View; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "core", label: "Core", icon: Brain, desc: "Cognitive loop" },
  { id: "agents", label: "Agents", icon: Cpu, desc: "Sub-agent collective" },
  { id: "memory", label: "Memory", icon: Activity, desc: "Graph + vector" },
  { id: "sensory", label: "Sensory", icon: Radar, desc: "Multimodal I/O" },
  { id: "actions", label: "Actions", icon: ShieldCheck, desc: "Tiered queue" },
  { id: "triggers", label: "Triggers", icon: Zap, desc: "Anticipatory" },
  { id: "iot", label: "IoT", icon: House, desc: "Smart home" },
  { id: "console", label: "Console", icon: MessageSquare, desc: "Direct LLM" },
  { id: "enhance", label: "Enhance", icon: Sparkles, desc: "Cognitive pipeline" },
  { id: "logs", label: "Logs", icon: Terminal, desc: "Observability" },
  { id: "settings", label: "Settings", icon: Settings, desc: "Preferences" },
];

export function AeonShell() {
  useAeonStream();
  const view = useAeon((s) => s.view);
  const setView = useAeon((s) => s.setView);
  const connected = useAeon((s) => s.connected);
  const orchestrating = useAeon((s) => s.orchestrating);
  const phase = useAeon((s) => s.phase);
  const pendingActions = useAeon((s) => s.pendingActions);
  const memoryCount = useAeon((s) => s.memoryCount);
  const stream = useAeon((s) => s.stream);
  const setCommandPaletteOpen = useAeon((s) => s.setCommandPaletteOpen);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Global keyboard shortcuts: ⌘K / Ctrl+K toggles the command palette;
  // number keys 1-9 + 0 jump to views (when not typing in an input).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA" || (e.target as HTMLElement)?.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if (typing) return;
      // 1-9 → views 0-8; 0 → view 9 (Settings, the 10th view)
      if (e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        if (idx < NAV.length) {
          e.preventDefault();
          setView(NAV[idx].id);
        }
      } else if (e.key === "0" && NAV.length >= 10) {
        e.preventDefault();
        setView(NAV[9].id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setCommandPaletteOpen, setView]);

  const latest = stream[0];
  const activeAgents = useAeon((s) => s.agents.length);

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* ===== Header / status bar ===== */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/85 backdrop-blur-md">
        <div className="flex h-14 items-center gap-3 px-3 md:px-5">
          {/* logo */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex h-8 w-8 items-center justify-center">
              <svg viewBox="0 0 40 40" className="h-8 w-8">
                <polygon points={hexPoints(20, 20, 16)} fill="none" stroke="var(--a_core)" strokeWidth="1.5" className="aeon-glow-core" />
                <circle cx="20" cy="20" r="3.5" fill="var(--a_core)" className="animate-aeon-pulse" />
                <g style={{ transformOrigin: "center", animation: "aeon-spin-slow 16s linear infinite" }}>
                  <circle cx="20" cy="20" r="18" fill="none" stroke="var(--a_core)" strokeOpacity="0.3" strokeWidth="0.75" strokeDasharray="2 4" />
                </g>
              </svg>
            </div>
            <div className="leading-none">
              <div className="font-mono text-sm font-bold tracking-[0.2em] text-[oklch(0.82_0.15_75)] aeon-text-glow">A.E.O.N.</div>
              <div className="hidden text-[9px] uppercase tracking-widest text-muted-foreground sm:block">autonomous entity · orchestration & navigation</div>
            </div>
          </div>

          {/* status pills */}
          <div className="ml-2 hidden items-center gap-1.5 md:flex">
            {LOOP_PHASES.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider transition-all"
                style={{
                  color: phase === p ? PHASE_META[p].color : "var(--muted-foreground)",
                  background: phase === p ? `color-mix(in oklch, ${PHASE_META[p].color} 16%, transparent)` : "transparent",
                  boxShadow: phase === p ? `0 0 8px color-mix(in oklch, ${PHASE_META[p].color} 40%, transparent)` : "none",
                }}
              >
                <span className="h-1 w-1 rounded-full" style={{ background: phase === p ? PHASE_META[p].color : "var(--muted-foreground)", opacity: phase === p ? 1 : 0.4 }} />
                {p.slice(0, 4)}
              </span>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2 md:gap-3">
            {/* live stats */}
            <div className="hidden items-center gap-3 lg:flex">
              <HeaderStat icon={Cpu} label="AGENTS" value={String(activeAgents)} color="var(--a_active)" />
              <HeaderStat icon={Activity} label="MEMORY" value={String(memoryCount)} color="var(--a_core)" />
              <HeaderStat icon={ShieldCheck} label="PENDING" value={String(pendingActions)} color={pendingActions > 0 ? "var(--a_warn)" : "var(--muted-foreground)"} />
            </div>

            {/* connection */}
            <div className="flex items-center gap-1.5 rounded-sm border border-border/60 bg-background/40 px-2 py-1">
              {connected ? <Wifi className="h-3 w-3 text-[oklch(0.74_0.16_158)]" /> : <WifiOff className="h-3 w-3 text-[oklch(0.64_0.21_18)]" />}
              <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: connected ? "var(--a_active)" : "var(--a_danger)" }}>
                {connected ? "LINK" : "OFFLINE"}
              </span>
              {orchestrating && <Radio className="h-3 w-3 animate-pulse text-[oklch(0.82_0.15_75)]" />}
            </div>

            {/* theme toggle */}
            <ThemeToggle />

            {/* system health indicator */}
            <SystemHealth />

            {/* notification center */}
            <NotificationCenter />

            {/* command palette trigger */}
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="hidden items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2.5 py-1 text-xs text-muted-foreground transition hover:border-[oklch(0.82_0.15_75)]/50 hover:text-foreground md:inline-flex"
              title="Open command palette (⌘K)"
            >
              <Search className="h-3.5 w-3.5 text-[oklch(0.82_0.15_75)]" />
              <span>Command</span>
              <kbd className="rounded-sm border border-border/60 bg-background/60 px-1 font-mono text-[9px]">⌘K</kbd>
            </button>
            <button
              onClick={() => setCommandPaletteOpen(true)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background/40 text-[oklch(0.82_0.15_75)] transition hover:border-[oklch(0.82_0.15_75)]/50 md:hidden"
              title="Command palette (⌘K)"
              aria-label="Open command palette"
            >
              <Search className="h-4 w-4" />
            </button>

            {/* clock */}
            <div className="hidden font-mono text-sm tabular-nums text-foreground sm:block">
              {clockString(now)}
            </div>
          </div>
        </div>
      </header>

      {/* ===== Body ===== */}
      <div className="flex min-h-0 flex-1">
        {/* sidebar nav — desktop only (mobile uses MobileBottomNav below) */}
        <nav className="sticky top-14 z-20 hidden h-[calc(100vh-3.5rem)] w-16 shrink-0 flex-col border-r border-border bg-background/60 py-3 md:flex md:w-52">
          {NAV.map((item) => {
            const active = view === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`group relative flex items-center gap-3 px-3 py-2.5 text-left transition ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute left-0 top-1/2 h-7 w-0.5 -translate-y-1/2 rounded-full bg-[oklch(0.82_0.15_75)]"
                    style={{ boxShadow: "0 0 8px var(--a_core)" }}
                  />
                )}
                <Icon className={`h-4 w-4 shrink-0 transition ${active ? "text-[oklch(0.82_0.15_75)]" : ""}`} />
                <span className="hidden font-mono text-xs font-medium uppercase tracking-wider md:inline">{item.label}</span>
                {active && <ChevronRight className="ml-auto hidden h-3 w-3 md:inline" />}
              </button>
            );
          })}

          <div className="mt-auto hidden px-3 py-2 md:block">
            <div className="rounded-md border border-border/40 bg-background/30 p-2">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.74_0.16_158)] animate-aeon-pulse" /> system nominal
              </div>
              <div className="mt-1 font-mono text-[9px] text-muted-foreground">core v1.0 · uptime ∞</div>
            </div>
          </div>
        </nav>

        {/* main view */}
        <main className="aeon-scroll min-h-0 flex-1 overflow-y-auto p-3 md:p-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={view}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="mx-auto flex min-h-[calc(100vh-7.5rem)] max-w-[1500px] flex-col"
            >
              <ViewHeader view={view} />
              <div className="min-h-0 flex-1">
                {view === "core" && <CoreView />}
                {view === "agents" && <AgentsPanel />}
                {view === "memory" && <MemoryGraphPanel />}
                {view === "sensory" && <SensoryPanel />}
                {view === "actions" && <ActionsPanel />}
                {view === "triggers" && <TriggersPanel />}
                {view === "iot" && <IoTPanel />}
                {view === "console" && <ConsolePanel />}
                {view === "enhance" && <EnhancedConsole />}
                {view === "logs" && <LogsTerminal />}
                {view === "settings" && <SettingsPanel />}
              </div>
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* ===== Mobile bottom navigation (above the footer, below the body) =====
          Renders only below md. The body row above is `flex-1` so it pushes
          this bar + the footer to the bottom of the viewport; no overlap. */}
      <MobileBottomNav />

      {/* ===== Sticky footer ===== */}
      <footer className="mt-auto border-t border-border bg-background/95 backdrop-blur-md">
        <div className="flex h-9 items-center gap-3 px-3 md:px-5">
          <span className="flex items-center gap-1.5 rounded-sm bg-[oklch(0.74_0.16_158)]/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-widest text-[oklch(0.74_0.16_158)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[oklch(0.74_0.16_158)] animate-aeon-pulse" /> stream
          </span>
          <div className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/70">
            {latest ? (
              <span>
                <span className="font-bold text-[oklch(0.82_0.15_75)]">[{latest.type.toUpperCase()}]</span>{" "}
                <span className="text-foreground/80">{latest.message ?? JSON.stringify(latest.data ?? "")}</span>
              </span>
            ) : (
              <span className="text-muted-foreground">awaiting events…</span>
            )}
          </div>
          <span className="hidden items-center gap-1 font-mono text-[10px] text-foreground/60 sm:inline">
            <span className="text-[oklch(0.82_0.15_75)]">{stream.length}</span> buffered
          </span>
          <span className="font-mono text-[10px] text-muted-foreground/60">·</span>
          <span className="font-mono text-[10px] font-semibold tracking-wider text-foreground/70">A.E.O.N. CORE</span>
        </div>
      </footer>

      {/* global sonner viewport */}
      <SonnerToaster
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            background: "var(--popover)",
            color: "var(--popover-foreground)",
            border: "1px solid var(--border)",
            fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
            fontSize: "12px",
          },
        }}
      />

      {/* ⌘K command palette */}
      <CommandPalette />

      {/* ? shortcut help overlay */}
      <ShortcutHelp />
    </div>
  );
}

function ViewHeader({ view }: { view: View }) {
  const item = NAV.find((n) => n.id === view)!;
  const Icon = item.icon;
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card/40">
        <Icon className="h-4 w-4 text-[oklch(0.82_0.15_75)]" />
      </div>
      <div>
        <h1 className="font-mono text-base font-bold tracking-wide text-foreground">{item.label.toUpperCase()}</h1>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">{item.desc}</p>
      </div>
    </div>
  );
}

function HeaderStat({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-3 w-3" style={{ color }} />
      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="font-mono text-xs font-bold tabular-nums" style={{ color }}>{value}</span>
    </div>
  );
}

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    pts.push(`${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`);
  }
  return pts.join(" ");
}
