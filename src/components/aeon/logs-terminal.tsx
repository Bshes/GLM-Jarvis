"use client";
/**
 * LogsTerminal — A.E.O.N.'s visually-rich structured system log.
 * Append-only observability surface with syntax-highlighted entries,
 * color-coded severity badges, collapsible source groups, live-tail
 * indicator, sparkline filter bar, and animated empty state.
 */
import {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import {
  Terminal,
  RotateCw,
  Download,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Code2,
  ChevronDown,
  ChevronRight,
  Radio,
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAeon } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { timeAgo } from "@/components/aeon/ui";
import type { LogView } from "@/lib/aeon";

/* ─── Level taxonomy ─── */

const LEVELS = ["ALL", "DEBUG", "INFO", "WARN", "ERROR"] as const;
type Level = (typeof LEVELS)[number];

interface LevelMeta {
  color: string;
  bg: string;
  border: string;
  icon: typeof AlertTriangle;
  glow?: string;
}

const LEVEL_META: Record<string, LevelMeta> = {
  DEBUG: {
    color: "var(--muted-foreground)",
    bg: "color-mix(in oklch, var(--muted-foreground) 10%, transparent)",
    border: "color-mix(in oklch, var(--muted-foreground) 25%, transparent)",
    icon: Code2,
  },
  INFO: {
    color: "var(--aeon-active)",
    bg: "color-mix(in oklch, var(--aeon-active) 10%, transparent)",
    border: "color-mix(in oklch, var(--aeon-active) 30%, transparent)",
    icon: CheckCircle,
  },
  WARN: {
    color: "var(--aeon-warn)",
    bg: "color-mix(in oklch, var(--aeon-warn) 10%, transparent)",
    border: "color-mix(in oklch, var(--aeon-warn) 30%, transparent)",
    icon: AlertCircle,
  },
  ERROR: {
    color: "var(--aeon-danger)",
    bg: "color-mix(in oklch, var(--aeon-danger) 10%, transparent)",
    border: "color-mix(in oklch, var(--aeon-danger) 35%, transparent)",
    icon: AlertTriangle,
    glow: "0 0 14px 2px color-mix(in oklch, var(--aeon-danger) 35%, transparent)",
  },
};

/* ─── Severity badge ─── */

function SeverityBadge({ level }: { level: string }) {
  const meta = LEVEL_META[level] ?? LEVEL_META.DEBUG;
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide uppercase"
      style={{
        color: meta.color,
        background: meta.bg,
        boxShadow: `inset 0 0 0 1px ${meta.border}`,
      }}
    >
      <Icon className="h-3 w-3 shrink-0" />
      {level === "ERROR" && (
        <span
          className="relative inline-flex h-1.5 w-1.5 shrink-0"
        >
          <span
            className="absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{
              background: meta.color,
              animation: "aeon-pulse 1.4s ease-in-out infinite",
            }}
          />
          <span
            className="relative inline-flex h-1.5 w-1.5 rounded-full"
            style={{ background: meta.color }}
          />
        </span>
      )}
      {level}
    </span>
  );
}

/* ─── Mini sparkline bar for filter buttons ─── */

function SparkBar({ count, max, color }: { count: number; max: number; color: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <span className="inline-flex h-3 w-8 items-end gap-px overflow-hidden">
      {Array.from({ length: 4 }).map((_, i) => {
        const barH = Math.max(2, (pct / 100) * 12 * (0.5 + (i / 3) * 0.5));
        return (
          <span
            key={i}
            className="inline-block w-1 rounded-sm"
            style={{
              height: `${barH}px`,
              background:
                i === 3
                  ? color
                  : `color-mix(in oklch, ${color} ${30 + i * 20}%, transparent)`,
            }}
          />
        );
      })}
    </span>
  );
}

/* ─── Stat card ─── */

