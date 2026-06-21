"use client";
/**
 * CoreView — the A.E.O.N. brain.
 *
 * Renders the animated PERCEIVE → THINK → ACT → REFLECT cognitive loop as a
 * glowing core with four orbiting phase nodes, plus the dispatch console, the
 * live thought/routing stream, and the latest cycle result.
 */
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Send, Sparkles, Cpu, Activity, Zap, Radar, RotateCw,
  ChevronRight, Terminal, Waves, Gauge,
} from "lucide-react";
import { useAeon } from "@/lib/store";
import { LOOP_PHASES, PHASE_META, TIER_META, type LoopPhase } from "@/lib/aeon";
import { PhasePill, TierBadge, timeAgo } from "@/components/aeon/ui";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { CycleTimeline } from "@/components/aeon/cycle-timeline";
import { SystemDashboard } from "@/components/aeon/system-dashboard";

const SUGGESTIONS = [
  { label: "Dim the living room to 30% warm — it's evening", tier: 1 },
  { label: "Research the latest on local LLM agents and summarize", tier: 1 },
  { label: "Refactor my database schema for multi-tenant access", tier: 2 },
  { label: "Pay the electricity bill if it's under $200", tier: 2 },
  { label: "Should I rebalance my portfolio this quarter?", tier: 3 },
];

const PHASE_ANGLES: Record<LoopPhase, number> = {
  PERCEIVE: -90,
  THINK: 0,
  ACT: 90,
  REFLECT: 180,
};

export function CoreView() {
  const phase = useAeon((s) => s.phase);
  const orchestrating = useAeon((s) => s.orchestrating);
  const dispatch = useAeon((s) => s.dispatch);
  const stream = useAeon((s) => s.stream);
  const refresh = useAeon((s) => s.refresh);
  const memoryCount = useAeon((s) => s.memoryCount);
  const pendingActions = useAeon((s) => s.pendingActions);
  const [input, setInput] = useState("");
  const [lastResult, setLastResult] = useState<ReturnType<typeof Object> | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const phaseEvents = stream.filter(
    (e) => e.type === "phase" || e.type === "thought" || e.type === "routing" || e.type === "action" || e.type === "memory" || e.type === "trigger" || e.type === "status" || e.type === "error",
  );

  async function run(prompt?: string) {
    const text = (prompt ?? input).trim();
    if (!text || orchestrating) return;
    setInput(text === input ? input : text);
    const res = await dispatch(text);
    if (res) {
      setLastResult(res as never);
      toast.success(`Cycle ${res.cycleId.slice(4)} complete in ${(res.durationMs / 1000).toFixed(1)}s`);
    } else {
      toast.error("Orchestration cycle failed");
    }
  }

  // Auto-scroll the live log to top on new entries.
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [phaseEvents.length]);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Stat row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={phase ? Radar : Cpu}
          label="Cognitive Phase"
          value={phase ?? "IDLE"}
          accent={phase ? PHASE_META[phase].color : "var(--muted-foreground)"}
          pulsing={orchestrating}
        />
        <StatCard
          icon={Zap}
          label="Live Events"
          value={String(stream.length)}
          accent="var(--a_core)"
        />
        <StatCard
          icon={Brain}
          label="Memories"
          value={String(memoryCount)}
          accent="var(--a_active)"
        />
        <StatCard
          icon={Activity}
          label="Pending Actions"
          value={String(pendingActions)}
          accent="var(--a_warn)"
        />
      </div>

      {/* System dashboard — aggregate metrics */}
      <SystemDashboard />

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1.1fr_1fr]">
        {/* Core visualization */}
        <div className="aeon-clip-corner relative flex min-h-[420px] flex-col overflow-hidden rounded-lg border border-border bg-card/40 p-4 aeon-grid-bg">
          <div className="pointer-events-none absolute inset-0 aeon-radial-bg" />
          <div className="relative flex flex-1 items-center justify-center">
            <CoreOrb phase={phase} orchestrating={orchestrating} />
          </div>
          {/* Phase legend */}
          <div className="relative flex flex-wrap items-center justify-center gap-2">
            {LOOP_PHASES.map((p) => (
              <PhasePill key={p} phase={p} active={phase === p} />
            ))}
          </div>
        </div>

        {/* Live stream + dispatch */}
        <div className="flex min-h-0 flex-col gap-3">
          <div
            ref={logRef}
            className="aeon-scroll flex min-h-[180px] flex-1 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-black/30 p-3 font-mono text-xs"
          >
            <div className="mb-1 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Terminal className="h-3 w-3" /> live cognition stream
              <span className="ml-auto inline-flex h-1.5 w-1.5 rounded-full bg-[oklch(0.74_0.16_158)] animate-aeon-pulse" />
            </div>
            <AnimatePresence initial={false}>
              {phaseEvents.length === 0 ? (
                <TelemetryIdle />
              ) : (
                phaseEvents.slice(0, 60).map((e) => <StreamLine key={e.id} e={e} />)
              )}
            </AnimatePresence>
          </div>

          {/* Dispatch console */}
          <div className="rounded-lg border border-border bg-card/60 p-3">
            <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Send className="h-3 w-3" /> directive input
            </div>
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run();
              }}
              placeholder="Instruct A.E.O.N. — e.g. 'Dim the office to 40% and lock the front door'"
              className="min-h-[64px] resize-none border-border/60 bg-background/60 font-mono text-sm"
              disabled={orchestrating}
            />
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                onClick={() => void run()}
                disabled={orchestrating || !input.trim()}
                className="gap-1.5 bg-[oklch(0.82_0.15_75)] text-[var(--primary-foreground)] hover:brightness-110"
              >
                {orchestrating ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                {orchestrating ? "Cycling…" : "Run Cycle"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => void refresh()} className="text-muted-foreground">
                <RotateCw className="h-3.5 w-3.5" /> Sync
              </Button>
              <span className="ml-auto hidden text-[10px] text-muted-foreground sm:inline">⌘↵ to run</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => void run(s.label)}
                  disabled={orchestrating}
                  className="group inline-flex items-center gap-1 rounded-sm border border-border/60 bg-background/40 px-2 py-1 text-left text-[11px] text-muted-foreground transition hover:border-[oklch(0.82_0.15_75)]/50 hover:text-foreground disabled:opacity-40"
                >
                  <span className="text-[9px] font-bold text-[oklch(0.82_0.15_75)]">T{s.tier}</span>
                  <span className="max-w-[200px] truncate">{s.label}</span>
                  <ChevronRight className="h-3 w-3 opacity-0 transition group-hover:opacity-100" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Last cycle result */}
      {lastResult && <CycleResult />}

      {/* Persistent cycle history timeline */}
      <CycleTimeline />
    </div>
  );
}

