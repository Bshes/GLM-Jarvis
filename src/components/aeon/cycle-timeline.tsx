"use client";
/**
 * CycleTimeline — persistent history of completed orchestration cycles.
 * Rendered as a horizontal scrolling strip on the Core view; clicking a cycle
 * opens a detail drawer with the full PERCEIVE/THINK/ACT/REFLECT transcript.
 *
 * Includes a HUD-style filter bar above the strip: a keyword search across the
 * input/thought/perception/reflection fields plus route chips (All/Local/Cloud)
 * and outcome chips (All/Executed/Awaiting/Advisory). The displayed set is the
 * intersection of all active filters (useMemo). When filters yield zero results
 * a dedicated empty-state replaces the strip; the "No cycles yet" message only
 * shows when there are genuinely zero cycles total.
 */
import { motion, AnimatePresence } from "framer-motion";
import {
  History, X, Cpu, Clock, Activity, Brain, Zap, ChevronRight, Search, SlidersHorizontal,
} from "lucide-react";
import { useAeon, type CycleHistoryView } from "@/lib/store";
import { timeAgo } from "@/components/aeon/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useState } from "react";

const OUTCOME_COLOR: Record<string, string> = {
  executed: "var(--a_active)",
  "awaiting-confirmation": "var(--a_warn)",
  advisory: "var(--a_danger)",
};

type RouteFilter = "all" | "local" | "cloud";
type OutcomeFilter = "all" | "executed" | "awaiting-confirmation" | "advisory";

const ROUTE_CHIPS: { value: RouteFilter; label: string; color: string }[] = [
  { value: "all", label: "All", color: "var(--a_core)" },
  { value: "local", label: "Local", color: "var(--a_core)" },
  { value: "cloud", label: "Cloud", color: "var(--a_core)" },
];

const OUTCOME_CHIPS: { value: OutcomeFilter; label: string; color: string }[] = [
  { value: "all", label: "All", color: "var(--a_core)" },
  { value: "executed", label: "Executed", color: "var(--a_active)" },
  { value: "awaiting-confirmation", label: "Awaiting", color: "var(--a_warn)" },
  { value: "advisory", label: "Advisory", color: "var(--a_danger)" },
];