function Stat({
  label,
  value,
  accent,
  icon,
}: {
  label: string;
  value: string;
  accent: string;
  icon?: ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card/40 p-3">
      <div className="absolute left-0 top-0 h-full w-0.5" style={{ background: accent }} />
      <div className="flex items-center gap-1.5">
        {icon && <span style={{ color: accent }}>{icon}</span>}
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-1 font-mono text-lg font-bold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}

/* ─── Timestamp with relative + absolute tooltip ─── */

function LogTimestamp({ iso }: { iso: string }) {
  const relative = timeAgo(iso);
  const absolute = new Date(iso).toLocaleString("en-GB", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground/70 cursor-default">
          {relative}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="font-mono text-[10px]">
        {absolute}
      </TooltipContent>
    </Tooltip>
  );
}

/* ─── Single log row ─── */

function LogRow({ log }: { log: LogView }) {
  const meta = LEVEL_META[log.level] ?? LEVEL_META.DEBUG;
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="group flex items-start gap-2 rounded-sm border-b border-border/15 py-1.5 px-2 transition-colors hover:bg-white/[0.02]"
      style={{
        borderLeft: `2.5px solid ${meta.color}`,
        background: meta.bg,
        boxShadow: meta.glow
          ? `${meta.glow}, inset 0 0 24px color-mix(in oklch, var(--aeon-danger) 4%, transparent)`
          : undefined,
      }}
    >
      {/* Timestamp */}
      <LogTimestamp iso={log.createdAt} />

      {/* Level badge */}
      <SeverityBadge level={log.level} />

      {/* Source */}
      <span className="shrink-0 font-mono text-[10px] text-[var(--aeon-core)]/70">
        {log.source}
        {log.phase ? (
          <span className="text-[var(--aeon-core)]/40">·{log.phase}</span>
        ) : null}
      </span>

      {/* Message */}
      <span className="min-w-0 flex-1 break-words font-mono text-[11px] leading-relaxed text-foreground/85">
        {log.message}
      </span>
    </motion.div>
  );
}

/* ─── Animated empty state ─── */

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground/50">
      <Terminal className="h-8 w-8" style={{ color: "var(--aeon-core)", opacity: 0.3 }} />
      <span className="font-mono text-sm">
        <span className="animate-aeon-blink inline-block h-4 w-2 translate-y-[2px] bg-[var(--aeon-core)]/50" />
        {" "}awaiting log entries…
      </span>
    </div>
  );
}

/* ─── Live tail indicator ─── */

function LiveTailIndicator({ newCount }: { newCount: number }) {
  if (newCount <= 0) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-2 rounded-md border border-[var(--aeon-active)]/30 bg-[var(--aeon-active)]/10 px-3 py-1"
    >
      <span className="relative inline-flex h-2 w-2">
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-60"
          style={{
            background: "var(--aeon-active)",
            animation: "aeon-pulse 1s ease-in-out infinite",
          }}
        />
        <span
          className="relative inline-flex h-2 w-2 rounded-full"
          style={{ background: "var(--aeon-active)" }}
        />
      </span>
      <span className="font-mono text-[10px] font-bold tracking-widest uppercase text-[var(--aeon-active)]">
        LIVE
      </span>
      <span className="rounded-sm bg-[var(--aeon-active)]/20 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[var(--aeon-active)]">
        +{newCount}
      </span>
    </motion.div>
  );
}

/* ─── Source group (collapsible) ─── */

interface SourceGroup {
  source: string;
  logs: LogView[];
  dominantLevel: string;
}

