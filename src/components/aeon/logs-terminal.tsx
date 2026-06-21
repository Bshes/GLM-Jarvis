"use client";
/**
 * LogsTerminal — the append-only structured system log, A.E.O.N.'s observability
 * surface. Every module logs through lib/logger which persists here and streams
 * live via the socket feed. Filterable by level + source.
 */
import { useState, useMemo } from "react";
import { Terminal, RotateCw, Trash2, Download } from "lucide-react";
import { useAeon } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const LEVELS = ["ALL", "DEBUG", "INFO", "WARN", "ERROR"] as const;
type Level = (typeof LEVELS)[number];

const LEVEL_COLOR: Record<string, string> = {
  DEBUG: "var(--muted-foreground)",
  INFO: "var(--aeon-active)",
  WARN: "var(--aeon-warn)",
  ERROR: "var(--aeon-danger)",
};

export function LogsTerminal() {
  const logs = useAeon((s) => s.logs);
  const refresh = useAeon((s) => s.refresh);
  const [level, setLevel] = useState<Level>("ALL");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (level !== "ALL" && l.level !== level) return false;
      if (query) {
        const q = query.toLowerCase();
        if (!l.message.toLowerCase().includes(q) && !l.source.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, level, query]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { DEBUG: 0, INFO: 0, WARN: 0, ERROR: 0 };
    for (const l of logs) c[l.level] = (c[l.level] ?? 0) + 1;
    return c;
  }, [logs]);

  function exportLogs() {
    const text = logs
      .map((l) => `${l.createdAt} [${l.level}] ${l.source}${l.phase ? `(${l.phase})` : ""} — ${l.message}`)
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
      {/* stat row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Total" value={String(logs.length)} accent="var(--aeon-core)" />
        {(["DEBUG", "INFO", "WARN", "ERROR"] as const).map((lv) => (
          <Stat key={lv} label={lv} value={String(counts[lv] ?? 0)} accent={LEVEL_COLOR[lv]} />
        ))}
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {LEVELS.map((lv) => (
            <button
              key={lv}
              onClick={() => setLevel(lv)}
              className={`rounded-sm border px-2 py-1 font-mono text-[10px] transition ${
                level === lv
                  ? "border-[var(--aeon-core)] bg-[var(--aeon-core)]/10 text-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
            >
              {lv}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="filter source/message…"
          className="h-7 w-40 rounded-sm border border-border/60 bg-background/60 px-2 font-mono text-[11px] outline-none focus:border-[var(--aeon-core)]/50"
        />
        <div className="ml-auto flex items-center gap-1.5">
          <Button size="sm" variant="ghost" onClick={exportLogs} className="gap-1 text-muted-foreground">
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <Button size="sm" variant="ghost" onClick={() => void refresh()} className="gap-1 text-muted-foreground">
            <RotateCw className="h-3.5 w-3.5" /> Sync
          </Button>
        </div>
      </div>

      {/* terminal */}
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border bg-black/50">
        <div className="flex items-center gap-2 border-b border-border/60 bg-background/40 px-3 py-1.5">
          <Terminal className="h-3 w-3 text-[var(--aeon-active)]" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">aeon://system/log</span>
          <span className="ml-auto inline-flex h-1.5 w-1.5 rounded-full bg-[var(--aeon-active)] animate-aeon-pulse" />
          <span className="font-mono text-[10px] text-[var(--aeon-active)]">live</span>
        </div>
        <ScrollArea className="aeon-scroll min-h-0 flex-1">
          <div className="p-3 font-mono text-[11px] leading-relaxed">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No log entries match the filter.</div>
            ) : (
              filtered.map((l) => {
                const color = LEVEL_COLOR[l.level] ?? "var(--muted-foreground)";
                return (
                  <div key={l.id} className="flex items-start gap-2 border-b border-border/20 py-1 last:border-0">
                    <span className="shrink-0 text-[10px] text-muted-foreground/60">
                      {new Date(l.createdAt).toLocaleTimeString("en-GB", { hour12: false })}
                    </span>
                    <span
                      className="shrink-0 rounded-sm px-1 text-[9px] font-bold"
                      style={{ color, background: `color-mix(in oklch, ${color} 14%, transparent)` }}
                    >
                      {l.level}
                    </span>
                    <span className="shrink-0 text-[10px] text-[var(--aeon-core)]/80">{l.source}{l.phase ? `·${l.phase}` : ""}</span>
                    <span className="min-w-0 flex-1 break-words text-foreground/85">{l.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card/40 p-3">
      <div className="absolute left-0 top-0 h-full w-0.5" style={{ background: accent }} />
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono text-lg font-bold" style={{ color: accent }}>{value}</div>
    </div>
  );
}
