"use client";
/**
 * CommandPalette — ⌘K / Ctrl+K operator console.
 *
 * Fuzzy navigation across all views, quick directive dispatch, system actions
 * (seed, sync, evaluate triggers, clear stream). The native "OS" feel.
 */
import { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, CornerDownLeft, ArrowUp, ArrowDown, Brain, Cpu, Activity, Radar,
  ShieldCheck, Zap, House, MessageSquare, Terminal, Send, Database, RotateCw,
  Radio, Trash2, CornerDownLeft as EnterIcon, Command, type LucideIcon,
} from "lucide-react";
import { useAeon, type View } from "@/lib/store";
import { LOOP_PHASES } from "@/lib/aeon";
import {
  Dialog, DialogContent,
} from "@/components/ui/dialog";
import { toast } from "sonner";

interface Command {
  id: string;
  label: string;
  hint?: string;
  group: "navigate" | "dispatch" | "system";
  icon: LucideIcon;
  keywords: string[];
  action: () => void | Promise<void>;
  shortcut?: string;
}

const VIEW_ICONS: Record<View, LucideIcon> = {
  core: Brain,
  agents: Cpu,
  memory: Activity,
  sensory: Radar,
  actions: ShieldCheck,
  triggers: Zap,
  iot: House,
  console: MessageSquare,
  logs: Terminal,
};

const VIEW_LABELS: Record<View, string> = {
  core: "Core",
  agents: "Agents",
  memory: "Memory",
  sensory: "Sensory",
  actions: "Actions",
  triggers: "Triggers",
  iot: "IoT",
  console: "Console",
  logs: "Logs",
};

const QUICK_DISPATCH = [
  { label: "Dim living room to 30% warm — evening mode", tier: 1 },
  { label: "Lock the front door", tier: 1 },
  { label: "Research latest autonomous AI agent breakthroughs", tier: 1 },
  { label: "Refactor the database schema for multi-tenant access", tier: 2 },
  { label: "Pay the electricity bill if under $200", tier: 2 },
  { label: "Should I rebalance my portfolio this quarter?", tier: 3 },
];

function fuzzyScore(query: string, target: string): number {
  if (!query) return 1;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return 100 - (t.indexOf(q));
  // Subsequence match
  let qi = 0;
  let score = 0;
  let lastMatch = -1;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      score += lastMatch === ti - 1 ? 8 : 4;
      lastMatch = ti;
      qi++;
    }
  }
  if (qi < q.length) return 0;
  return score;
}

