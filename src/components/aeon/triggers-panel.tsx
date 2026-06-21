"use client";

/**
 * A.E.O.N. — Anticipatory Triggers panel.
 *
 * The "anticipatory execution" contract: conditions on sensory data
 * (biometric / vision / audio / time / system) that autonomously fire
 * sub-agent workflows without explicit user prompting.
 *
 * Operator controls:
 *   - Browse / arm / disarm / delete triggers
 *   - Create new trigger (modal)
 *   - Inject simulated sensory events to test triggers live
 *   - Run the anticipatory engine and see which triggers fired
 *   - Watch the recent sensory feed
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Activity,
  Clock,
  Code2,
  Cpu,
  Ear,
  Eye,
  Globe,
  HeartPulse,
  House,
  Loader2,
  Play,
  Plus,
  Syringe,
  Trash2,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { useAeon } from "@/lib/store";
import type { SafetyTier, SensoryEventView, TriggerView } from "@/lib/aeon";
import { TierBadge, timeAgo } from "@/components/aeon/ui";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

/* ------------------------------------------------------------------ */
/*  Catalogs                                                           */
/* ------------------------------------------------------------------ */

type Channel = "biometric" | "vision" | "audio" | "time" | "system";

const CHANNELS: Channel[] = ["biometric", "vision", "audio", "time", "system"];

const CHANNEL_META: Record<
  Channel,
  { color: string; icon: LucideIcon; label: string }
> = {
  biometric: { color: "var(--a_danger)", icon: HeartPulse, label: "BIO" },
  vision: { color: "var(--a_active)", icon: Eye, label: "VIS" },
  audio: { color: "var(--a_core)", icon: Ear, label: "AUD" },
  time: { color: "var(--a_warn)", icon: Clock, label: "TIME" },
  system: { color: "var(--muted-foreground)", icon: Cpu, label: "SYS" },
};

const OPERATOR_META: Record<
  string,
  { symbol: string; label: string }
> = {
  gt: { symbol: ">", label: "greater than" },
  lt: { symbol: "<", label: "less than" },
  eq: { symbol: "=", label: "equals" },
  between: { symbol: "∈", label: "between (lo,hi)" },
};

const AGENTS = ["Coder", "Researcher", "IoT", "Financial"] as const;
type AgentName = (typeof AGENTS)[number];

const METRIC_SUGGESTIONS: Record<Channel, string[]> = {
  biometric: ["heart_rate", "hrv", "sleep_hours", "stress_index", "steps"],
  vision: ["posture", "presence", "screen_time", "faces", "objects"],
  audio: ["noise_db", "voice_activity", "keyword", "cry_detected"],
  time: ["hour", "weekday", "minute_of_day"],
  system: ["spend_delta", "error_rate", "queue_depth", "cpu_load"],
};

/* ------------------------------------------------------------------ */
/*  Pure helpers                                                       */
/* ------------------------------------------------------------------ */

function channelMeta(channel: string) {
  return (
    CHANNEL_META[channel as Channel] ?? CHANNEL_META.system
  );
}

function renderCondition(
  metric: string,
  operator: string,
  threshold: string,
): string {
  const op = OPERATOR_META[operator];
  if (!op) return `${metric} ? ${threshold}`;
  if (operator === "between") return `${metric} ∈ [${threshold}]`;
  return `${metric} ${op.symbol} ${threshold}`;
}

function parseSensoryValue(
  raw: string,
): { metric: string | null; value: string } {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if ("metric" in obj && "value" in obj) {
        return { metric: String(obj.metric), value: String(obj.value) };
      }
      if ("value" in obj) return { metric: null, value: String(obj.value) };
    }
    return { metric: null, value: String(parsed) };
  } catch {
    return { metric: null, value: raw };
  }
}