/**
 * TelemetryIdle — animated system telemetry shown in the live-stream panel
 * when no cycle is running. Replaces the sparse "awaiting input" placeholder
 * with a living HUD readout (CPU/model load sparklines + status lines).
 */
function TelemetryIdle() {
  const agents = useAeon((s) => s.agents);
  const memoryCount = useAeon((s) => s.memoryCount);
  const cycles = useAeon((s) => s.cycles);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 900);
    return () => clearInterval(t);
  }, []);

  // Synthesize a smooth pseudo-random telemetry series that updates each tick.
  const series = (seed: number, len = 40) => {
    const out: number[] = [];
    for (let i = 0; i < len; i++) {
      const phase = (tick + i) * 0.3 + seed;
      out.push(0.5 + 0.4 * Math.sin(phase) + 0.1 * Math.sin(phase * 2.7));
    }
    return out;
  };

  const cpuSeries = series(0);
  const memSeries = series(1.7);
  const netSeries = series(3.4);

  const avgCpu = Math.round(cpuSeries.slice(-8).reduce((a, b) => a + b, 0) / 8 * 100);
  const avgMem = Math.round(memSeries.slice(-8).reduce((a, b) => a + b, 0) / 8 * 100);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col gap-3 py-2"
    >
      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
        <Gauge className="h-3 w-3 text-[oklch(0.74_0.16_158)]" />
        <span>system nominal · awaiting directive</span>
        <span className="ml-auto inline-flex items-center gap-1 font-mono text-[oklch(0.74_0.16_158)]">
          <span className="h-1 w-1 rounded-full bg-[oklch(0.74_0.16_158)] animate-aeon-pulse" /> idle
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <SparklineCard label="CPU LOAD" value={`${avgCpu}%`} data={cpuSeries} color="var(--a_core)" />
        <SparklineCard label="MEM PRESSURE" value={`${avgMem}%`} data={memSeries} color="var(--a_active)" />
        <SparklineCard label="NET I/O" value={`${(netSeries.slice(-1)[0] * 12).toFixed(1)} mb/s`} data={netSeries} color="var(--a_warn)" />
      </div>

      <div className="grid grid-cols-2 gap-2 text-[10px] sm:grid-cols-4">
        <IdleStat label="AGENTS" value={String(agents.length)} color="var(--a_active)" />
        <IdleStat label="MEMORIES" value={String(memoryCount)} color="var(--a_core)" />
        <IdleStat label="CYCLES" value={String(cycles.length)} color="var(--a_think)" />
        <IdleStat label="STATUS" value="READY" color="var(--a_active)" />
      </div>

      <div className="flex items-center gap-1.5 pt-1 text-[10px] text-muted-foreground">
        <Waves className="h-3 w-3 animate-pulse text-[oklch(0.82_0.15_75)]" />
        <span className="font-mono">cognitive loop primed · dispatch a directive to ignite</span>
      </div>
    </motion.div>
  );
}

