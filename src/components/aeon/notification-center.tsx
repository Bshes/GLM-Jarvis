"use client";
/**
 * NotificationCenter — the A.E.O.N. activity inbox.
 *
 * A bell icon in the header with a badge counting unread items. Opens a dropdown
 * aggregating: pending tier-2 actions, unread agent messages, recent fired
 * triggers, and recent errors. The operator's single inbox for "what needs me".
 */
import { useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, ShieldQuestion, MessageSquare, Zap, AlertTriangle,
  CheckCheck, Inbox,
} from "lucide-react";
import { useAeon } from "@/lib/store";
import { timeAgo, AgentGlyph } from "@/components/aeon/ui";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export function NotificationCenter() {
  const actions = useAeon((s) => s.actions);
  const agentMessages = useAeon((s) => s.agentMessages);
  const triggers = useAeon((s) => s.triggers);
  const logs = useAeon((s) => s.logs);
  const setView = useAeon((s) => s.setView);
  const refreshAgentMessages = useAeon((s) => s.refreshAgentMessages);

  const pendingActions = actions.filter((a) => a.status === "pending");
  const unreadMessages = agentMessages.filter((m) => !m.read);
  const firedTriggers = triggers.filter((t) => t.fireCount > 0);
  const recentErrors = logs.filter((l) => l.level === "ERROR").slice(0, 3);

  const totalUnread = pendingActions.length + unreadMessages.length + recentErrors.length;

  const items = useMemo(() => {
    type Item = {
      id: string;
      kind: "action" | "message" | "trigger" | "error";
      title: string;
      detail: string;
      ts: string;
      color: string;
      icon: typeof ShieldQuestion;
      agentName?: string;
    };
    const list: Item[] = [];

    for (const a of pendingActions) {
      list.push({
        id: `act-${a.id}`,
        kind: "action",
        title: a.title,
        detail: `${a.agentName} · Tier ${a.tier} · awaits confirmation`,
        ts: a.createdAt,
        color: "var(--a_warn)",
        icon: ShieldQuestion,
        agentName: a.agentName,
      });
    }
    for (const m of unreadMessages) {
      list.push({
        id: `msg-${m.id}`,
        kind: "message",
        title: m.subject,
        detail: `${m.fromAgent} → ${m.toAgent} · ${m.kind}`,
        ts: m.createdAt,
        color: "var(--a_active)",
        icon: MessageSquare,
        agentName: m.fromAgent,
      });
    }
    for (const t of firedTriggers.slice(0, 3)) {
      list.push({
        id: `trg-${t.id}`,
        kind: "trigger",
        title: t.name,
        detail: `fired ${t.fireCount}× · ${t.action.slice(0, 50)}`,
        ts: t.lastFired ?? new Date(0).toISOString(),
        color: "var(--a_core)",
        icon: Zap,
      });
    }
    for (const l of recentErrors) {
      list.push({
        id: `err-${l.id}`,
        kind: "error",
        title: l.message.slice(0, 80),
        detail: `${l.source}${l.phase ? ` · ${l.phase}` : ""}`,
        ts: l.createdAt,
        color: "var(--a_danger)",
        icon: AlertTriangle,
      });
    }

    return list.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
  }, [pendingActions, unreadMessages, firedTriggers, recentErrors]);

  function markAllRead() {
    if (unreadMessages.length > 0) {
      fetch("/api/aeon/agents/messages", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ids: unreadMessages.map((m) => m.id) }),
      }).then(() => void refreshAgentMessages());
    }
  }

  function goto(kind: string) {
    if (kind === "action") setView("actions");
    else if (kind === "message") setView("agents");
    else if (kind === "trigger") setView("triggers");
    else if (kind === "error") setView("logs");
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/60 bg-background/40 text-muted-foreground transition hover:border-[oklch(0.82_0.15_75)]/50 hover:text-foreground"
          aria-label={`Notifications (${totalUnread} unread)`}
        >
          <Bell className="h-4 w-4" />
          {totalUnread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[oklch(0.64_0.21_18)] px-1 font-mono text-[9px] font-bold text-white"
            >
              {totalUnread > 9 ? "9+" : totalUnread}
            </motion.span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[360px] gap-0 border-border bg-popover/95 p-0 backdrop-blur-xl"
      >
        <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
          <Bell className="h-3.5 w-3.5 text-[oklch(0.82_0.15_75)]" />
          <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-foreground">Activity Inbox</span>
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">{items.length} items</span>
          {items.length > 0 && (
            <Button size="sm" variant="ghost" onClick={markAllRead} className="h-6 gap-1 px-2 text-[10px] text-muted-foreground hover:text-foreground">
              <CheckCheck className="h-3 w-3" /> Mark read
            </Button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 px-3 py-2">
          <SummaryChip count={pendingActions.length} label="pending" color="var(--a_warn)" />
          <SummaryChip count={unreadMessages.length} label="messages" color="var(--a_active)" />
          <SummaryChip count={firedTriggers.length} label="triggers" color="var(--a_core)" />
          <SummaryChip count={recentErrors.length} label="errors" color="var(--a_danger)" />
        </div>

        <ScrollArea className="aeon-scroll max-h-[340px]">
          <div className="flex flex-col">
            {items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Inbox className="h-6 w-6 text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">All clear — nothing needs your attention</p>
              </div>
            ) : (
              <AnimatePresence initial={false}>
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <motion.button
                      key={item.id}
                      layout
                      initial={{ opacity: 0, x: -6 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      onClick={() => goto(item.kind)}
                      className="group flex items-start gap-2.5 border-b border-border/40 px-3 py-2 text-left transition hover:bg-[oklch(0.82_0.15_75)]/5"
                    >
                      <div
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
                        style={{
                          borderColor: `color-mix(in oklch, ${item.color} 40%, transparent)`,
                          background: `color-mix(in oklch, ${item.color} 12%, transparent)`,
                        }}
                      >
                        {item.kind === "message" && item.agentName ? (
                          <AgentGlyph name={item.agentName} className="h-3.5 w-3.5" style={{ color: item.color }} />
                        ) : (
                          <Icon className="h-3.5 w-3.5" style={{ color: item.color }} />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="rounded-sm px-1 font-mono text-[8px] font-bold uppercase tracking-wider"
                            style={{ color: item.color, background: `color-mix(in oklch, ${item.color} 14%, transparent)` }}
                          >
                            {item.kind}
                          </span>
                          <span className="truncate text-xs font-medium text-foreground">{item.title}</span>
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{item.detail}</div>
                      </div>
                      <span className="shrink-0 font-mono text-[9px] text-muted-foreground">{timeAgo(item.ts)}</span>
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>

        <div className="border-t border-border/60 bg-background/40 px-3 py-1.5 text-center">
          <span className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
            click an item to jump to its view
          </span>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SummaryChip({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div
      className="inline-flex items-center gap-1 rounded-sm border px-1.5 py-0.5 text-[9px]"
      style={{
        borderColor: count > 0 ? `color-mix(in oklch, ${color} 35%, transparent)` : "var(--border)",
        background: count > 0 ? `color-mix(in oklch, ${color} 8%, transparent)` : "transparent",
        opacity: count > 0 ? 1 : 0.5,
      }}
    >
      <span className="font-mono font-bold" style={{ color: count > 0 ? color : "var(--muted-foreground)" }}>{count}</span>
      <span className="uppercase tracking-wider text-muted-foreground">{label}</span>
    </div>
  );
}