function severityColor(severity: string): string {
  switch (severity) {
    case "critical":
    case "error":
      return "var(--a_danger)";
    case "warn":
    case "warning":
      return "var(--a_warn)";
    case "info":
      return "var(--a_core)";
    case "debug":
      return "var(--muted-foreground)";
    default:
      return "var(--a_active)";
  }
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

/** Local agent→icon map (mirrors `agentIcon` in @/components/aeon/ui).
 *  Property access (not a function call) keeps the react-hooks/static-components
 *  lint rule happy. */
const AGENT_ICONS_LOCAL: Record<string, LucideIcon> = {
  Coder: Code2,
  Researcher: Globe,
  IoT: House,
  Financial: Wallet,
};

/** Renders the agent's Lucide icon by name. */
function AgentGlyph({
  name,
  className,
}: {
  name: string;
  className?: string;
}) {
  const Icon = AGENT_ICONS_LOCAL[name] ?? Cpu;
  return <Icon className={className} />;
}

function ChannelBadge({ channel }: { channel: string }) {
  const meta = channelMeta(channel);
  const Icon = meta.icon;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-widest uppercase"
      style={{
        color: meta.color,
        background: `color-mix(in oklch, ${meta.color} 14%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${meta.color} 35%, transparent)`,
      }}
    >
      <Icon className="size-3" />
      {meta.label}
    </span>
  );
}