function SparklineCard({ label, value, data, color }: { label: string; value: string; data: number[]; color: string }) {
  const w = 100;
  const h = 28;
  const max = 1;
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - (v / max) * h;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const areaPoints = `0,${h} ${points} ${w},${h}`;
  return (
    <div className="relative overflow-hidden rounded-md border border-border/40 bg-background/40 p-2">
      <div className="flex items-center justify-between text-[9px] uppercase tracking-widest text-muted-foreground">
        <span>{label}</span>
        <span className="font-mono font-bold" style={{ color }}>{value}</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-7 w-full" preserveAspectRatio="none">
        <polygon points={areaPoints} fill={color} opacity={0.12} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={w} cy={h - (data[data.length - 1] / max) * h} r="1.6" fill={color}>
          <animate attributeName="opacity" values="1;0.3;1" dur="1.4s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  );
}

function IdleStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-background/30 px-2 py-1.5">
      <div className="text-[8px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function CoreOrb({ phase, orchestrating }: { phase: LoopPhase | null; orchestrating: boolean }) {
  const size = 320;
  const c = size / 2;
  const orbitR = 120;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${size} ${size}`} className="max-w-[340px]">
      <defs>
        <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--a_core)" stopOpacity="0.9" />
          <stop offset="45%" stopColor="var(--a_core)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--a_core)" stopOpacity="0" />
        </radialGradient>
        <filter id="blur"><feGaussianBlur stdDeviation="2" /></filter>
      </defs>

      {/* outer rotating dashed ring */}
      <g style={{ transformOrigin: "center", animation: "aeon-spin-slow 24s linear infinite" }}>
        <circle cx={c} cy={c} r={orbitR + 18} fill="none" stroke="var(--a_core)" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="2 8" />
      </g>
      {/* counter-rotating ring */}
      <g style={{ transformOrigin: "center", animation: "aeon-spin-rev 32s linear infinite" }}>
        <circle cx={c} cy={c} r={orbitR + 6} fill="none" stroke="var(--a_active)" strokeOpacity="0.18" strokeWidth="1" strokeDasharray="1 12" />
      </g>

      {/* core glow */}
      <circle cx={c} cy={c} r={70} fill="url(#coreGlow)" className={orchestrating ? "animate-aeon-pulse" : ""} />

      {/* radar sweep when orchestrating */}
      {orchestrating && (
        <g style={{ transformOrigin: "center", animation: "aeon-sweep 2.4s linear infinite" }}>
          <path d={`M ${c} ${c} L ${c} ${c - orbitR} A ${orbitR} ${orbitR} 0 0 1 ${c + 60} ${c - 104} Z`} fill="var(--a_core)" opacity="0.12" />
        </g>
      )}

      {/* center hexagon core */}
      <polygon
        points={hexPoints(c, c, 34)}
        fill="var(--background)"
        stroke="var(--a_core)"
        strokeWidth="1.5"
        className={orchestrating ? "aeon-glow-core" : ""}
        style={{ filter: orchestrating ? "drop-shadow(0 0 8px var(--a_core))" : "none" }}
      />
      <text x={c} y={c - 2} textAnchor="middle" className="fill-[oklch(0.82_0.15_75)] font-mono" fontSize="9" fontWeight="700" letterSpacing="2">A.E.O.N</text>
      <text x={c} y={c + 10} textAnchor="middle" className="fill-[var(--muted-foreground)] font-mono" fontSize="6" letterSpacing="1">CORE v1.0</text>

      {/* phase nodes around the orbit */}
      {LOOP_PHASES.map((p) => {
        const ang = (PHASE_ANGLES[p] * Math.PI) / 180;
        const x = c + orbitR * Math.cos(ang);
        const y = c + orbitR * Math.sin(ang);
        const active = phase === p;
        const meta = PHASE_META[p];
        return (
          <g key={p}>
            {/* connector */}
            <line
              x1={c} y1={c} x2={x} y2={y}
              stroke={active ? meta.color : "var(--border)"}
              strokeWidth={active ? 1.5 : 0.75}
              strokeOpacity={active ? 0.8 : 0.4}
              strokeDasharray={active ? "0" : "3 4"}
            />
            {/* node */}
            <circle
              cx={x} cy={y} r={active ? 22 : 16}
              fill="var(--background)"
              stroke={meta.color}
              strokeWidth={active ? 2 : 1}
              style={{
                filter: active ? `drop-shadow(0 0 10px ${meta.color})` : "none",
                transition: "all 0.3s ease",
              }}
              className={active && orchestrating ? "animate-aeon-pulse" : ""}
            />
            {active && (
              <circle cx={x} cy={y} r={22} fill="none" stroke={meta.color} strokeOpacity="0.4" strokeWidth="1">
                <animate attributeName="r" from="22" to="34" dur="1.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.5" to="0" dur="1.4s" repeatCount="indefinite" />
              </circle>
            )}
            <text x={x} y={y + 2} textAnchor="middle" fontSize="6.5" fontWeight="700" letterSpacing="0.5" fill={active ? meta.color : "var(--muted-foreground)"} className="font-mono">
              {p.slice(0, 4)}
            </text>
          </g>
        );
      })}
    </svg>
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

function StreamLine({ e }: { e: { type: string; phase?: string; message?: string; level?: string; source?: string; ts: number } }) {
  const color =
    e.type === "phase" ? "var(--a_core)"
    : e.type === "routing" ? "var(--a_active)"
    : e.type === "thought" ? "var(--a_think)"
    : e.type === "action" ? "var(--a_act)"
    : e.type === "memory" ? "var(--a_active)"
    : e.type === "trigger" ? "var(--a_warn)"
    : e.type === "error" ? "var(--a_danger)"
    : "var(--muted-foreground)";
  const tag =
    e.type === "phase" ? (e.phase ?? "PHASE")
    : e.type.toUpperCase();
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-2 leading-relaxed"
    >
      <span className="shrink-0 text-[10px] text-muted-foreground/60">{new Date(e.ts).toLocaleTimeString("en-GB", { hour12: false })}</span>
      <span className="shrink-0 rounded-sm px-1 text-[9px] font-bold" style={{ color, background: `color-mix(in oklch, ${color} 14%, transparent)` }}>{tag}</span>
      <span className="min-w-0 flex-1 text-foreground/90">{e.message}</span>
    </motion.div>
  );
}

function CycleResult() {
  // Read latest result from component state via closure isn't possible here;
  // this component reads the actions list from the store instead, refreshed post-cycle.
  const actions = useAeon((s) => s.actions);
  const recent = actions.slice(0, 4);
  if (recent.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card/40 p-3">
      <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Activity className="h-3 w-3" /> latest dispatched actions
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {recent.map((a) => (
          <div key={a.id} className="flex items-start gap-2 rounded-md border border-border/50 bg-background/40 p-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <TierBadge tier={a.tier as 1 | 2 | 3} />
                <span className="truncate text-xs font-medium text-foreground">{a.title}</span>
              </div>
              <div className="mt-0.5 truncate text-[10px] text-muted-foreground">
                {a.agentName} · {a.status} · {timeAgo(a.createdAt)} ago
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, accent, pulsing,
}: { icon: React.ElementType; label: string; value: string; accent: string; pulsing?: boolean }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card/40 p-3">
      <div className="absolute left-0 top-0 h-full w-0.5" style={{ background: accent }} />
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        <Icon className="h-3 w-3" style={{ color: accent }} />
        {label}
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-lg font-bold" style={{ color: accent }}>{value}</span>
        {pulsing && <span className="h-1.5 w-1.5 rounded-full animate-aeon-pulse" style={{ background: accent }} />}
      </div>
    </div>
  );
}
