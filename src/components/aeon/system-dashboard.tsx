"use client";
/**
 * SystemDashboard — real-time aggregate metrics widget for the Core view.
 * Shows cycle success rate, avg response time, memory growth, and agent
 * utilization as animated gauge + sparkline visualizations.
 */
import { useAeon } from "@/lib/store";
import {
  CheckCircle, Clock, Brain, Cpu, TrendingUp, Activity,
} from "lucide-react";

export function SystemDashboard() {
  const cycles = useAeon((s) => s.cycles);
  const agents = useAeon((s) => s.agents);
  const memoryCount = useAeon((s) => s.memoryCount);
  const actions = useAeon((s) => s.actions);

  // Computed metrics
  const totalCycles = cycles.length;
  const executedCycles = cycles.filter((c) => c.outcome === "executed").length;
  const successRate = totalCycles > 0 ? Math.round((executedCycles / totalCycles) * 100) : 0;

  const avgDuration =
    totalCycles > 0
      ? Math.round(cycles.reduce((sum, c) => sum + c.durationMs, 0) / totalCycles)
      : 0;

  const cloudCycles = cycles.filter((c) => c.route === "cloud").length;
  const localCycles = cycles.filter((c) => c.route === "local").length;
  const cloudPct = totalCycles > 0 ? Math.round((cloudCycles / totalCycles) * 100) : 0;

  const busyAgents = agents.filter((a) => a.status === "busy").length;
  const totalTasks = agents.reduce((sum, a) => sum + a.tasksDone, 0);

  const pendingActions = actions.filter((a) => a.status === "pending").length;
  const executedActions = actions.filter((a) => a.status === "executed").length;

  // Mini series for sparklines (last 8 cycles)
  const durationSeries = cycles.slice(0, 8).reverse().map((c) => c.durationMs);
  const complexitySeries = cycles.slice(0, 8).reverse().map((c) => c.complexity);

  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-3 flex items-center gap-2">
        <Activity className="h-3.5 w-3.5 text-[var(--aeon-core)]" />
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">system dashboard</span>
        <span className="ml-auto rounded-sm bg-[var(--aeon-active)]/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-[var(--aeon-active)]">LIVE</span>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <GaugeCard
          icon={CheckCircle}
          label="Cycle Success"
          value={`${successRate}%`}
          pct={successRate / 100}
          color={successRate >= 80 ? "var(--aeon-active)" : successRate >= 50 ? "var(--aeon-warn)" : "var(--aeon-danger)"}
          detail={`${executedCycles}/${totalCycles} cycles`}
          series={durationSeries}
          seriesLabel="ms"
        />
        <GaugeCard
          icon={Clock}
          label="Avg Latency"
          value={avgDuration > 1000 ? `${(avgDuration / 1000).toFixed(1)}s` : `${avgDuration}ms`}
          pct={Math.min(1, avgDuration / 10000)}
          color={avgDuration < 3000 ? "var(--aeon-active)" : avgDuration < 6000 ? "var(--aeon-warn)" : "var(--aeon-danger)"}
          detail={`p95: ${durationSeries.length >= 3 ? Math.round(durationSeries.sort((a, b) => b - a)[Math.floor(durationSeries.length * 0.2)]) : "—"}ms`}
          series={durationSeries}
          seriesLabel="ms"
        />
        <GaugeCard
          icon={Brain}
          label="Memory Growth"
          value={String(memoryCount)}
          pct={Math.min(1, memoryCount / 100)}
          color="var(--aeon-core)"
          detail={`${cloudCycles}C / ${localCycles}L routes`}
          series={complexitySeries}
          seriesLabel="complexity"
        />
        <GaugeCard
          icon={Cpu}
          label="Agent Util."
          value={`${busyAgents}/${agents.length}`}
          pct={agents.length > 0 ? busyAgents / agents.length : 0}
          color={busyAgents > 0 ? "var(--aeon-warn)" : "var(--aeon-active)"}
          detail={`${totalTasks} tasks · ${pendingActions} pending`}
          series={undefined}
        />
      </div>

      {/* Bottom strip: action summary + routing split */}
      <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-border/40 bg-background/30 px-3 py-2 text-[10px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <TrendingUp className="h-3 w-3 text-[var(--aeon-active)]" />
          <span className="text-foreground/70 font-medium">{executedActions}</span> executed
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--aeon-warn)]" />
          <span className="text-foreground/70 font-medium">{pendingActions}</span> pending
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <span className="text-[var(--aeon-active)]">LOCAL</span>
          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-border/40">
            <div
              className="h-full rounded-full bg-[var(--aeon-active)]"
              style={{ width: `${100 - cloudPct}%` }}
            />
          </div>
          <span className="text-[var(--aeon-core)]">CLOUD</span>
          <span className="font-mono font-bold text-foreground/60">{cloudPct}%</span>
        </span>
      </div>
    </div>
  );
}

function GaugeCard({
  icon: Icon,
  label,
  value,
  pct,
  color,
  detail,
  series,
  seriesLabel,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  pct: number;
  color: string;
  detail: string;
  series?: number[];
  seriesLabel?: string;
}) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c - pct * c;

  return (
    <div className="relative overflow-hidden rounded-md border border-border/40 bg-background/40 p-2.5">
      <div className="flex items-start gap-2">
        {/* SVG gauge ring */}
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center">
          <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90">
            <circle cx="24" cy="24" r={r} fill="none" stroke="var(--border)" strokeWidth="3" opacity={0.4} />
            <circle
              cx="24" cy="24" r={r} fill="none"
              stroke={color} strokeWidth="3" strokeLinecap="round"
              strokeDasharray={c} strokeDashoffset={offset}
              className="transition-all duration-700"
              style={{ filter: `drop-shadow(0 0 3px color-mix(in oklch, ${color} 50%, transparent))` }}
            />
          </svg>
          <Icon className="absolute h-3.5 w-3.5" style={{ color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] uppercase tracking-widest text-muted-foreground">{label}</div>
          <div className="font-mono text-base font-bold leading-tight" style={{ color }}>{value}</div>
          <div className="mt-0.5 truncate text-[9px] text-muted-foreground">{detail}</div>
        </div>
      </div>

      {/* Mini sparkline */}
      {series && series.length >= 2 && (
        <div className="mt-2">
          <MiniSparkline data={series} color={color} label={seriesLabel ?? ""} />
        </div>
      )}
    </div>
  );
}

function MiniSparkline({ data, color, label }: { data: number[]; color: string; label: string }) {
  const w = 80;
  const h = 16;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((v - min) / range) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPoints = `0,${h} ${points} ${w},${h}`;

  return (
    <div className="flex items-center gap-1.5">
      <svg viewBox={`0 0 ${w} ${h}`} className="h-4 flex-1" preserveAspectRatio="none">
        <polygon points={areaPoints} fill={color} opacity={0.1} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1" strokeLinejoin="round" />
      </svg>
      <span className="shrink-0 font-mono text-[8px] text-muted-foreground">{label}</span>
    </div>
  );
}
