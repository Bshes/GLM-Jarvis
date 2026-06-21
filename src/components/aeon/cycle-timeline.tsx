"use client";
/**
 * CycleTimeline — persistent history of completed orchestration cycles.
 * Rendered as a horizontal scrolling strip on the Core view; clicking a cycle
 * opens a detail drawer with the full PERCEIVE/THINK/ACT/REFLECT transcript.
 */
import { motion, AnimatePresence } from "framer-motion";
import { History, X, Cpu, Clock, Activity, Brain, Zap, ChevronRight } from "lucide-react";
import { useAeon, type CycleHistoryView } from "@/lib/store";
import { timeAgo } from "@/components/aeon/ui";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useEffect } from "react";

const OUTCOME_COLOR: Record<string, string> = {
  executed: "var(--aeon-active)",
  "awaiting-confirmation": "var(--aeon-warn)",
  advisory: "var(--aeon-danger)",
};

export function CycleTimeline() {
  const cycles = useAeon((s) => s.cycles);
  const refreshCycles = useAeon((s) => s.refreshCycles);
  const selected = useAeon((s) => s.selectedCycle);
  const selectCycle = useAeon((s) => s.selectCycle);

  useEffect(() => {
    void refreshCycles();
  }, [refreshCycles]);

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <History className="h-3.5 w-3.5 text-[var(--aeon-core)]" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">cycle history</span>
        <span className="font-mono text-[10px] text-[var(--aeon-core)]">{cycles.length}</span>
        <Button size="sm" variant="ghost" onClick={() => void refreshCycles()} className="ml-auto h-6 px-2 text-[10px] text-muted-foreground">
          <Activity className="mr-1 h-3 w-3" /> Sync
        </Button>
      </div>

      {cycles.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No cycles yet. Dispatch a directive to begin the timeline.
        </div>
      ) : (
        <ScrollArea className="aeon-scroll w-full pb-1">
          <div className="flex gap-2 px-0.5">
            {cycles.map((c) => {
              const active = selected?.id === c.id;
              const color = OUTCOME_COLOR[c.outcome] ?? "var(--muted-foreground)";
              return (
                <button
                  key={c.id}
                  onClick={() => selectCycle(active ? null : c)}
                  className="group relative w-[230px] shrink-0 overflow-hidden rounded-md border bg-background/40 p-2.5 text-left transition hover:bg-background/60"
                  style={{
                    borderColor: active ? color : "var(--border)",
                    boxShadow: active ? `0 0 0 1px ${color}, 0 0 14px color-mix(in oklch, ${color} 35%, transparent)` : "none",
                  }}
                >
                  <div className="absolute left-0 top-0 h-full w-0.5" style={{ background: color }} />
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
                    <span className="truncate font-mono text-[10px] text-muted-foreground">{c.cycleId}</span>
                    <span className="ml-auto font-mono text-[9px]" style={{ color: c.route === "cloud" ? "var(--aeon-core)" : "var(--aeon-active)" }}>
                      {c.route === "cloud" ? "CLOUD" : "LOCAL"}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-snug text-foreground/90">{c.input}</p>
                  <div className="mt-1.5 flex items-center gap-2 text-[9px] text-muted-foreground">
                    <span className="inline-flex items-center gap-0.5">
                      <Clock className="h-2.5 w-2.5" /> {(c.durationMs / 1000).toFixed(1)}s
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <Zap className="h-2.5 w-2.5" /> {c.actionCount} act
                    </span>
                    <span className="inline-flex items-center gap-0.5">
                      <Brain className="h-2.5 w-2.5" /> {c.memoriesCreated} mem
                    </span>
                    <span className="ml-auto">{timeAgo(c.createdAt)}</span>
                  </div>
                  {/* complexity bar */}
                  <div className="mt-1.5 h-0.5 w-full overflow-hidden rounded-full bg-border/40">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(c.complexity * 100)}%`,
                        background: c.route === "cloud" ? "var(--aeon-core)" : "var(--aeon-active)",
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      )}

      <CycleDetail />
    </div>
  );
}

function CycleDetail() {
  const selected = useAeon((s) => s.selectedCycle);
  const selectCycle = useAeon((s) => s.selectCycle);

  return (
    <AnimatePresence>
      {selected && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.22 }}
          className="overflow-hidden"
        >
          <div className="mt-3 rounded-md border border-border/60 bg-background/40 p-3">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="outline" className="border-border/60 font-mono text-[9px]" style={{ color: OUTCOME_COLOR[selected.outcome] ?? "var(--muted-foreground)" }}>
                {selected.outcome.toUpperCase()}
              </Badge>
              <span className="font-mono text-[10px] text-muted-foreground">{selected.cycleId}</span>
              <Button size="sm" variant="ghost" onClick={() => selectCycle(null)} className="ml-auto h-6 w-6 p-0">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Field label="INPUT" color="var(--foreground)" icon={ChevronRight}>
                <p className="text-xs text-foreground/90">{selected.input}</p>
              </Field>
              <Field label="ROUTING" color="var(--aeon-active)" icon={Cpu}>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <Badge variant="outline" className="border-border/60 font-mono text-[9px]" style={{ color: selected.route === "cloud" ? "var(--aeon-core)" : "var(--aeon-active)" }}>
                    {selected.model}
                  </Badge>
                  <span className="font-mono text-muted-foreground">complexity {selected.complexity.toFixed(2)}</span>
                  {selected.thinking && <Badge variant="outline" className="border-[var(--aeon-think)]/40 font-mono text-[9px] text-[var(--aeon-think)]">THINKING</Badge>}
                  <span className="font-mono text-muted-foreground">· {selected.durationMs}ms</span>
                </div>
              </Field>
              <Field label="PERCEIVE" color="var(--aeon-perceive)" icon={Activity}>
                <p className="text-xs leading-relaxed text-foreground/80">{selected.perception}</p>
              </Field>
              <Field label="THINK" color="var(--aeon-think)" icon={Brain}>
                <p className="text-xs leading-relaxed text-foreground/80">{selected.thought}</p>
              </Field>
              <Field label="REFLECT" color="var(--aeon-reflect)" icon={Zap}>
                <p className="text-xs leading-relaxed text-foreground/80">{selected.reflection}</p>
              </Field>
              <Field label="METRICS" color="var(--aeon-core)" icon={Clock}>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <Metric label="DURATION" value={`${(selected.durationMs / 1000).toFixed(1)}s`} />
                  <Metric label="ACTIONS" value={String(selected.actionCount)} />
                  <Metric label="MEMORIES" value={String(selected.memoriesCreated)} />
                </div>
              </Field>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Field({ label, color, icon: Icon, children }: { label: string; color: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-md border border-border/40 bg-background/30 p-2.5">
      <div className="absolute left-0 top-0 h-full w-0.5" style={{ background: color }} />
      <div className="mb-1 flex items-center gap-1.5 pl-1 text-[9px] font-bold uppercase tracking-widest" style={{ color }}>
        <Icon className="h-2.5 w-2.5" /> {label}
      </div>
      <div className="pl-1">{children}</div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-background/40 p-1.5">
      <div className="font-mono text-sm font-bold text-foreground">{value}</div>
      <div className="text-[8px] uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}
