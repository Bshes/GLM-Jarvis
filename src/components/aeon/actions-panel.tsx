"use client";
/**
 * ActionsPanel — the tiered action queue + safety confirmation gate.
 *
 * Tier 1 (Autonomous) actions are auto-executed; Tier 2 (Confirmative) actions
 * queue as "pending" and require a human yes/no via the safety modal; Tier 3
 * (Advisory) actions surface as recommendations only. This is the human-in-the-
 * -loop contract from the spec.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldCheck, ShieldAlert, ShieldQuestion, Check, X, RotateCw, Activity } from "lucide-react";
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

  return (
    <div className="flex h-full flex-col gap-4">
      {/* header */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {([1, 2, 3] as SafetyTier[]).map((t) => {
          const meta = TIER_META[t];
          const Icon = TIER_ICONS[t];
          const count = actions.filter((a) => a.tier === t).length;
          return (
            <Card key={t} className="relative overflow-hidden border-border bg-card/40">
              <div className="absolute left-0 top-0 h-full w-1" style={{ background: meta.color }} />
              <CardContent className="p-3 pl-4">
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest" style={{ color: meta.color }}>
                  <Icon className="h-3 w-3" /> {meta.label}
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">{meta.name}</div>
                <div className="mt-1 font-mono text-xl font-bold" style={{ color: meta.color }}>{count}</div>
              </CardContent>
            </Card>
          );
        })}
        <Card className="relative overflow-hidden border-[var(--aeon-warn)]/40 bg-card/40">
          <div className="absolute left-0 top-0 h-full w-1 bg-[var(--aeon-warn)]" />
          <CardContent className="p-3 pl-4">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[var(--aeon-warn)]">
              <Activity className="h-3 w-3" /> Awaiting
            </div>
            <div className="mt-0.5 text-[10px] text-muted-foreground">confirmative</div>
            <div className="mt-1 font-mono text-xl font-bold text-[var(--aeon-warn)]">{pending.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* tier policy legend */}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        {([1, 2, 3] as SafetyTier[]).map((t) => {
          const meta = TIER_META[t];
          return (
            <div key={t} className="rounded-md border border-border/50 bg-background/30 p-2.5 text-[11px]">
              <span className="font-mono font-bold" style={{ color: meta.color }}>T{t} · {meta.name.toUpperCase()}</span>
              <p className="mt-0.5 text-muted-foreground">{meta.behavior}</p>
            </div>
          );
        })}
      </div>

      {/* filter bar */}
      <div className="flex flex-wrap items-center gap-1.5">
        {([
          ["pending", "Pending"], ["all", "All"], [1, "Tier 1"], [2, "Tier 2"], [3, "Tier 3"],
        ] as [Filter, string][]).map(([f, label]) => (
          <button
            key={String(f)}
            onClick={() => setFilter(f)}
            className={`rounded-sm border px-2.5 py-1 text-[11px] transition ${
              filter === f
                ? "border-[var(--aeon-core)] bg-[var(--aeon-core)]/10 text-foreground"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
            {f === "pending" && pending.length > 0 && (
              <span className="ml-1.5 rounded-sm bg-[var(--aeon-warn)]/20 px-1 text-[9px] font-bold text-[var(--aeon-warn)]">{pending.length}</span>
            )}
          </button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => void refresh()} className="ml-auto text-muted-foreground">
          <RotateCw className="h-3.5 w-3.5" /> Sync
        </Button>
      </div>

      {/* action list */}
      <ScrollArea className="aeon-scroll min-h-0 flex-1 rounded-lg border border-border bg-black/20">
        <div className="flex flex-col gap-2 p-3">
          <AnimatePresence initial={false}>
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No actions match this filter.
              </div>
            ) : (
              filtered.map((a) => (
                <ActionRow
                  key={a.id}
                  a={a}
                  onApprove={() => (a.tier === 2 ? openConfirm(a) : void decide(a, "approved"))}
                  onDeny={() => void decide(a, "denied")}
                  resolving={resolving === a.id}
                />
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>

      <SafetyModal />
    </div>
  );
}

function ActionRow({
  a, onApprove, onDeny, resolving,
}: { a: ActionView; onApprove: () => void; onDeny: () => void; resolving: boolean }) {
  const meta = TIER_META[a.tier as SafetyTier];
  const isPending = a.status === "pending";
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="relative overflow-hidden rounded-md border border-border/60 bg-card/40 p-3"
    >
      <div className="absolute left-0 top-0 h-full w-0.5" style={{ background: meta.color }} />
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
          style={{ borderColor: meta.color, background: `color-mix(in oklch, ${meta.color} 12%, transparent)` }}
        >
          <AgentGlyph name={a.agentName} className="h-4 w-4" style={{ color: meta.color }} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <TierBadge tier={a.tier as SafetyTier} />
            <span className="text-sm font-medium text-foreground">{a.title}</span>
            <StatusDot status={a.status} />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.status}</span>
          </div>
          {a.description && <p className="mt-1 text-xs text-foreground/70">{a.description}</p>}
          {a.result && (
            <p className="mt-1 rounded-sm bg-background/40 px-2 py-1 font-mono text-[10px] text-muted-foreground">
              → {a.result}
            </p>
          )}
          <div className="mt-1.5 flex items-center gap-2 text-[10px] text-muted-foreground">
            <Badge variant="outline" className="border-border/60 font-mono text-[9px]">{a.agentName}</Badge>
            <span>{timeAgo(a.createdAt)} ago</span>
          </div>
        </div>
        {isPending && (
          <div className="flex shrink-0 gap-1.5">
            <Button size="sm" variant="outline" onClick={onApprove} disabled={resolving}
              className="h-7 gap-1 border-[var(--aeon-active)]/40 text-[var(--aeon-active)] hover:bg-[var(--aeon-active)]/10">
              {resolving ? <RotateCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Approve
            </Button>
            <Button size="sm" variant="outline" onClick={onDeny} disabled={resolving}
              className="h-7 gap-1 border-[var(--aeon-danger)]/40 text-[var(--aeon-danger)] hover:bg-[var(--aeon-danger)]/10">
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
            <div className="rounded-md border border-border/60 bg-background/40 p-3">
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
            <p className="text-[11px] text-muted-foreground">
              By approving, A.E.O.N. will execute this action immediately. Deny to discard it.
            </p>
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
