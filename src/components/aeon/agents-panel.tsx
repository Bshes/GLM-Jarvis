"use client";
/**
 * AgentsPanel — the A.E.O.N. sub-agent collective.
 * Shows each agent's status, model routing tier, task history, and lets the
 * operator dispatch a one-off directive to a specific agent.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { Cpu, Send, RotateCw, Circle } from "lucide-react";
import { useAeon } from "@/lib/store";
import { agentIcon, StatusDot, timeAgo, TierBadge } from "@/components/aeon/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const MODEL_LABEL: Record<string, string> = {
  local: "LLAMA-3 · LOCAL",
  cloud: "CLAUDE-3.5 · CLOUD",
};

export function AgentsPanel() {
  const agents = useAeon((s) => s.agents);
  const dispatch = useAeon((s) => s.dispatch);
  const orchestrating = useAeon((s) => s.orchestrating);
  const refresh = useAeon((s) => s.refresh);
  const [target, setTarget] = useState<string>(agents[0]?.name ?? "IoT");
  const [task, setTask] = useState("");

  const busy = orchestrating;
  const totalTasks = agents.reduce((n, a) => n + a.tasksDone, 0);
  const busyCount = agents.filter((a) => a.status === "busy").length;

  async function run() {
    if (!task.trim() || busy) return;
    await dispatch(task.trim(), `Routed to ${target} agent.`);
    setTask("");
    toast.success(`Directive dispatched to ${target}`);
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* header */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active Agents" value={String(agents.length)} accent="var(--aeon-core)" />
        <Stat label="Busy Now" value={String(busyCount)} accent="var(--aeon-warn)" />
        <Stat label="Tasks Completed" value={String(totalTasks)} accent="var(--aeon-active)" />
        <Stat label="Models Online" value="2" accent="var(--aeon-active)" />
      </div>

      {/* agent grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {agents.map((a) => {
          const Icon = agentIcon(a.name);
          return (
            <motion.div key={a.id} layout>
              <Card className="relative overflow-hidden border-border bg-card/40">
                <div className="absolute left-0 top-0 h-full w-1" style={{ background: a.color }} />
                <CardContent className="p-4 pl-5">
                  <div className="flex items-start gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border"
                      style={{ borderColor: a.color, background: `color-mix(in oklch, ${a.color} 12%, transparent)` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: a.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono text-sm font-bold tracking-wide" style={{ color: a.color }}>{a.name.toUpperCase()}</h3>
                        <StatusDot status={a.status} />
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.status}</span>
                      </div>
                      <p className="mt-0.5 text-xs text-muted-foreground">{a.role}</p>
                    </div>
                    <TierBadge tier={a.tier as 1 | 2 | 3} />
                  </div>

                  <p className="mt-3 text-xs leading-relaxed text-foreground/70">{a.description}</p>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <Badge variant="outline" className="border-border/60 font-mono text-[9px]" style={{ color: a.color }}>
                      {MODEL_LABEL[a.model] ?? a.model}
                    </Badge>
                    <Badge variant="outline" className="border-border/60 font-mono text-[9px] text-muted-foreground">
                      <Cpu className="mr-1 h-2.5 w-2.5" /> {a.tasksDone} tasks
                    </Badge>
                    {a.lastTask && (
                      <span className="truncate text-[10px] text-muted-foreground">
                        · last: {a.lastTask}
                      </span>
                    )}
                    {a.lastActive && (
                      <span className="ml-auto text-[10px] text-muted-foreground">
                        active {timeAgo(a.lastActive)} ago
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
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
                    ? "border-[var(--aeon-core)] bg-[var(--aeon-core)]/10 text-foreground"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <Circle className="h-1.5 w-1.5" style={{ color: a.color }} />
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
            <Button size="sm" onClick={() => void run()} disabled={busy || !task.trim()} className="gap-1.5 bg-[var(--aeon-core)] text-[var(--primary-foreground)] hover:brightness-110">
              {busy ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              Dispatch to {target}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void refresh()} className="text-muted-foreground">
              <RotateCw className="h-3.5 w-3.5" /> Sync
            </Button>
          </div>
        </CardContent>
      </Card>
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
