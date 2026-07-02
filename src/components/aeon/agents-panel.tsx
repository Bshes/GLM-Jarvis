"use client";
/**
 * AgentsPanel — the A.E.O.N. sub-agent collective.
 *
 * Shows each agent as a polished "profile card" with: a gradient header
 * strip, a large icon avatar with a status pip, a rich status badge (icon +
 * label, distinct color per status), a tier badge, a model chip (Cpu/Cloud),
 * a task-share progress bar (tasksDone / totalTasks across the collective),
 * a deterministic last-active sparkline + relative time, and a subtle
 * accent-colored lift/glow on hover.
 *
 * Below the cards: a dispatch-directive form and the inter-agent Message
 * Bus (thread + compose). All existing functionality is preserved.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu,
  Code2,
  Globe,
  House,
  Wallet,
  Send,
  RotateCw,
  Circle,
  Mail,
  ArrowRight,
  Radio,
  Inbox,
  Sparkles,
  Clock,
  AlertTriangle,
  Loader2,
  PowerOff,
  Cloud,
  Activity,
  type LucideIcon,
} from "lucide-react";
import { useAeon, type AgentMessageView, type AgentMessageKind } from "@/lib/store";
import { AgentGlyph, timeAgo, TierBadge } from "@/components/aeon/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

/** Model routing chip metadata — local = emerald/Cpu, cloud = amber/Cloud. */
const MODEL_META: Record<
  string,
  { icon: LucideIcon; label: string; sub: string; color: string }
> = {
  local: { icon: Cpu, label: "LOCAL", sub: "LLAMA-3", color: "var(--a_active)" },
  cloud: { icon: Cloud, label: "CLOUD", sub: "CLAUDE-3.5", color: "var(--a_core)" },
};

/** Distinct icon + label + color per agent status. */
const STATUS_META: Record<
  string,
  { icon: LucideIcon; label: string; color: string }
> = {
  idle: { icon: Activity, label: "IDLE", color: "var(--muted-foreground)" },
  busy: { icon: Loader2, label: "BUSY", color: "var(--a_warn)" },
  awaiting: { icon: Clock, label: "AWAITING", color: "var(--a_core)" },
  error: { icon: AlertTriangle, label: "ERROR", color: "var(--a_danger)" },
  offline: { icon: PowerOff, label: "OFFLINE", color: "var(--muted-foreground)" },
  online: { icon: Activity, label: "ONLINE", color: "var(--a_active)" },
};

function statusMeta(status: string) {
  return STATUS_META[status] ?? STATUS_META.idle;
}

/** Stable agent-icon lookup (property access, not a function returning a component). */
const AGENT_ICONS_LOCAL: Record<string, LucideIcon> = {
  Coder: Code2,
  Researcher: Globe,
  IoT: House,
  Financial: Wallet,
};

function agentIconSafe(name: string): LucideIcon {
  return AGENT_ICONS_LOCAL[name] ?? Cpu;
}

/** Kind → accent color (per task spec). */
const KIND_META: Record<AgentMessageKind, { color: string; label: string }> = {
  delegate: { color: "var(--a_warn)", label: "DELEGATE" },
  status: { color: "var(--a_active)", label: "STATUS" },
  result: { color: "var(--a_core)", label: "RESULT" },
  query: { color: "var(--a_think)", label: "QUERY" },
  response: { color: "var(--a_active)", label: "RESPONSE" },
};

/** All compose-able kinds. */
const KIND_OPTIONS: AgentMessageKind[] = ["delegate", "status", "result", "query", "response"];

/** Agent name → accent color (falls back to amber core). */
function agentColor(name: string, agents: { name: string; color: string }[]): string {
  return normalizeColor(agents.find((a) => a.name === name)?.color ?? "var(--a_core)");
}

/**
 * Defensive color normalizer.
 * The DB was seeded before the `--aeon-*` → `--a_*` CSS-var rename, so some
 * agent rows still carry `var(--aeon-core)` etc. — which are now undefined.
 * Map any `var(--aeon-X)` to `var(--a_X)` so accent colors always resolve.
 */
