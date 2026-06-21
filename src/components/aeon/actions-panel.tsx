"use client";
/**
 * ActionsPanel — the tiered action queue + safety confirmation gate.
 * Visually rich: gradient tier cards, hover glow, action timeline with
 * status dots, and the CONFIRMATIVE GATE modal for tier-2 human-in-the-loop.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck, ShieldAlert, ShieldQuestion, Check, X, RotateCw, Activity,
  Clock, Zap, ArrowRight, Layers, Filter,
} from "lucide-react";
import { useAeon } from "@/lib/store";
import { TIER_META, type ActionView, type SafetyTier } from "@/lib/aeon";
import { TierBadge, StatusDot, timeAgo, AgentGlyph } from "@/components/aeon/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

const TIER_ICONS: Record<SafetyTier, React.ElementType> = {
  1: ShieldCheck,
  2: ShieldQuestion,
  3: ShieldAlert,
};

type Filter = "all" | "pending" | 1 | 2 | 3;

export function ActionsPanel() {
  const actions = useAeon((s) => s.actions);
  const resolveAction = useAeon((s) => s.resolveAction);
  const openConfirm = useAeon((s) => s.openConfirm);
  const refresh = useAeon((s) => s.refresh);
  const [filter, setFilter] = useState<Filter>("pending");
  const [resolving, setResolving] = useState<string | null>(null);

  const pending = actions.filter((a) => a.status === "pending");
  const executed = actions.filter((a) => a.status === "executed");
  const denied = actions.filter((a) => a.status === "denied");
  const advisory = actions.filter((a) => a.status === "advisory");

  const filtered = actions.filter((a) => {
    if (filter === "all") return true;
    if (filter === "pending") return a.status === "pending";
    return a.tier === filter;
  });

  async function decide(a: ActionView, decision: "approved" | "denied") {
    setResolving(a.id);
    await resolveAction(a.id, decision);
    setResolving(null);
    toast[decision === "approved" ? "success" : "info"](
      decision === "approved" ? "Action approved & executed" : "Action denied",
    );
  }

  // Success rate
  const resolved = executed.length + denied.length;
  const successRate = resolved > 0 ? Math.round((executed.length / resolved) * 100) : 0;

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Gradient tier header cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {([1, 2, 3] as SafetyTier[]).map((t) => {
          const meta = TIER_META[t];
          const Icon = TIER_ICONS[t];
          const count = actions.filter((a) => a.tier === t).length;
          const pendingInTier = actions.filter((a) => a.tier === t && a.status === "pending").length;
          return (
            <motion.div
              key={t}
              whileHover={{ scale: 1.02 }}
              className="group relative overflow-hidden rounded-lg border cursor-pointer transition-shadow"
              style={{
                borderColor: `color-mix(in oklch, ${meta.color} 40%, transparent)`,
                boxShadow: `0 0 0 1px color-mix(in oklch, ${meta.color} 20%, transparent)`,
              }}
              onClick={() => setFilter(t)}
            >
              {/* gradient background */}
              <div
                className="absolute inset-0 opacity-[0.07] transition-opacity group-hover:opacity-[0.12]"
                style={{
                  background: `linear-gradient(135deg, ${meta.color}, color-mix(in oklch, ${meta.color} 40%, transparent) 70%)`,
                }}
              />
              {/* top accent gradient bar */}
              <div
                className="h-1 w-full"
                style={{
                  background: `linear-gradient(90deg, ${meta.color}, color-mix(in oklch, ${meta.color} 50%, transparent))`,
                }}
              />
              <div className="relative p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-md"
                      style={{ background: `color-mix(in oklch, ${meta.color} 18%, transparent)` }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                    </div>
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: meta.color }}>
                      T{t}
                    </span>
                  </div>
                  <span className="font-mono text-2xl font-bold" style={{ color: meta.color }}>{count}</span>
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[9px]">
                  <span className="uppercase tracking-wider text-muted-foreground">{meta.name}</span>
                  {pendingInTier > 0 && (
                    <span className="rounded-sm px-1 font-mono font-bold" style={{ color: meta.color, background: `color-mix(in oklch, ${meta.color} 15%, transparent)` }}>
                      {pendingInTier} pending
                    </span>
                  )}
                </div>
                {/* mini proportion bar */}
                {count > 0 && (
                  <div className="mt-2 h-1 overflow-hidden rounded-full bg-border/30">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.round((count / Math.max(actions.length, 1)) * 100)}%`,
                        background: `linear-gradient(90deg, ${meta.color}, color-mix(in oklch, ${meta.color} 60%, transparent))`,
                      }}
                    />
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}

        {/* Awaiting card */}
        <motion.div
          whileHover={{ scale: 1.02 }}
          className={`group relative overflow-hidden rounded-lg border transition-shadow ${
            pending.length > 0
              ? "border-[var(--aeon-warn)]/40 animate-aeon-pulse"
              : "border-border"
          }`}
          style={pending.length > 0 ? { boxShadow: "0 0 0 1px color-mix(in oklch, var(--aeon-warn) 30%, transparent), 0 0 16px color-mix(in oklch, var(--aeon-warn) 20%, transparent)" } : {}}
          onClick={() => setFilter("pending")}
        >
          <div className="h-1 w-full bg-gradient-to-r from-[var(--aeon-warn)] to-[var(--aeon-warn)]/50" />
          <div className="relative p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--aeon-warn)]/15">
                  <Activity className="h-3.5 w-3.5 text-[var(--aeon-warn)]" />
                </div>
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--aeon-warn)]">PENDING</span>
              </div>
              <span className="font-mono text-2xl font-bold text-[var(--aeon-warn)]">{pending.length}</span>
            </div>
            <div className="mt-1 text-[9px] uppercase tracking-wider text-muted-foreground">awaiting confirmation</div>
          </div>
        </motion.div>
      </div>

      {/* Summary stats row */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <MiniStat icon={Check} label="Executed" value={String(executed.length)} color="var(--aeon-active)" />
        <MiniStat icon={X} label="Denied" value={String(denied.length)} color="var(--aeon-danger)" />
        <MiniStat icon={Layers} label="Advisory" value={String(advisory.length)} color="var(--aeon-core)" />
        <MiniStat icon={Zap} label="Success Rate" value={`${successRate}%`} color={successRate >= 80 ? "var(--aeon-active)" : "var(--aeon-warn)"} />
      </div>

      {/* Tier policy strip */}
      <div className="grid grid-cols-1 gap-1.5 md:grid-cols-3">
        {([1, 2, 3] as SafetyTier[]).map((t) => {
          const meta = TIER_META[t];
          return (
            <div
              key={t}
              className="flex items-center gap-2 rounded-md border border-border/40 bg-background/30 px-2.5 py-1.5 text-[11px]"
            >
              <div className="h-5 w-5 shrink-0 rounded-sm" style={{ background: `linear-gradient(135deg, ${meta.color}, color-mix(in oklch, ${meta.color} 50%, transparent))` }} />
              <div>
                <span className="font-mono font-bold" style={{ color: meta.color }}>T{t} · {meta.name.toUpperCase()}</span>
                <p className="text-[10px] text-muted-foreground">{meta.behavior}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Filter className="h-3 w-3 text-muted-foreground" />
        {([
          ["pending", "Pending", pending.length], ["all", "All", actions.length],
          [1, "Tier 1", actions.filter((a) => a.tier === 1).length],
          [2, "Tier 2", actions.filter((a) => a.tier === 2).length],
          [3, "Tier 3", actions.filter((a) => a.tier === 3).length],
        ] as [Filter, string, number][]).map(([f, label, count]) => {
          const active = filter === f;
          const tierColor = typeof f === "number" ? TIER_META[f as SafetyTier]?.color : "var(--aeon-core)";
          return (
            <button
              key={String(f)}
              onClick={() => setFilter(f)}
              className={`inline-flex items-center gap-1.5 rounded-sm border px-2.5 py-1 text-[11px] transition ${
                active
                  ? "font-medium text-foreground"
                  : "border-border/60 text-muted-foreground hover:text-foreground"
              }`}
              style={active ? {
                borderColor: tierColor,
                background: `color-mix(in oklch, ${tierColor} 12%, transparent)`,
                boxShadow: `0 0 8px color-mix(in oklch, ${tierColor} 25%, transparent)`,
              } : {}}
            >
              {label}
              <span
                className="rounded-sm px-1 font-mono text-[9px] font-bold"
                style={active ? { color: tierColor, background: `color-mix(in oklch, ${tierColor} 15%, transparent)` } : {}}
              >
                {count}
              </span>
            </button>
          );
        })}
        <Button size="sm" variant="ghost" onClick={() => void refresh()} className="ml-auto text-muted-foreground">
          <RotateCw className="h-3.5 w-3.5" /> Sync
        </Button>
      </div>

      {/* Action timeline */}
      <ScrollArea className="aeon-scroll min-h-0 flex-1 rounded-lg border border-border bg-black/20">
        <div className="relative p-3">
          {/* Timeline spine */}
          {filtered.length > 0 && (
            <div className="absolute left-[22px] top-3 bottom-3 w-px bg-border/40" />
          )}
          <div className="flex flex-col gap-1.5">
            <AnimatePresence initial={false}>
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                  <div className="relative flex h-12 w-12 items-center justify-center">
                    <Layers className="h-5 w-5 text-[var(--aeon-core)]/60" />
                    <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[var(--aeon-core)]/30 animate-aeon-pulse" />
                  </div>
                  <p className="text-sm">No actions match this filter</p>
                  <p className="text-[10px] text-muted-foreground/60">Dispatch a directive or change the filter above</p>
                </div>
              ) : (
                filtered.map((a, idx) => (
                  <ActionRow
                    key={a.id}
                    a={a}
                    isFirst={idx === 0}
                    onApprove={() => (a.tier === 2 ? openConfirm(a) : void decide(a, "approved"))}
                    onDeny={() => void decide(a, "denied")}
                    resolving={resolving === a.id}
                  />
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </ScrollArea>

      <SafetyModal />
    </div>
  );
}

function ActionRow({
  a, isFirst, onApprove, onDeny, resolving,
}: { a: ActionView; isFirst: boolean; onApprove: () => void; onDeny: () => void; resolving: boolean }) {
  const meta = TIER_META[a.tier as SafetyTier];
  const isPending = a.status === "pending";
  const statusColor =
    a.status === "executed" ? "var(--aeon-active)" :
    a.status === "pending" ? "var(--aeon-warn)" :
    a.status === "denied" ? "var(--aeon-danger)" :
    a.status === "advisory" ? "var(--aeon-core)" :
    a.status === "failed" ? "var(--aeon-danger)" :
    "var(--muted-foreground)";

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className="group relative ml-6 rounded-md border border-border/50 bg-card/30 p-3 transition hover:border-border hover:bg-card/50"
      style={isPending ? {
        borderColor: `color-mix(in oklch, ${meta.color} 40%, transparent)`,
        boxShadow: `0 0 0 1px color-mix(in oklch, ${meta.color} 20%, transparent), 0 0 12px color-mix(in oklch, ${meta.color} 10%, transparent)`,
      } : {}}
    >
      {/* Timeline node */}
      <div
        className="absolute -left-[22px] top-4 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2"
        style={{
          borderColor: statusColor,
          background: isFirst ? statusColor : "var(--background)",
        }}
      >
        {isFirst && <span className="h-1.5 w-1.5 rounded-full bg-background" />}
      </div>

      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border transition-shadow group-hover:shadow-md"
          style={{
            borderColor: `color-mix(in oklch, ${meta.color} 40%, transparent)`,
            background: `linear-gradient(135deg, color-mix(in oklch, ${meta.color} 12%, transparent), color-mix(in oklch, ${meta.color} 5%, transparent))`,
          }}
        >
          <AgentGlyph name={a.agentName} className="h-4 w-4" style={{ color: meta.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <TierBadge tier={a.tier as SafetyTier} />
            <span className="text-sm font-medium text-foreground">{a.title}</span>
          </div>

          {/* Status indicator row */}
          <div className="mt-1 flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[9px] font-bold" style={{ color: statusColor, background: `color-mix(in oklch, ${statusColor} 14%, transparent)` }}>
              <StatusDot status={a.status} />
              {a.status.toUpperCase()}
            </span>
            {a.description && <span className="truncate text-[11px] text-muted-foreground">{a.description}</span>}
          </div>

          {a.result && (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-md bg-background/50 px-2 py-1.5">
              <ArrowRight className="mt-0.5 h-3 w-3 shrink-0" style={{ color: statusColor }} />
              <span className="font-mono text-[10px] leading-relaxed text-foreground/70">{a.result}</span>
            </div>
          )}

          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="border-border/50 font-mono text-[9px]">{a.agentName}</Badge>
            <span className="inline-flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" />{timeAgo(a.createdAt)}</span>
          </div>
        </div>

        {isPending && (
          <div className="flex shrink-0 flex-col gap-1">
            <Button size="sm" onClick={onApprove} disabled={resolving}
              className="h-7 gap-1 border bg-[var(--aeon-active)]/10 text-[var(--aeon-active)] transition hover:bg-[var(--aeon-active)]/20"
              variant="outline"
              style={{ borderColor: "color-mix(in oklch, var(--aeon-active) 40%, transparent)" }}
            >
              {resolving ? <RotateCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Approve
            </Button>
            <Button size="sm" onClick={onDeny} disabled={resolving}
              className="h-7 gap-1 border bg-[var(--aeon-danger)]/5 text-[var(--aeon-danger)] transition hover:bg-[var(--aeon-danger)]/15"
              variant="outline"
              style={{ borderColor: "color-mix(in oklch, var(--aeon-danger) 30%, transparent)" }}
            >
              <X className="h-3 w-3" /> Deny
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function SafetyModal() {
  const confirmAction = useAeon((s) => s.confirmAction);
  const closeConfirm = useAeon((s) => s.closeConfirm);
  const resolveAction = useAeon((s) => s.resolveAction);
  const [busy, setBusy] = useState(false);

  async function decide(d: "approved" | "denied") {
    if (!confirmAction) return;
    setBusy(true);
    await resolveAction(confirmAction.id, d);
    setBusy(false);
    closeConfirm();
    toast[d === "approved" ? "success" : "info"](d === "approved" ? "Confirmed & executed" : "Action denied");
  }

  const open = !!confirmAction;
  const a = confirmAction;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeConfirm()}>
      <DialogContent className="border-[var(--aeon-warn)]/40 bg-card">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-mono text-[var(--aeon-warn)]">
            <ShieldQuestion className="h-4 w-4" /> CONFIRMATIVE GATE — TIER 2
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            This action carries side effects and requires explicit human authorization before execution.
          </DialogDescription>
        </DialogHeader>

        {a && (
          <div className="space-y-3 py-2">
            <div className="relative overflow-hidden rounded-md border border-[var(--aeon-warn)]/30 bg-background/40 p-3">
              {/* gradient top accent */}
              <div className="absolute left-0 top-0 h-full w-1 bg-gradient-to-b from-[var(--aeon-warn)] to-[var(--aeon-warn)]/40" />
              <div className="pl-2">
                <div className="flex items-center gap-2">
                  <TierBadge tier={2} />
                  <span className="text-sm font-medium text-foreground">{a.title}</span>
                </div>
                {a.description && <p className="mt-1.5 text-xs text-foreground/80">{a.description}</p>}
                <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Badge variant="outline" className="border-border/60 font-mono text-[9px]">{a.agentName}</Badge>
                  <span>{timeAgo(a.createdAt)} ago</span>
                </div>
                {a.payload && (
                  <pre className="mt-2 max-h-32 overflow-auto rounded-sm bg-black/40 p-2 font-mono text-[10px] text-muted-foreground aeon-scroll">
                    {(() => { try { return JSON.stringify(JSON.parse(a.payload), null, 2); } catch { return a.payload; } })()}
                  </pre>
                )}
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-md border border-[var(--aeon-warn)]/20 bg-[var(--aeon-warn)]/5 p-2.5 text-[11px] text-[var(--aeon-warn)]">
              <Activity className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>By approving, A.E.O.N. will execute this action immediately with real side effects. Deny to discard it safely.</span>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => void decide("denied")} disabled={busy}
            className="gap-1.5 border-[var(--aeon-danger)]/40 text-[var(--aeon-danger)] hover:bg-[var(--aeon-danger)]/10">
            <X className="h-4 w-4" /> Deny
          </Button>
          <Button onClick={() => void decide("approved")} disabled={busy}
            className="gap-1.5 bg-[var(--aeon-active)] text-[var(--primary-foreground)] hover:brightness-110">
            {busy ? <RotateCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Approve & Execute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MiniStat({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/40 bg-background/30 px-2.5 py-2">
      <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
      <div>
        <div className="font-mono text-sm font-bold" style={{ color }}>{value}</div>
        <div className="text-[8px] uppercase tracking-widest text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}
