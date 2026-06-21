"use client";
/**
 * A.E.O.N. shared UI primitives — phase pills, tier badges, agent icons,
 * relative time. Used across all panels for a consistent HUD vocabulary.
 */
import {
  Code2, Globe, House, Wallet, Brain, Cpu, Activity, Radar,
  type LucideIcon,
} from "lucide-react";
import type { LoopPhase, SafetyTier } from "@/lib/aeon";
import { PHASE_META, TIER_META } from "@/lib/aeon";

const AGENT_ICONS: Record<string, LucideIcon> = {
  Coder: Code2,
  Researcher: Globe,
  IoT: House,
  Financial: Wallet,
};

export function agentIcon(name: string): LucideIcon {
  return AGENT_ICONS[name] ?? Cpu;
}

/** Static component wrapper for dynamic agent icons (satisfies static-components rule). */
export function AgentGlyph({
  name,
  className,
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const Icon = AGENT_ICONS[name] ?? Cpu;
  return <Icon className={className} style={style} />;
}

export function PhasePill({ phase, active }: { phase: LoopPhase; active?: boolean }) {
  const meta = PHASE_META[phase];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 font-mono text-[10px] font-semibold tracking-widest uppercase transition-all"
      style={{
        color: meta.color,
        background: `color-mix(in oklch, ${meta.color} 14%, transparent)`,
        boxShadow: active
          ? `0 0 0 1px color-mix(in oklch, ${meta.color} 60%, transparent), 0 0 12px color-mix(in oklch, ${meta.color} 40%, transparent)`
          : "none",
      }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ background: meta.color, opacity: active ? 1 : 0.5 }}
      />
      {phase}
    </span>
  );
}

export function TierBadge({ tier, className }: { tier: SafetyTier; className?: string }) {
  const meta = TIER_META[tier];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${className ?? ""}`}
      style={{
        color: meta.color,
        background: `color-mix(in oklch, ${meta.color} 16%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${meta.color} 35%, transparent)`,
      }}
    >
      T{tier} · {meta.name.toUpperCase()}
    </span>
  );
}

export function StatusDot({ status }: { status: string }) {
  const map: Record<string, string> = {
    idle: "var(--muted-foreground)",
    busy: "var(--a_warn)",
    awaiting: "var(--a_core)",
    error: "var(--a_danger)",
    offline: "var(--muted-foreground)",
    online: "var(--a_active)",
    executed: "var(--a_active)",
    pending: "var(--a_warn)",
    approved: "var(--a_active)",
    denied: "var(--a_danger)",
    advisory: "var(--a_danger)",
    failed: "var(--a_danger)",
  };
  const color = map[status] ?? "var(--muted-foreground)";
  const pulse = status === "busy" || status === "pending" || status === "awaiting";
  return (
    <span className="relative inline-flex h-2 w-2">
      {pulse && (
        <span
          className="absolute inline-flex h-full w-full rounded-full opacity-60"
          style={{ background: color, animation: "aeon-pulse 1.6s ease-in-out infinite" }}
        />
      )}
      <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: color }} />
    </span>
  );
}

export function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Date.now() - d;
  if (diff < 5000) return "now";
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
  return `${Math.floor(diff / 86400000)}d`;
}

export function clockString(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour12: false });
}