function StatTile({
  label,
  value,
  color,
}: {
  label: string;
  value: string | number;
  color: string;
}) {
  return (
    <div
      className="aeon-clip-corner flex flex-col gap-0.5 bg-card/60 px-3 py-2"
      style={{ boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 25%, transparent)` }}
    >
      <span
        className="font-mono text-[9px] uppercase tracking-widest"
        style={{ color: "var(--muted-foreground)" }}
      >
        {label}
      </span>
      <span
        className="font-mono text-lg font-bold leading-none"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
}

function TriggerCard({
  trigger,
  recentlyFired,
  onToggle,
  onDelete,
  busyId,
}: {
  trigger: TriggerView;
  recentlyFired: boolean;
  onToggle: (t: TriggerView, next: boolean) => void;
  onDelete: (t: TriggerView) => void;
  busyId: string | null;
}) {
  const busy = busyId === trigger.id;
  const channelColor = channelMeta(trigger.channel).color;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="relative"
    >
      <Card
        className={cn(
          "gap-0 overflow-hidden py-0 transition-all",
          recentlyFired && "animate-aeon-pulse",
        )}
        style={{
          boxShadow: recentlyFired
            ? `0 0 0 1px color-mix(in oklch, var(--a_active) 60%, transparent), 0 0 18px 2px color-mix(in oklch, var(--a_active) 35%, transparent)`
            : `inset 0 0 0 1px color-mix(in oklch, ${channelColor} 18%, transparent)`,
        }}
      >
        {/* top accent strip */}
        <div
          className="h-0.5 w-full"
          style={{ background: channelColor, opacity: trigger.enabled ? 0.9 : 0.25 }}
        />
        <CardHeader className="gap-2 px-4 pt-4 pb-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <ChannelBadge channel={trigger.channel} />
                <TierBadge tier={trigger.tier as SafetyTier} />
                {!trigger.enabled && (
                  <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                    · disarmed
                  </span>
                )}
              </div>
              <CardTitle className="truncate font-mono text-sm tracking-wide">
                {trigger.name}
              </CardTitle>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Switch
                checked={trigger.enabled}
                disabled={busy}
                onCheckedChange={(v) => onToggle(trigger, v)}
                aria-label="Toggle trigger armed state"
              />
              <Button
                size="icon"
                variant="ghost"
                className="size-7 text-muted-foreground hover:text-[oklch(0.64_0.21_18)]"
                disabled={busy}
                onClick={() => onDelete(trigger)}
                aria-label="Delete trigger"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-3 px-4 pb-4">
          {/* condition */}
          <div className="flex items-center gap-2">
            <span
              className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground"
            >
              when
            </span>
            <code
              className="rounded-sm bg-card/80 px-2 py-1 font-mono text-xs"
              style={{
                color: channelColor,
                boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${channelColor} 25%, transparent)`,
              }}
            >
              {renderCondition(trigger.metric, trigger.operator, trigger.threshold)}
            </code>
          </div>

          {/* agent + action */}
          <div className="flex items-start gap-2 rounded-sm bg-card/40 p-2">
            <span
              className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm"
              style={{
                color: "var(--a_core)",
                background: "color-mix(in oklch, var(--a_core) 14%, transparent)",
              }}
            >
              <AgentGlyph name={trigger.agentName} className="size-3.5" />
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                → {trigger.agentName}
              </span>
              <p className="text-xs leading-snug text-foreground/90">
                {trigger.action || <span className="italic text-muted-foreground">no action</span>}
              </p>
            </div>
          </div>

          {/* footer stats */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Zap className="size-3" style={{ color: "var(--a_warn)" }} />
                <span className="tabular-nums">{trigger.fireCount}</span> fires
              </span>
              <Separator orientation="vertical" className="h-3" />
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" />
                {trigger.lastFired ? timeAgo(trigger.lastFired) : "never"}
              </span>
            </div>
            {busy && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Create-trigger form (inside Dialog)                                */
/* ------------------------------------------------------------------ */

interface TriggerForm {
  name: string;
  channel: Channel;
  metric: string;
  operator: "gt" | "lt" | "eq" | "between";
  threshold: string;
  agentName: AgentName;
  action: string;
  tier: SafetyTier;
}

const EMPTY_FORM: TriggerForm = {
  name: "",
  channel: "biometric",
  metric: "heart_rate",
  operator: "gt",
  threshold: "110",
  agentName: "Coder",
  action: "",
  tier: 2,
};

function CreateTriggerDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState<TriggerForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  const update = <K extends keyof TriggerForm>(key: K, value: TriggerForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim()) {
      toast.error("Trigger name is required");
      return;
    }
    if (!form.metric.trim()) {
      toast.error("Metric is required");
      return;
    }
    if (!form.threshold.trim()) {
      toast.error("Threshold is required");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/aeon/triggers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      toast.success(`Trigger armed: ${form.name}`, {
        description: `${renderCondition(form.metric, form.operator, form.threshold)} → ${form.agentName}`,
      });
      setForm(EMPTY_FORM);
      onOpenChange(false);
      await onCreated();
    } catch (e) {
      toast.error("Failed to create trigger", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setSubmitting(false);
    }
  }, [form, onCreated, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto aeon-scroll sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono tracking-wide">
            <Plus className="size-4" style={{ color: "var(--a_core)" }} />
            ARM NEW TRIGGER
          </DialogTitle>
          <DialogDescription>
            Define an anticipatory condition. When met by a sensory observation,
            A.E.O.N. will autonomously dispatch the target sub-agent.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* name */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="tr-name" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Trigger name
            </Label>
            <Input
              id="tr-name"
              value={form.name}
              onChange={(e) => update("name", e.target.value)}
              placeholder="e.g. Stress spike → Researcher"
              className="font-mono text-sm"
            />
          </div>

          {/* channel */}
          <div className="flex flex-col gap-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Channel
            </Label>
            <Select value={form.channel} onValueChange={(v) => update("channel", v as Channel)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => {
                  const M = CHANNEL_META[c];
                  return (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-2">
                        <M.icon className="size-3.5" style={{ color: M.color }} />
                        <span className="font-mono uppercase tracking-wide">{c}</span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* agent */}
          <div className="flex flex-col gap-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Target agent
            </Label>
            <Select value={form.agentName} onValueChange={(v) => update("agentName", v as AgentName)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AGENTS.map((a) => (
                  <SelectItem key={a} value={a}>
                    <span className="flex items-center gap-2">
                      <AgentGlyph name={a} className="size-3.5" />
                      {a}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* metric */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tr-metric" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Metric
            </Label>
            <Input
              id="tr-metric"
              value={form.metric}
              onChange={(e) => update("metric", e.target.value)}
              list="metric-suggestions"
              placeholder="heart_rate"
              className="font-mono text-sm"
            />
            <datalist id="metric-suggestions">
              {METRIC_SUGGESTIONS[form.channel].map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>

          {/* operator */}
          <div className="flex flex-col gap-1.5">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Operator
            </Label>
            <Select
              value={form.operator}
              onValueChange={(v) => update("operator", v as TriggerForm["operator"])}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(OPERATOR_META).map(([op, m]) => (
                  <SelectItem key={op} value={op}>
                    <span className="font-mono">
                      {m.symbol} · {m.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* threshold */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="tr-threshold" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Threshold {form.operator === "between" && "(comma-separated: lo,hi)"}
            </Label>
            <Input
              id="tr-threshold"
              value={form.threshold}
              onChange={(e) => update("threshold", e.target.value)}
              placeholder={form.operator === "between" ? "60,100" : "110"}
              className="font-mono text-sm"
            />
          </div>

          {/* tier */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Safety tier
            </Label>
            <Select
              value={String(form.tier)}
              onValueChange={(v) => update("tier", Number(v) as SafetyTier)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">
                  <span className="font-mono">T1 · Autonomous (executes immediately)</span>
                </SelectItem>
                <SelectItem value="2">
                  <span className="font-mono">T2 · Confirmative (asks operator)</span>
                </SelectItem>
                <SelectItem value="3">
                  <span className="font-mono">T3 · Advisory (recommendation only)</span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* action */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="tr-action" className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
              Action description
            </Label>
            <Textarea
              id="tr-action"
              value={form.action}
              onChange={(e) => update("action", e.target.value)}
              placeholder="Open a focused research workspace, dim the lights, queue a 5-min break reminder…"
              className="min-h-20 text-sm"
            />
          </div>
        </div>

        {/* live condition preview */}
        <div
          className="flex items-center gap-2 rounded-md px-3 py-2 font-mono text-xs"
          style={{
            background: "color-mix(in oklch, var(--a_core) 8%, transparent)",
            boxShadow: "inset 0 0 0 1px color-mix(in oklch, var(--a_core) 25%, transparent)",
            color: "var(--a_core)",
          }}
        >
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
            contract:
          </span>
          <span className="truncate">
            {renderCondition(form.metric || "metric", form.operator, form.threshold || "?")}
            {" → "}
            <span className="text-foreground">{form.agentName}</span>
          </span>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="font-mono tracking-wide"
          >
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Arming…
              </>
            ) : (
              <>
                <Zap className="size-4" />
                Arm trigger
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Sensory injector                                                   */
/* ------------------------------------------------------------------ */

interface InjectForm {
  channel: Channel;
  metric: string;
  value: string;
}

function SensoryInjector({
  onInjected,
}: {
  onInjected: () => Promise<void>;
}) {
  const [form, setForm] = useState<InjectForm>({
    channel: "biometric",
    metric: "heart_rate",
    value: "130",
  });
  const [busy, setBusy] = useState(false);

  const update = <K extends keyof InjectForm>(key: K, value: InjectForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const inject = useCallback(async () => {
    const numeric = Number(form.value);
    if (form.value === "" || Number.isNaN(numeric)) {
      toast.error("Value must be a number");
      return;
    }
    if (!form.metric.trim()) {
      toast.error("Metric is required");
      return;
    }
    setBusy(true);
    try {
      const postRes = await fetch("/api/aeon/events", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel: form.channel,
          metric: form.metric,
          value: numeric,
        }),
      });
      if (!postRes.ok) throw new Error(`POST events → ${postRes.status}`);

      // immediately evaluate triggers
      const evalRes = await fetch("/api/aeon/triggers/evaluate");
      const evalData = (await evalRes.json()) as {
        ok: boolean;
        fired: { trigger: string; action: string; agent: string; tier: number }[];
        evaluatedAt: string;
      };

      await onInjected();

      if (evalData.fired.length === 0) {
        toast.info(`Injected ${form.metric}=${numeric} on ${form.channel}`, {
          description: "No triggers fired (cooldown or no match).",
        });
      } else {
        const names = evalData.fired.map((f) => f.trigger);
        toast.success(
          `${evalData.fired.length} trigger${evalData.fired.length > 1 ? "s" : ""} fired`,
          {
            description: names.join(", "),
          },
        );
      }
    } catch (e) {
      toast.error("Injection failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setBusy(false);
    }
  }, [form, onInjected]);

  const M = CHANNEL_META[form.channel];

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="h-0.5 w-full" style={{ background: M.color }} />
      <CardHeader className="gap-1 px-4 pt-4 pb-2">
        <CardTitle className="flex items-center gap-2 font-mono text-sm tracking-wide">
          <Syringe className="size-4" style={{ color: M.color }} />
          SENSORY INJECTION
        </CardTitle>
        <CardDescription className="text-xs">
          Simulate a sensory observation to test triggers live.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 px-4 pb-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex flex-col gap-1.5">
            <Label className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Channel
            </Label>
            <Select value={form.channel} onValueChange={(v) => update("channel", v as Channel)}>
              <SelectTrigger className="w-full" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => {
                  const CM = CHANNEL_META[c];
                  return (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-2">
                        <CM.icon className="size-3.5" style={{ color: CM.color }} />
                        <span className="font-mono uppercase tracking-wide">{c}</span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="inj-metric" className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Metric
            </Label>
            <Input
              id="inj-metric"
              value={form.metric}
              onChange={(e) => update("metric", e.target.value)}
              list="inject-metric-suggestions"
              className="h-8 font-mono text-xs"
            />
            <datalist id="inject-metric-suggestions">
              {METRIC_SUGGESTIONS[form.channel].map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label htmlFor="inj-value" className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
              Value
            </Label>
            <Input
              id="inj-value"
              type="number"
              inputMode="decimal"
              value={form.value}
              onChange={(e) => update("value", e.target.value)}
              className="h-8 font-mono text-xs"
            />
          </div>
          <Button
            onClick={inject}
            disabled={busy}
            size="sm"
            className="font-mono tracking-wide"
            style={{
              background: `color-mix(in oklch, ${M.color} 18%, transparent)`,
              color: M.color,
              boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${M.color} 45%, transparent)`,
            }}
          >
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Syringe className="size-3.5" />}
            Inject & evaluate
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Recent sensory feed                                                */
/* ------------------------------------------------------------------ */

function SensoryFeed({ events }: { events: SensoryEventView[] }) {
  const recent = useMemo(() => events.slice(0, 15), [events]);

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div
        className="h-0.5 w-full"
        style={{ background: "var(--a_active)", opacity: 0.7 }}
      />
      <CardHeader className="gap-1 px-4 pt-4 pb-2">
        <CardTitle className="flex items-center gap-2 font-mono text-sm tracking-wide">
          <Activity className="size-4" style={{ color: "var(--a_active)" }} />
          SENSORY FEED
        </CardTitle>
        <CardDescription className="text-xs">
          Last {recent.length} injected / system observations.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-2 pb-2">
        {recent.length === 0 ? (
          <div className="flex h-20 items-center justify-center px-2 text-center font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            no observations yet
          </div>
        ) : (
          <ul className="aeon-scroll max-h-72 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {recent.map((e) => {
                const parsed = parseSensoryValue(e.value);
                const M = channelMeta(e.channel);
                const sev = severityColor(e.severity);
                return (
                  <motion.li
                    key={e.id}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    transition={{ duration: 0.18 }}
                    className="flex items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-card/40"
                  >
                    <span
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: sev, boxShadow: `0 0 6px ${sev}` }}
                    />
                    <M.icon className="size-3.5 shrink-0" style={{ color: M.color }} />
                    <div className="flex min-w-0 flex-1 flex-col">
                      <div className="flex items-baseline gap-1.5 truncate">
                        <span className="font-mono text-xs" style={{ color: M.color }}>
                          {parsed.metric ?? e.channel}
                        </span>
                        <span className="font-mono text-xs font-bold text-foreground">
                          {parsed.value}
                        </span>
                      </div>
                      <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                        {e.channel} · {e.severity}
                      </span>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                      {timeAgo(e.createdAt)}
                    </span>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                         */
/* ------------------------------------------------------------------ */

export default function TriggersPanel() {
  const triggers = useAeon((s) => s.triggers);
  const sensory = useAeon((s) => s.sensory);
  const refresh = useAeon((s) => s.refresh);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [recentlyFired, setRecentlyFired] = useState<Set<string>>(new Set());
  const fireTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // clean up the highlight timer on unmount
  useEffect(() => {
    return () => {
      if (fireTimerRef.current) clearTimeout(fireTimerRef.current);
    };
  }, []);

  const stats = useMemo(() => {
    const total = triggers.length;
    const armed = triggers.filter((t) => t.enabled).length;
    const fired = triggers.filter((t) => t.fireCount > 0).length;
    const firedLastHour = triggers.filter(
      (t) => t.lastFired && Date.now() - new Date(t.lastFired).getTime() < 3_600_000,
    ).length;
    return { total, armed, fired, firedLastHour };
  }, [triggers]);

  const highlightFired = useCallback((names: string[]) => {
    setRecentlyFired(new Set(names));
    if (fireTimerRef.current) clearTimeout(fireTimerRef.current);
    fireTimerRef.current = setTimeout(() => setRecentlyFired(new Set()), 6_000);
  }, []);

  const handleToggle = useCallback(
    async (t: TriggerView, next: boolean) => {
      setBusyId(t.id);
      try {
        const res = await fetch("/api/aeon/triggers", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: t.id, enabled: next }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success(`${t.name} ${next ? "armed" : "disarmed"}`);
        await refresh();
      } catch (e) {
        toast.error("Toggle failed", {
          description: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const handleDelete = useCallback(
    async (t: TriggerView) => {
      setBusyId(t.id);
      try {
        const res = await fetch(`/api/aeon/triggers?id=${encodeURIComponent(t.id)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        toast.success(`Trigger deleted: ${t.name}`);
        await refresh();
      } catch (e) {
        toast.error("Delete failed", {
          description: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setBusyId(null);
      }
    },
    [refresh],
  );

  const runAnticipatory = useCallback(async () => {
    setEvaluating(true);
    try {
      const res = await fetch("/api/aeon/triggers/evaluate");
      const data = (await res.json()) as {
        ok: boolean;
        fired: { trigger: string; action: string; agent: string; tier: number }[];
        evaluatedAt: string;
      };
      const names = data.fired.map((f) => f.trigger);
      highlightFired(names);
      await refresh();
      if (data.fired.length === 0) {
        toast.info("Anticipatory sweep complete", {
          description: "No triggers fired (cooldown or no match).",
        });
      } else {
        toast.success(
          `${data.fired.length} trigger${data.fired.length > 1 ? "s" : ""} fired`,
          {
            description: names.join(", "),
          },
        );
      }
    } catch (e) {
      toast.error("Anticipatory sweep failed", {
        description: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setEvaluating(false);
    }
  }, [highlightFired, refresh]);

  return (
    <section
      className="aeon-grid-bg relative flex min-h-[60vh] flex-col gap-4 p-1"
      aria-label="Anticipatory triggers configuration"
    >
      {/* (sonner Toaster is mounted globally in the app shell) */}

      {/* header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Zap className="size-5" style={{ color: "var(--a_core)" }} />
            <h2
              className="font-mono text-lg font-bold tracking-widest uppercase"
              style={{ color: "var(--a_core)" }}
            >
              Anticipatory Triggers
            </h2>
            <span
              className="hidden font-mono text-[10px] uppercase tracking-widest text-muted-foreground sm:inline"
            >
              · PERCEIVE → ACT
            </span>
          </div>
          <p className="max-w-2xl text-xs text-muted-foreground">
            Conditions on sensory data that autonomously fire sub-agent workflows
            without explicit prompting. Inject simulated observations to test the
            contract live.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={runAnticipatory}
            disabled={evaluating}
            className="font-mono tracking-wide"
          >
            {evaluating ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Play className="size-3.5" style={{ color: "var(--a_active)" }} />
            )}
            Run anticipatory check
          </Button>
          <Button
            size="sm"
            onClick={() => setCreateOpen(true)}
            className="font-mono tracking-wide"
          >
            <Plus className="size-3.5" />
            Create trigger
          </Button>
        </div>
      </header>

      {/* stat row */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Triggers" value={stats.total} color="var(--a_core)" />
        <StatTile label="Armed" value={stats.armed} color="var(--a_active)" />
        <StatTile label="Fired" value={stats.fired} color="var(--a_warn)" />
        <StatTile label="Last 1h" value={stats.firedLastHour} color="var(--a_danger)" />
      </div>

      {/* main grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* trigger list */}
        <div className="lg:col-span-2">
          {triggers.length === 0 ? (
            <Card className="flex h-full min-h-48 items-center justify-center border-dashed py-12">
              <CardContent className="flex flex-col items-center gap-2 text-center">
                <Zap className="size-6 text-muted-foreground" />
                <p className="font-mono text-xs uppercase tracking-widest text-muted-foreground">
                  No triggers armed
                </p>
                <p className="max-w-xs text-xs text-muted-foreground">
                  Create a trigger to let A.E.O.N. anticipate sensory conditions
                  and dispatch sub-agents autonomously.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <AnimatePresence initial={false}>
                {triggers.map((t) => (
                  <TriggerCard
                    key={t.id}
                    trigger={t}
                    recentlyFired={recentlyFired.has(t.name)}
                    onToggle={handleToggle}
                    onDelete={handleDelete}
                    busyId={busyId}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* right sidebar */}
        <div className="flex flex-col gap-4">
          <SensoryInjector onInjected={refresh} />
          <SensoryFeed events={sensory} />
        </div>
      </div>

      <CreateTriggerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={refresh}
      />
    </section>
  );
}