export function CommandPalette() {
  const open = useAeon((s) => s.commandPaletteOpen);
  const setOpen = useAeon((s) => s.setCommandPaletteOpen);
  const setView = useAeon((s) => s.setView);
  const dispatch = useAeon((s) => s.dispatch);
  const refresh = useAeon((s) => s.refresh);
  const clearStream = useAeon((s) => s.clearStream);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands = useMemo<Command[]>(() => {
    const nav: Command[] = (Object.keys(VIEW_ICONS) as View[]).map((v) => ({
      id: `nav-${v}`,
      label: `Go to ${VIEW_LABELS[v]}`,
      hint: VIEW_LABELS[v],
      group: "navigate",
      icon: VIEW_ICONS[v],
      keywords: [v, VIEW_LABELS[v].toLowerCase(), "go", "view", "navigate"],
      action: () => {
        setView(v);
        setOpen(false);
      },
      shortcut: String((Object.keys(VIEW_ICONS) as View[]).indexOf(v) + 1),
    }));

    const disp: Command[] = QUICK_DISPATCH.map((d, i) => ({
      id: `dispatch-${i}`,
      label: d.label,
      hint: `Dispatch · T${d.tier}`,
      group: "dispatch",
      icon: Send,
      keywords: ["dispatch", "run", "cycle", "orchestrate", ...d.label.toLowerCase().split(/\s+/)],
      action: async () => {
        setOpen(false);
        setView("core");
        await dispatch(d.label);
        toast.success("Directive dispatched");
      },
    }));

    const sys: Command[] = [
      {
        id: "sys-seed",
        label: "Re-seed the database (agents, devices, graph, triggers)",
        group: "system",
        icon: Database,
        keywords: ["seed", "reset", "database", "init"],
        action: async () => {
          setOpen(false);
          const res = await fetch("/api/aeon/seed", { method: "POST" });
          const data = await res.json();
          await refresh();
          toast.success(`Seeded: ${data.seeded?.join(", ")}`);
        },
      },
      {
        id: "sys-sync",
        label: "Sync all data from server",
        group: "system",
        icon: RotateCw,
        keywords: ["sync", "refresh", "reload"],
        action: async () => {
          setOpen(false);
          await refresh();
          toast.success("Synced");
        },
      },
      {
        id: "sys-eval",
        label: "Run anticipatory trigger evaluation",
        group: "system",
        icon: Radio,
        keywords: ["trigger", "evaluate", "anticipatory", "check"],
        action: async () => {
          setOpen(false);
          const res = await fetch("/api/aeon/triggers/evaluate");
          const data = await res.json();
          await refresh();
          if (data.fired?.length) {
            toast.success(`Fired: ${data.fired.map((f: { trigger: string }) => f.trigger).join(", ")}`);
          } else {
            toast.info("No triggers fired");
          }
        },
      },
      {
        id: "sys-clear",
        label: "Clear live event stream",
        group: "system",
        icon: Trash2,
        keywords: ["clear", "stream", "events", "flush"],
        action: () => {
          clearStream();
          setOpen(false);
          toast.info("Stream cleared");
        },
      },
    ];

    return [...nav, ...disp, ...sys];
  }, [dispatch, refresh, clearStream, setView, setOpen]);

  const filtered = useMemo(() => {
    if (!query.trim()) return commands;
    return commands
      .map((c) => {
        const haystack = [c.label, ...(c.keywords ?? [])].join(" ");
        return { c, score: fuzzyScore(query, haystack) };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
  }, [commands, query]);

  // Reset selection when query/open changes.
  useEffect(() => {
    setSelected(0);
  }, [query, open]);

  // Focus input on open.
  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation within the palette.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelected((s) => Math.min(s + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelected((s) => Math.max(s - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[selected];
        if (cmd) void cmd.action();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, selected, setOpen]);

  // Group filtered results for display.
  const grouped = useMemo(() => {
    const groups: Record<string, Command[]> = { navigate: [], dispatch: [], system: [] };
    for (const c of filtered) groups[c.group].push(c);
    return groups;
  }, [filtered]);

  const GROUP_LABEL: Record<string, string> = {
    navigate: "Navigate",
    dispatch: "Quick Dispatch",
    system: "System Actions",
  };
  const GROUP_COLOR: Record<string, string> = {
    navigate: "var(--aeon-active)",
    dispatch: "var(--aeon-core)",
    system: "var(--aeon-warn)",
  };

  // Flatten for index tracking across groups.
  let runningIndex = -1;

  return (
    <Dialog open={open} onOpenChange={(o) => setOpen(o)}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden border-border bg-popover/95 p-0 backdrop-blur-xl [&>button]:hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border/60 px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-[var(--aeon-core)]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, view, or directive…"
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded-sm border border-border/60 bg-background/40 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground sm:inline">
            ESC to close
          </kbd>
        </div>

        {/* Results */}
        <div className="aeon-scroll max-h-[420px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Search className="h-6 w-6 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">No commands match "{query}"</p>
            </div>
          ) : (
            (["navigate", "dispatch", "system"] as const).map((group) => {
              const items = grouped[group];
              if (items.length === 0) return null;
              return (
                <div key={group} className="mb-1.5 last:mb-0">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: GROUP_COLOR[group] }}>
                    <span className="h-1 w-1 rounded-full" style={{ background: GROUP_COLOR[group] }} />
                    {GROUP_LABEL[group]}
                    <span className="ml-auto font-mono text-muted-foreground">{items.length}</span>
                  </div>
                  {items.map((cmd) => {
                    runningIndex++;
                    const idx = runningIndex;
                    const isSel = idx === selected;
                    const Icon = cmd.icon;
                    return (
                      <button
                        key={cmd.id}
                        onMouseEnter={() => setSelected(idx)}
                        onClick={() => void cmd.action()}
                        className="group flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition"
                        style={{
                          background: isSel ? "color-mix(in oklch, var(--aeon-core) 10%, transparent)" : "transparent",
                          boxShadow: isSel ? "inset 0 0 0 1px color-mix(in oklch, var(--aeon-core) 35%, transparent)" : "none",
                        }}
                      >
                        <div
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
                          style={{
                            borderColor: isSel ? "color-mix(in oklch, var(--aeon-core) 40%, transparent)" : "var(--border)",
                            background: isSel ? "color-mix(in oklch, var(--aeon-core) 14%, transparent)" : "var(--background)",
                          }}
                        >
                          <Icon className="h-3.5 w-3.5" style={{ color: isSel ? "var(--aeon-core)" : "var(--muted-foreground)" }} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm text-foreground">{cmd.label}</div>
                          {cmd.hint && <div className="truncate text-[10px] text-muted-foreground">{cmd.hint}</div>}
                        </div>
                        {cmd.shortcut && (
                          <kbd className="shrink-0 rounded-sm border border-border/60 bg-background/40 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                            {cmd.shortcut}
                          </kbd>
                        )}
                        {isSel && (
                          <CornerDownLeft className="h-3 w-3 shrink-0 text-[var(--aeon-core)]" />
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-border/60 bg-background/40 px-4 py-2 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <ArrowUp className="h-3 w-3" /><ArrowDown className="h-3 w-3" /> navigate
          </span>
          <span className="inline-flex items-center gap-1">
            <CornerDownLeft className="h-3 w-3" /> select
          </span>
          <span className="inline-flex items-center gap-1">
            <Command className="h-3 w-3" />K toggle
          </span>
          <span className="ml-auto font-mono">{filtered.length} results</span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