export function CycleTimeline() {
  const cycles = useAeon((s) => s.cycles);
  const refreshCycles = useAeon((s) => s.refreshCycles);
  const selected = useAeon((s) => s.selectedCycle);
  const selectCycle = useAeon((s) => s.selectCycle);

  // Filter state — keyword search + route + outcome dimensions.
  const [query, setQuery] = useState("");
  const [routeFilter, setRouteFilter] = useState<RouteFilter>("all");
  const [outcomeFilter, setOutcomeFilter] = useState<OutcomeFilter>("all");

  useEffect(() => {
    void refreshCycles();
  }, [refreshCycles]);

  // Intersection of: search match AND route filter AND outcome filter.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cycles.filter((c) => {
      if (routeFilter !== "all" && c.route !== routeFilter) return false;
      if (outcomeFilter !== "all" && c.outcome !== outcomeFilter) return false;
      if (q) {
        const haystack = `${c.input} ${c.thought} ${c.perception} ${c.reflection}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [cycles, query, routeFilter, outcomeFilter]);

  const hasFilters =
    query.trim() !== "" || routeFilter !== "all" || outcomeFilter !== "all";

  const clearFilters = () => {
    setQuery("");
    setRouteFilter("all");
    setOutcomeFilter("all");
  };

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <History className="h-3.5 w-3.5 text-[oklch(0.82_0.15_75)]" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">cycle history</span>
        <span className="font-mono text-[10px] text-[oklch(0.82_0.15_75)]">{cycles.length}</span>
        <Button size="sm" variant="ghost" onClick={() => void refreshCycles()} className="ml-auto h-6 px-2 text-[10px] text-muted-foreground">
          <Activity className="mr-1 h-3 w-3" /> Sync
        </Button>
      </div>

      {/* Filter bar — only renders once there is at least one cycle to filter. */}
      {cycles.length > 0 && (
        <FilterBar
          query={query}
          onQuery={setQuery}
          route={routeFilter}
          onRoute={setRouteFilter}
          outcome={outcomeFilter}
          onOutcome={setOutcomeFilter}
          resultCount={filtered.length}
          total={cycles.length}
          hasFilters={hasFilters}
          onClear={clearFilters}
        />
      )}

      {cycles.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          No cycles yet. Dispatch a directive to begin the timeline.
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">No cycles match your filters.</p>
          <Button size="sm" variant="outline" onClick={clearFilters} className="h-7 px-2 text-[10px]">
            <X className="mr-1 h-3 w-3" /> Clear filters
          </Button>
        </div>
      ) : (
        <ScrollArea className="aeon-scroll w-full pb-1">
          <div className="flex gap-2 px-0.5">
            {filtered.map((c) => {
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
                    <span className="ml-auto font-mono text-[9px]" style={{ color: c.route === "cloud" ? "var(--a_core)" : "var(--a_active)" }}>
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
                        background: c.route === "cloud" ? "var(--a_core)" : "var(--a_active)",
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

/* ------------------------------------------------------------------ */
/*  Filter bar                                                         */
/* ------------------------------------------------------------------ */

function FilterBar({
  query,
  onQuery,
  route,
  onRoute,
  outcome,
  onOutcome,
  resultCount,
  total,
  hasFilters,
  onClear,
}: {
  query: string;
  onQuery: (v: string) => void;
  route: RouteFilter;
  onRoute: (v: RouteFilter) => void;
  outcome: OutcomeFilter;
  onOutcome: (v: OutcomeFilter) => void;
  resultCount: number;
  total: number;
  hasFilters: boolean;
  onClear: () => void;
}) {
  return (
    <div className="mb-2 rounded-md border border-border/60 bg-background/30 p-2">
      {/* Search input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search cycles…"
          aria-label="Search cycles"
          className="h-7 border-border/60 bg-background/40 pl-7 pr-7 font-mono text-[11px] text-foreground placeholder:font-sans placeholder:text-[11px] placeholder:text-muted-foreground/70"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQuery("")}
            aria-label="Clear search"
            className="absolute right-1.5 top-1/2 inline-flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition hover:bg-border/60 hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Chips + result count */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <ChipGroup label="ROUTE" chips={ROUTE_CHIPS} value={route} onChange={onRoute} />
        <ChipGroup label="OUTCOME" chips={OUTCOME_CHIPS} value={outcome} onChange={onOutcome} />

        <div className="ml-auto flex items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">
            <span className="text-[oklch(0.82_0.15_75)]">{resultCount}</span> of {total} cycles
          </span>
          {hasFilters && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onClear}
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <X className="mr-1 h-3 w-3" /> Clear
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function ChipGroup<T extends string>({
  label,
  chips,
  value,
  onChange,
}: {
  label: string;
  chips: { value: T; label: string; color: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="mr-1 font-mono text-[9px] uppercase tracking-widest text-muted-foreground">{label}</span>
      {chips.map((c) => {
        const active = value === c.value;
        return (
          <button
            key={c.value}
            type="button"
            onClick={() => onChange(c.value)}
            aria-pressed={active}
            className="rounded-sm border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider transition hover:bg-background/60"
            style={
              active
                ? {
                    color: c.color,
                    background: `color-mix(in oklch, ${c.color} 16%, transparent)`,
                    borderColor: `color-mix(in oklch, ${c.color} 55%, transparent)`,
                    boxShadow: `0 0 8px color-mix(in oklch, ${c.color} 38%, transparent)`,
                  }
                : {
                    color: "var(--muted-foreground)",
                    background: "transparent",
                    borderColor: "var(--border)",
                  }
            }
          >
            {c.label}
          </button>
        );
      })}
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
              <Field label="ROUTING" color="var(--a_active)" icon={Cpu}>
                <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                  <Badge variant="outline" className="border-border/60 font-mono text-[9px]" style={{ color: selected.route === "cloud" ? "var(--a_core)" : "var(--a_active)" }}>
                    {selected.model}
                  </Badge>
                  <span className="font-mono text-muted-foreground">complexity {selected.complexity.toFixed(2)}</span>
                  {selected.thinking && <Badge variant="outline" className="border-[oklch(0.82_0.15_75)]/40 font-mono text-[9px] text-[oklch(0.82_0.15_75)]">THINKING</Badge>}
                  <span className="font-mono text-muted-foreground">· {selected.durationMs}ms</span>
                </div>
              </Field>
              <Field label="PERCEIVE" color="var(--a_perceive)" icon={Activity}>
                <p className="text-xs leading-relaxed text-foreground/80">{selected.perception}</p>
              </Field>
              <Field label="THINK" color="var(--a_think)" icon={Brain}>
                <p className="text-xs leading-relaxed text-foreground/80">{selected.thought}</p>
              </Field>
              <Field label="REFLECT" color="var(--a_reflect)" icon={Zap}>
                <p className="text-xs leading-relaxed text-foreground/80">{selected.reflection}</p>
              </Field>
              <Field label="METRICS" color="var(--a_core)" icon={Clock}>
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
