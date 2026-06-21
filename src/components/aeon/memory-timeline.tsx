"use client";
/**
 * MemoryTimeline — temporal visualization of A.E.O.N.'s memory store.
 *
 * Shows when memories were created across time, grouped by day. Each day is a
 * column with memory "drops" colored by kind. Click a drop to see the memory
 * detail. Includes kind distribution + span stats.
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Calendar, Brain, Activity, Zap, X, TrendingUp,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { timeAgo } from "@/components/aeon/ui";

interface TimelineMemory {
  id: string;
  content: string;
  kind: string;
  tags: string | null;
  source: string | null;
  importance: number;
  createdAt: string;
}

interface DayGroup {
  date: string;
  count: number;
  memories: TimelineMemory[];
}

interface TimelineData {
  days: DayGroup[];
  total: number;
  span: { earliest: string; latest: string } | null;
  kindCounts: Record<string, number>;
}

const KIND_META: Record<string, { color: string; label: string; icon: React.ElementType }> = {
  episodic: { color: "var(--a_core)", label: "EPISODIC", icon: Clock },
  semantic: { color: "var(--a_active)", label: "SEMANTIC", icon: Brain },
  procedural: { color: "var(--a_warn)", label: "PROCEDURAL", icon: Zap },
};

export function MemoryTimeline() {
  const [data, setData] = useState<TimelineData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TimelineMemory | null>(null);

  useEffect(() => {
    fetch("/api/aeon/memory/timeline")
      .then((r) => r.json())
      .then((d: TimelineData) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="border-border bg-card/40">
        <CardContent className="flex h-32 items-center justify-center p-4">
          <Activity className="h-5 w-5 animate-pulse text-[var(--a_core)]" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.total === 0) {
    return (
      <Card className="border-border bg-card/40">
        <CardContent className="flex h-32 flex-col items-center justify-center gap-2 p-4">
          <Clock className="h-6 w-6 text-muted-foreground/40" />
          <p className="text-xs text-muted-foreground">No memories yet — dispatch a cycle to begin.</p>
        </CardContent>
      </Card>
    );
  }

  const maxCount = Math.max(...data.days.map((d) => d.count), 1);

  return (
    <Card className="border-border bg-card/40">
      <CardContent className="p-4">
        {/* Header */}
        <div className="mb-3 flex items-center gap-2">
          <Calendar className="h-3.5 w-3.5 text-[var(--a_core)]" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">memory timeline</span>
          <Badge variant="outline" className="border-border/60 font-mono text-[9px] text-[var(--a_core)]">
            {data.total} memories
          </Badge>
          {data.span && (
            <span className="ml-auto font-mono text-[9px] text-muted-foreground">
              {new Date(data.span.earliest).toLocaleDateString()} → {new Date(data.span.latest).toLocaleDateString()}
            </span>
          )}
        </div>

        {/* Kind distribution */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {Object.entries(data.kindCounts).map(([kind, count]) => {
            const meta = KIND_META[kind] ?? { color: "var(--muted-foreground)", label: kind.toUpperCase(), icon: Activity };
            const Icon = meta.icon;
            const pct = Math.round((count / data.total) * 100);
            return (
              <div
                key={kind}
                className="inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 text-[10px]"
                style={{
                  borderColor: `color-mix(in oklch, ${meta.color} 30%, transparent)`,
                  background: `color-mix(in oklch, ${meta.color} 8%, transparent)`,
                }}
              >
                <Icon className="h-2.5 w-2.5" style={{ color: meta.color }} />
                <span className="font-mono font-bold" style={{ color: meta.color }}>{meta.label}</span>
                <span className="text-muted-foreground">{count}</span>
                <span className="font-mono text-[9px] text-muted-foreground">{pct}%</span>
              </div>
            );
          })}
        </div>

        {/* Timeline columns */}
        <ScrollArea className="aeon-scroll w-full pb-2">
          <div className="flex min-w-full gap-2">
            {data.days.map((day) => {
              const dayDate = new Date(day.date);
              const heightPct = (day.count / maxCount) * 100;
              return (
                <div key={day.date} className="flex w-[120px] shrink-0 flex-col">
                  {/* Day header */}
                  <div className="mb-1.5 text-center">
                    <div className="font-mono text-[10px] font-bold text-foreground">
                      {dayDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                    <div className="font-mono text-[8px] text-muted-foreground">
                      {dayDate.toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                  </div>
                  {/* Column bar */}
                  <div className="relative flex h-[140px] flex-col justify-end rounded-md border border-border/40 bg-background/30 p-1">
                    {/* Count badge */}
                    <div className="mb-1 text-center font-mono text-[11px] font-bold text-[var(--a_core)]">
                      {day.count}
                    </div>
                    {/* Memory drops */}
                    <div className="flex flex-wrap justify-center gap-0.5">
                      {day.memories.slice(0, 12).map((m) => {
                        const meta = KIND_META[m.kind] ?? { color: "var(--muted-foreground)" };
                        return (
                          <button
                            key={m.id}
                            onClick={() => setSelected(m)}
                            className="group relative h-2.5 w-2.5 rounded-full transition-transform hover:scale-150"
                            style={{
                              background: meta.color,
                              boxShadow: `0 0 4px color-mix(in oklch, ${meta.color} 50%, transparent)`,
                              opacity: 0.5 + m.importance * 0.5,
                            }}
                            title={m.content.slice(0, 80)}
                          />
                        );
                      })}
                      {day.memories.length > 12 && (
                        <span className="self-center font-mono text-[7px] text-muted-foreground">
                          +{day.memories.length - 12}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>

        {/* Trend footer */}
        <div className="mt-3 flex items-center gap-2 rounded-md border border-border/40 bg-background/30 px-3 py-1.5 text-[10px] text-muted-foreground">
          <TrendingUp className="h-3 w-3 text-[var(--a_active)]" />
          <span>
            <span className="font-bold text-foreground">{data.days.length}</span> active days ·
            avg <span className="font-bold text-foreground">{(data.total / Math.max(data.days.length, 1)).toFixed(1)}</span> memories/day ·
            peak <span className="font-bold text-[var(--a_core)]">{maxCount}</span>/day
          </span>
        </div>

        {/* Memory detail drawer */}
        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 rounded-md border border-border/60 bg-background/40 p-3">
                <div className="mb-2 flex items-center gap-2">
                  {(() => {
                    const meta = KIND_META[selected.kind] ?? { color: "var(--muted-foreground)", label: selected.kind.toUpperCase(), icon: Activity };
                    const Icon = meta.icon;
                    return (
                      <Badge variant="outline" className="border-border/60 font-mono text-[9px]" style={{ color: meta.color }}>
                        <Icon className="mr-1 h-2.5 w-2.5" /> {meta.label}
                      </Badge>
                    );
                  })()}
                  {selected.source && (
                    <Badge variant="outline" className="border-border/60 font-mono text-[9px] text-muted-foreground">
                      {selected.source}
                    </Badge>
                  )}
                  <span className="ml-auto font-mono text-[9px] text-muted-foreground">
                    {timeAgo(selected.createdAt)} ago
                  </span>
                  <button onClick={() => setSelected(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <p className="text-xs leading-relaxed text-foreground/90">{selected.content}</p>
                {selected.tags && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selected.tags.split(",").map((tag) => (
                      <span key={tag} className="rounded-sm bg-background/40 px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">
                        #{tag.trim()}
                      </span>
                    ))}
                  </div>
                )}
                {/* Importance bar */}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground">importance</span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-border/30">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${selected.importance * 100}%`, background: "var(--a_core)" }}
                    />
                  </div>
                  <span className="font-mono text-[9px] text-[var(--a_core)]">{(selected.importance * 100).toFixed(0)}%</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