function SourceGroupSection({
  group,
  defaultOpen,
}: {
  group: SourceGroup;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const meta = LEVEL_META[group.dominantLevel] ?? LEVEL_META.DEBUG;
  const counts = useMemo(() => {
    const c: Record<string, number> = { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 };
    for (const l of group.logs) c[l.level] = (c[l.level] ?? 0) + 1;
    return c;
  }, [group.logs]);

  return (
    <div className="border-b border-border/15 last:border-0">
      {/* Header */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/[0.02]"
      >
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
        )}
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: meta.color }}
        />
        <span className="font-mono text-[11px] font-semibold text-foreground/80">
          {group.source}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/60">
          {group.logs.length} {group.logs.length === 1 ? "entry" : "entries"}
        </span>
        {/* Mini level distribution pills */}
        <span className="ml-auto flex items-center gap-1">
          {(["ERROR", "WARN", "INFO", "DEBUG"] as const).map((lv) =>
            counts[lv] > 0 ? (
              <span
                key={lv}
                className="inline-flex h-3.5 items-center rounded-sm px-1 font-mono text-[8px] font-bold"
                style={{
                  color: LEVEL_META[lv].color,
                  background: LEVEL_META[lv].bg,
                }}
              >
                {counts[lv]}
              </span>
            ) : null,
          )}
        </span>
      </button>

      {/* Body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="space-y-px px-2 pb-2">
              {group.logs.map((l) => (
                <LogRow key={l.id} log={l} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ─── Main component ─── */

export function LogsTerminal() {
  const logs = useAeon((s) => s.logs);
  const refresh = useAeon((s) => s.refresh);
  const [level, setLevel] = useState<Level>("ALL");
  const [query, setQuery] = useState("");
  const [groupBySource, setGroupBySource] = useState(false);
  const [newSinceScroll, setNewSinceScroll] = useState(0);
  const prevLogCount = useRef(logs.length);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track new entries for live tail indicator
  useEffect(() => {
    const delta = logs.length - prevLogCount.current;
    if (delta > 0) {
      setNewSinceScroll((n) => n + delta);
    }
    prevLogCount.current = logs.length;
  }, [logs.length]);

  // Reset new count when user scrolls
  const handleScroll = useCallback(() => {
    setNewSinceScroll(0);
  }, []);

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (level !== "ALL" && l.level !== level) return false;
      if (query) {
        const q = query.toLowerCase();
        if (
          !l.message.toLowerCase().includes(q) &&
          !l.source.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [logs, level, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 };
    for (const l of logs) c[l.level] = (c[l.level] ?? 0) + 1;
    return c;
  }, [logs]);

  const maxCount = useMemo(
    () => Math.max(1, ...Object.values(counts)),
    [counts],
  );

  // Group by source
  const sourceGroups = useMemo(() => {
    if (!groupBySource) return [];
    const map = new Map<string, LogView[]>();
    for (const l of filtered) {
      const arr = map.get(l.source) ?? [];
      arr.push(l);
      map.set(l.source, arr);
    }
    // Determine dominant level per group for the indicator color
    const levelPriority: Record<string, number> = {
      ERROR: 4,
      WARN: 3,
      INFO: 2,
      DEBUG: 1,
    };
    const groups: SourceGroup[] = [];
    for (const [source, entries] of map) {
      const dominant = entries.reduce((best, l) =>
        (levelPriority[l.level] ?? 0) > (levelPriority[best.level] ?? 0)
          ? l
          : best,
      );
      groups.push({ source, logs: entries, dominantLevel: dominant.level });
    }
    // Sort by dominant level priority desc, then by count desc
    groups.sort((a, b) => {
      const pa = levelPriority[a.dominantLevel] ?? 0;
      const pb = levelPriority[b.dominantLevel] ?? 0;
      if (pb !== pa) return pb - pa;
      return b.logs.length - a.logs.length;
    });
    return groups;
  }, [filtered, groupBySource]);

  function exportLogs() {
    const text = logs
      .map(
        (l) =>
          `${l.createdAt} [${l.level}] ${l.source}${l.phase ? `(${l.phase})` : ""} — ${l.message}`,
      )
      .join("\n");
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aeon-logs-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col gap-3">
      {/* ── Stat row ── */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat
          label="Total"
          value={String(logs.length)}
          accent="var(--aeon-core)"
          icon={<Terminal className="h-3 w-3" />}
        />
        {(["DEBUG", "INFO", "WARN", "ERROR"] as const).map((lv) => {
          const meta = LEVEL_META[lv];
          const Icon = meta.icon;
          return (
            <Stat
              key={lv}
              label={lv}
              value={String(counts[lv] ?? 0)}
              accent={meta.color}
              icon={<Icon className="h-3 w-3" />}
            />
          );
        })}
      </div>

      {/* ── Controls ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Level filter buttons with sparklines */}
        <div className="flex items-center gap-1">
          {LEVELS.map((lv) => {
            const isActive = level === lv;
            const meta = LEVEL_META[lv];
            const count = lv === "ALL" ? logs.length : (counts[lv] ?? 0);
            return (
              <button
                key={lv}
                onClick={() => setLevel(lv)}
                className={`flex items-center gap-1.5 rounded-sm border px-2 py-1 font-mono text-[10px] font-medium transition-all ${
                  isActive
                    ? "text-foreground"
                    : "border-border/40 text-muted-foreground hover:text-foreground"
                }`}
                style={
                  isActive
                    ? {
                        borderColor: lv === "ALL" ? "var(--aeon-core)" : meta.color,
                        background:
                          lv === "ALL"
                            ? "color-mix(in oklch, var(--aeon-core) 10%, transparent)"
                            : meta.bg,
                        boxShadow: `0 0 8px color-mix(in oklch, ${lv === "ALL" ? "var(--aeon-core)" : meta.color} 15%, transparent)`,
                      }
                    : undefined
                }
              >
                {lv !== "ALL" && (
                  <SparkBar
                    count={count}
                    max={maxCount}
                    color={meta.color}
                  />
                )}
                {lv}
                <span className="text-muted-foreground/60">{count}</span>
              </button>
            );
          })}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/50" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="filter source / message…"
            className="h-7 w-40 rounded-sm border border-border/60 bg-background/60 pl-7 pr-2 font-mono text-[11px] outline-none transition-colors focus:border-[var(--aeon-core)]/50"
          />
        </div>

        {/* Group toggle */}
        <button
          onClick={() => setGroupBySource((g) => !g)}
          className={`rounded-sm border px-2 py-1 font-mono text-[10px] transition-all ${
            groupBySource
              ? "border-[var(--aeon-core)]/40 bg-[var(--aeon-core)]/10 text-foreground"
              : "border-border/40 text-muted-foreground hover:text-foreground"
          }`}
        >
          {groupBySource ? "▦ Grouped" : "☰ Flat"}
        </button>

        {/* Action buttons */}
        <div className="ml-auto flex items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={exportLogs}
            className="gap-1 text-muted-foreground"
          >
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => void refresh()}
            className="gap-1 text-muted-foreground"
          >
            <RotateCw className="h-3.5 w-3.5" /> Sync
          </Button>
        </div>
      </div>

      {/* ── Terminal frame ── */}
      <div className="aeon-grid-bg relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-black/50">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-border/60 bg-background/40 px-3 py-1.5">
          <Terminal className="h-3 w-3 text-[var(--aeon-active)]" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            aeon://system/log
          </span>

          {/* Live indicator */}
          <span className="relative ml-1 inline-flex h-1.5 w-1.5">
            <span
              className="absolute inline-flex h-full w-full rounded-full opacity-50"
              style={{
                background: "var(--aeon-active)",
                animation: "aeon-pulse 2.4s ease-in-out infinite",
              }}
            />
            <span
              className="relative inline-flex h-1.5 w-1.5 rounded-full"
              style={{ background: "var(--aeon-active)" }}
            />
          </span>
          <span className="font-mono text-[10px] text-[var(--aeon-active)]">
            live
          </span>

          {/* New entries indicator */}
          <AnimatePresence>
            <LiveTailIndicator newCount={newSinceScroll} />
          </AnimatePresence>

          <span className="ml-auto font-mono text-[10px] text-muted-foreground/50">
            {filtered.length} of {logs.length}
          </span>
        </div>

        {/* Log content */}
        <ScrollArea
          className="aeon-scroll min-h-0 flex-1"
          onScroll={handleScroll}
          ref={scrollRef}
        >
          <div className="p-2">
            {filtered.length === 0 ? (
              <EmptyState />
            ) : groupBySource && sourceGroups.length > 0 ? (
              /* ── Grouped view ── */
              <div className="space-y-0">
                {sourceGroups.map((g, i) => (
                  <SourceGroupSection
                    key={g.source}
                    group={g}
                    defaultOpen={i < 3}
                  />
                ))}
              </div>
            ) : (
              /* ── Flat view ── */
              <div className="space-y-px">
                {filtered.map((l) => (
                  <LogRow key={l.id} log={l} />
                ))}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Bottom bar with level summary strip */}
        <div className="flex items-center gap-2 border-t border-border/40 bg-background/30 px-3 py-1">
          {(["ERROR", "WARN", "INFO", "DEBUG"] as const).map((lv) => {
            const meta = LEVEL_META[lv];
            const count = counts[lv] ?? 0;
            if (count === 0) return null;
            return (
              <span
                key={lv}
                className="inline-flex items-center gap-1 font-mono text-[9px]"
                style={{ color: meta.color }}
              >
                <span
                  className="h-1 w-1 rounded-full"
                  style={{ background: meta.color }}
                />
                {count} {lv}
              </span>
            );
          })}
          <span className="ml-auto font-mono text-[9px] text-muted-foreground/40">
            {filtered.length === logs.length
              ? "showing all"
              : `filtered · ${filtered.length}/${logs.length}`}
          </span>
        </div>
      </div>
    </div>
  );
}

export default LogsTerminal;