function normalizeColor(c: string | null | undefined): string {
  if (!c) return "var(--a_core)";
  return c.replace(/^var\(--aeon-/, "var(--a_");
}

/**
 * Deterministic pseudo-sparkline for "recent activity".
 * Returns 12 heights in [8,100], stable per (seed, tasks). More tasks →
 * taller bars overall (visual cue for throughput). The rightmost bar is the
 * "most recent" and rendered at full opacity.
 */
function activitySpark(seed: string, tasks: number): number[] {
  const bars = 12;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const arr: number[] = [];
  const boost = Math.min(tasks * 4, 40);
  for (let i = 0; i < bars; i++) {
    h = Math.imul(h ^ (h >>> 13), 16777619);
    const v = 12 + (Math.abs(h) % 60) + boost * ((i + 1) / bars);
    arr.push(Math.max(8, Math.min(100, Math.round(v))));
  }
  return arr;
}

export function AgentsPanel() {
  const agents = useAeon((s) => s.agents);
  const dispatch = useAeon((s) => s.dispatch);
  const orchestrating = useAeon((s) => s.orchestrating);
  const refresh = useAeon((s) => s.refresh);

  // Message bus
  const agentMessages = useAeon((s) => s.agentMessages);
  const refreshAgentMessages = useAeon((s) => s.refreshAgentMessages);
  const sendAgentMessage = useAeon((s) => s.sendAgentMessage);

  const [target, setTarget] = useState<string>(agents[0]?.name ?? "IoT");
  const [task, setTask] = useState("");

  // Compose form state
  const [from, setFrom] = useState<string>("Orchestrator");
  const [to, setTo] = useState<string>(agents[0]?.name ?? "IoT");
  const [kind, setKind] = useState<AgentMessageKind>("delegate");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const busy = orchestrating;
  const totalTasks = agents.reduce((n, a) => n + a.tasksDone, 0);
  const busyCount = agents.filter((a) => a.status === "busy").length;
  const onlineModels = useMemo(
    () => new Set(agents.map((a) => a.model)).size,
    [agents],
  );

  // Track which messages we've already seen so we can toast new responses.
  const seenIdsRef = useRef<Set<string>>(new Set());
  const hydratedRef = useRef(false);

  // Auto-refresh the bus every 4s while the panel is mounted.
  useEffect(() => {
    void refreshAgentMessages();
    const id = setInterval(() => {
      void refreshAgentMessages();
    }, 4000);
    return () => clearInterval(id);
  }, [refreshAgentMessages]);

  // Watch for new responses → toast via sonner.
  useEffect(() => {
    if (agentMessages.length === 0) {
      if (!hydratedRef.current) hydratedRef.current = true;
      return;
    }
    if (!hydratedRef.current) {
      for (const m of agentMessages) seenIdsRef.current.add(m.id);
      hydratedRef.current = true;
      return;
    }
    for (const m of agentMessages) {
      if (seenIdsRef.current.has(m.id)) continue;
      seenIdsRef.current.add(m.id);
      if (m.kind === "response") {
        toast(`${m.fromAgent} → ${m.toAgent} · response`, {
          description: m.body,
          duration: 5000,
        });
      }
    }
  }, [agentMessages]);

  const unread = useMemo(
    () => agentMessages.filter((m) => !m.read).length,
    [agentMessages],
  );

  async function run() {
    if (!task.trim() || busy) return;
    await dispatch(task.trim(), `Routed to ${target} agent.`);
    setTask("");
    toast.success(`Directive dispatched to ${target}`);
  }

  async function send() {
    if (!subject.trim() || !body.trim()) return;
    const s = subject.trim();
    const b = body.trim();
    await sendAgentMessage(from, to, kind, s, b);
    setSubject("");
    setBody("");
    toast.success(`Message sent: ${from} → ${to} [${KIND_META[kind].label}]`);
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* header */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Active Agents"
          value={String(agents.length)}
          icon={Activity}
          accent="var(--a_core)"
        />
        <Stat
          label="Busy Now"
          value={String(busyCount)}
          icon={Loader2}
          spin={busyCount > 0}
          accent="var(--a_warn)"
        />
        <Stat
          label="Tasks Completed"
          value={String(totalTasks)}
          icon={Circle}
          accent="var(--a_active)"
        />
        <Stat
          label="Models Online"
          value={String(onlineModels)}
          icon={Cpu}
          accent="var(--a_active)"
        />
      </div>

      {/* agent grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {agents.map((a) => {
          const Icon = agentIconSafe(a.name);
          const pct = totalTasks > 0 ? Math.round((a.tasksDone / totalTasks) * 100) : 0;
          return (
            <AgentCard
              key={a.id}
              name={a.name}
              role={a.role}
              description={a.description}
              status={a.status}
              color={normalizeColor(a.color)}
              tier={a.tier as 1 | 2 | 3}
              model={a.model}
              tasksDone={a.tasksDone}
              lastTask={a.lastTask}
              lastActive={a.lastActive}
              icon={Icon}
              pct={pct}
              totalTasks={totalTasks}
            />
          );
        })}
      </div>

      {/* dispatch to specific agent */}
      <Card className="border-border bg-card/40">
        <CardContent className="p-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Send className="h-3 w-3" /> dispatch directive
          </div>
          <div className="flex flex-wrap gap-2">
            {agents.map((a) => (
              <button
                key={a.id}
                onClick={() => setTarget(a.name)}
                className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-xs transition ${
                  target === a.name
                    ? "border-[oklch(0.82_0.15_75)] bg-[oklch(0.82_0.15_75)]/10 text-foreground"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Circle className="h-1.5 w-1.5" style={{ color: normalizeColor(a.color) }} />
                {a.name}
              </button>
            ))}
          </div>
          <Textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder={`Describe a task for ${target}…`}
            className="mt-3 min-h-[60px] resize-none border-border/60 bg-background/60 font-mono text-sm"
            disabled={busy}
          />
          <div className="mt-2 flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => void run()}
              disabled={busy || !task.trim()}
              className="gap-1.5 bg-[oklch(0.82_0.15_75)] text-[var(--primary-foreground)] hover:brightness-110"
            >
              {busy ? (
                <RotateCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Dispatch to {target}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => void refresh()}
              className="text-muted-foreground"
            >
              <RotateCw className="h-3.5 w-3.5" /> Sync
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ─── Message Bus ─────────────────────────────────────────────── */}
      <Card className="border-border bg-card/40">
        <CardContent className="p-4">
          {/* bus header */}
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Mail className="h-3 w-3" /> inter-agent message bus
            </div>
            <span className="ml-auto inline-flex items-center gap-1.5 rounded-sm border border-border/60 px-2 py-0.5 font-mono text-[9px] text-muted-foreground">
              <Radio className="h-2.5 w-2.5 text-[oklch(0.74_0.16_158)]" />
              live · {agentMessages.length}
            </span>
            {unread > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-bold"
                style={{
                  color: "var(--a_danger)",
                  background: `color-mix(in oklch, var(--a_danger) 14%, transparent)`,
                  boxShadow: `inset 0 0 0 1px color-mix(in oklch, var(--a_danger) 35%, transparent)`,
                }}
              >
                <Inbox className="h-2.5 w-2.5" /> {unread} unread
              </span>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px] text-muted-foreground"
              onClick={() => void refreshAgentMessages()}
            >
              <RotateCw className="h-3 w-3" /> Refresh
            </Button>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1.6fr_1fr]">
            {/* ─── message thread ─── */}
            <div className="aeon-scroll max-h-[460px] min-h-[260px] overflow-y-auto pr-1">
              {agentMessages.length === 0 ? (
                <EmptyBus />
              ) : (
                <ul className="flex flex-col gap-2">
                  <AnimatePresence initial={false}>
                    {agentMessages.map((m) => (
                      <MessageRow key={m.id} m={m} agents={agents} />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* ─── compose form ─── */}
            <div className="flex flex-col gap-2 rounded-lg border border-border/60 bg-background/40 p-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                <Sparkles className="mr-1 inline h-3 w-3" /> compose
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">From</Label>
                  <Select value={from} onValueChange={setFrom}>
                    <SelectTrigger className="h-8 border-border/60 bg-background/60 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Orchestrator">Orchestrator</SelectItem>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">To</Label>
                  <Select value={to} onValueChange={setTo}>
                    <SelectTrigger className="h-8 border-border/60 bg-background/60 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="broadcast">broadcast</SelectItem>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.name}>{a.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Kind</Label>
                <Select value={kind} onValueChange={(v) => setKind(v as AgentMessageKind)}>
                  <SelectTrigger className="h-8 border-border/60 bg-background/60 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KIND_OPTIONS.map((k) => (
                      <SelectItem key={k} value={k}>
                        <span style={{ color: KIND_META[k].color }}>{KIND_META[k].label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief subject…"
                  className="h-8 border-border/60 bg-background/60 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Body</Label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Message body…"
                  className="min-h-[72px] resize-none border-border/60 bg-background/60 text-xs"
                />
              </div>

              <Button
                size="sm"
                onClick={() => void send()}
                disabled={!subject.trim() || !body.trim()}
                className="mt-1 gap-1.5 bg-[oklch(0.74_0.16_158)] text-[var(--primary-foreground)] hover:brightness-110"
              >
                <Send className="h-3.5 w-3.5" />
                Send {from === "Orchestrator" ? "" : `from ${from}`} → {to}
              </Button>
              {(kind === "delegate" || kind === "query") && (
                <p className="text-[10px] leading-snug text-muted-foreground">
                  <Sparkles className="mr-1 inline h-2.5 w-2.5" />
                  {to === "broadcast"
                    ? "Each agent will auto-reply (~1.5s)."
                    : `${to} will auto-reply (~1.5s).`}
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default AgentsPanel;

/* ───────────────────────────────────────────────────────────────────────
 * AgentCard — the polished profile card.
 * ─────────────────────────────────────────────────────────────────────── */

interface AgentCardProps {
  name: string;
  role: string;
  description: string | null;
  status: string;
  color: string;
  tier: 1 | 2 | 3;
  model: string;
  tasksDone: number;
  lastTask: string | null;
  lastActive: string | null;
  icon: LucideIcon;
  pct: number;
  totalTasks: number;
}

function AgentCard({
  name,
  role,
  description,
  status,
  color,
  tier,
  model,
  tasksDone,
  lastTask,
  lastActive,
  icon: Icon,
  pct,
  totalTasks,
}: AgentCardProps) {
  const [hovered, setHovered] = useState(false);
  const sMeta = statusMeta(status);
  const mMeta = MODEL_META[model] ?? MODEL_META.local;
  const SIcon = sMeta.icon;
  const MIcon = mMeta.icon;
  const spark = useMemo(() => activitySpark(name, tasksDone), [name, tasksDone]);
  const spinning = status === "busy";

  return (
    <motion.div
      layout
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      animate={{ y: hovered ? -3 : 0 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
    >
      <Card
        className="relative overflow-hidden border bg-card/40 transition-colors duration-300"
        style={{
          borderColor: hovered
            ? `color-mix(in oklch, ${color} 55%, transparent)`
            : undefined,
          boxShadow: hovered
            ? `0 10px 28px -10px color-mix(in oklch, ${color} 50%, transparent), 0 0 0 1px color-mix(in oklch, ${color} 35%, transparent)`
            : undefined,
        }}
      >
        {/* gradient header strip */}
        <div
          className="absolute inset-x-0 top-0 h-1"
          style={{
            background: `linear-gradient(90deg, color-mix(in oklch, ${color} 85%, transparent) 0%, ${color} 40%, color-mix(in oklch, ${color} 20%, transparent) 100%)`,
            boxShadow: `0 0 12px color-mix(in oklch, ${color} 50%, transparent)`,
          }}
        />
        {/* soft radial glow behind avatar */}
        <div
          className="pointer-events-none absolute -left-10 -top-10 h-28 w-28 rounded-full opacity-25 blur-2xl"
          style={{ background: `color-mix(in oklch, ${color} 60%, transparent)` }}
        />

        <CardContent className="relative p-4 pt-5">
          {/* ─── header row: avatar + name/role + badges ─── */}
          <div className="flex items-start gap-3">
            <div
              className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border"
              style={{
                borderColor: `color-mix(in oklch, ${color} 55%, transparent)`,
                background: `linear-gradient(135deg, color-mix(in oklch, ${color} 24%, transparent), color-mix(in oklch, ${color} 6%, transparent))`,
                boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 18%, transparent), 0 4px 12px -4px color-mix(in oklch, ${color} 40%, transparent)`,
              }}
            >
              <Icon className="h-6 w-6" style={{ color }} />
              {/* status pip on avatar corner */}
              <span
                className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border-2"
                style={{ background: sMeta.color, borderColor: "var(--card)" }}
                title={sMeta.label}
              >
                {spinning ? (
                  <SIcon className="h-2.5 w-2.5 animate-spin" style={{ color: "var(--card)" }} />
                ) : (
                  <SIcon className="h-2.5 w-2.5" style={{ color: "var(--card)" }} />
                )}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <h3
                className="font-mono text-base font-bold leading-tight tracking-wide"
                style={{ color }}
              >
                {name.toUpperCase()}
              </h3>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">{role}</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <StatusBadge status={status} />
                <TierBadge tier={tier} />
              </div>
            </div>
          </div>

          {/* description */}
          {description && (
            <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-foreground/70">
              {description}
            </p>
          )}

          {/* ─── task-share progress bar ─── */}
          <div className="mt-3">
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Circle className="h-2 w-2" style={{ color }} />
                task share
              </span>
              <span style={{ color }}>
                {tasksDone} / {totalTasks} · {pct}%
              </span>
            </div>
            <div className="relative h-2 overflow-hidden rounded-full border border-border/60 bg-background/60">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  background: `linear-gradient(90deg, color-mix(in oklch, ${color} 50%, transparent), ${color})`,
                  boxShadow: `0 0 8px color-mix(in oklch, ${color} 60%, transparent)`,
                }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(pct, tasksDone > 0 ? 4 : 0)}%` }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* ─── footer: model chip + last-active sparkline ─── */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider"
              style={{
                color: mMeta.color,
                background: `color-mix(in oklch, ${mMeta.color} 12%, transparent)`,
                boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${mMeta.color} 32%, transparent)`,
              }}
            >
              <MIcon className="h-2.5 w-2.5" />
              {mMeta.label}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
              {mMeta.sub}
            </span>

            <div className="ml-auto flex items-center gap-1.5">
              <ActivitySpark color={color} data={spark} />
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                {lastActive ? `${timeAgo(lastActive)} ago` : "never"}
              </span>
            </div>
          </div>

          {/* last task footer */}
          {lastTask && (
            <div className="mt-2 flex items-center gap-1.5 border-t border-border/40 pt-2 text-[10px] text-muted-foreground">
              <ArrowRight className="h-2.5 w-2.5 shrink-0" style={{ color }} />
              <span className="truncate">{lastTask}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

/** Rich status badge — distinct icon + color + label per status. */
function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta(status);
  const SIcon = meta.icon;
  const spin = status === "busy";
  return (
    <span
      className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider"
      style={{
        color: meta.color,
        background: `color-mix(in oklch, ${meta.color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${meta.color} 36%, transparent)`,
      }}
    >
      <SIcon className={`h-2.5 w-2.5 ${spin ? "animate-spin" : ""}`} />
      {meta.label}
    </span>
  );
}

/** Mini "recent activity" sparkline — deterministic per agent. */
function ActivitySpark({ color, data }: { color: string; data: number[] }) {
  return (
    <div
      className="flex h-5 items-end gap-[2px] rounded-sm border border-border/40 bg-background/40 px-1 py-0.5"
      aria-hidden
      title="recent activity"
    >
      {data.map((v, i) => {
        const last = i === data.length - 1;
        return (
          <span
            key={i}
            className="w-[2px] rounded-sm"
            style={{
              height: `${Math.max(18, v)}%`,
              background: last
                ? color
                : `color-mix(in oklch, ${color} 42%, transparent)`,
              opacity: last ? 1 : 0.75,
            }}
          />
        );
      })}
    </div>
  );
}

/** A single message row in the thread. */
function MessageRow({
  m,
  agents,
}: {
  m: AgentMessageView;
  agents: { name: string; color: string }[];
}) {
  const fromColor = agentColor(m.fromAgent, agents);
  const toColor = agentColor(m.toAgent, agents);
  const k = KIND_META[m.kind];

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
      className="relative overflow-hidden rounded-md border border-border/60 bg-background/40"
      style={{
        boxShadow: m.read ? "none" : `inset 2px 0 0 0 ${k.color}`,
      }}
    >
      {/* left accent strip — color of the sender */}
      <div
        className="absolute left-0 top-0 h-full w-1"
        style={{ background: fromColor }}
      />
      <div className="p-2.5 pl-3.5">
        {/* header row: from → to, kind badge, unread dot, timestamp */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-sm border"
            style={{
              borderColor: `color-mix(in oklch, ${fromColor} 50%, transparent)`,
              background: `color-mix(in oklch, ${fromColor} 12%, transparent)`,
            }}
          >
            <AgentGlyph name={m.fromAgent} className="h-3 w-3" style={{ color: fromColor }} />
          </span>
          <span className="font-mono font-bold" style={{ color: fromColor }}>
            {m.fromAgent}
          </span>
          <ArrowRight className="h-3 w-3 text-muted-foreground" />
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-sm border"
            style={{
              borderColor: `color-mix(in oklch, ${toColor} 50%, transparent)`,
              background: `color-mix(in oklch, ${toColor} 12%, transparent)`,
            }}
          >
            {m.toAgent === "broadcast" ? (
              <Radio className="h-3 w-3" style={{ color: toColor }} />
            ) : (
              <AgentGlyph name={m.toAgent} className="h-3 w-3" style={{ color: toColor }} />
            )}
          </span>
          <span className="font-mono font-bold" style={{ color: toColor }}>
            {m.toAgent}
          </span>

          <span
            className="ml-1 inline-flex items-center rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-wider"
            style={{
              color: k.color,
              background: `color-mix(in oklch, ${k.color} 14%, transparent)`,
              boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${k.color} 35%, transparent)`,
            }}
          >
            {k.label}
          </span>

          {!m.read && (
            <span
              title="unread"
              className="ml-1 inline-flex h-2 w-2 rounded-full"
              style={{
                background: "var(--a_danger)",
                boxShadow: "0 0 6px color-mix(in oklch, var(--a_danger) 70%, transparent)",
              }}
            />
          )}

          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            {timeAgo(m.createdAt)}
          </span>
        </div>

        {/* subject */}
        <div className="mt-1.5 font-mono text-xs font-semibold text-foreground/90">
          {m.subject}
        </div>

        {/* body */}
        <p className="mt-0.5 text-xs leading-snug text-foreground/70">{m.body}</p>
      </div>
    </motion.li>
  );
}

function EmptyBus() {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-2 text-center text-muted-foreground">
      <Inbox className="h-6 w-6 opacity-50" />
      <p className="text-xs">No inter-agent messages yet.</p>
      <p className="text-[10px] text-muted-foreground/70">
        Use the compose form to dispatch a delegate or query.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  icon: Icon,
  spin,
}: {
  label: string;
  value: string;
  accent: string;
  icon: LucideIcon;
  spin?: boolean;
}) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card/40 p-3">
      <div className="absolute left-0 top-0 h-full w-0.5" style={{ background: accent }} />
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
        <Icon className={`h-3 w-3 ${spin ? "animate-spin" : ""}`} style={{ color: accent }} />
      </div>
      <div className="mt-1 font-mono text-lg font-bold" style={{ color: accent }}>
        {value}
      </div>
    </div>
  );
}
