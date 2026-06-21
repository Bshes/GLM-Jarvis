"use client";
/**
 * SystemHealth — compact real-time health indicator for the header.
 *
 * Shows connection quality (events/sec), uptime, and a pulsing status dot.
 * Collapses to just the dot on mobile.
 */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Activity, Wifi } from "lucide-react";
import { useAeon } from "@/lib/store";

export function SystemHealth() {
  const connected = useAeon((s) => s.connected);
  const stream = useAeon((s) => s.stream);
  const [eventsPerMin, setEventsPerMin] = useState(0);
  const [uptime, setUptime] = useState(0);

  // Track uptime (session-based, resets on page reload).
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => {
      setUptime(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // Compute events per minute from the last 60s of stream events.
  useEffect(() => {
    const t = setInterval(() => {
      const now = Date.now();
      const recent = stream.filter((e) => now - e.ts < 60_000);
      setEventsPerMin(recent.length);
    }, 2000);
    return () => clearInterval(t);
  }, [stream]);

  const healthColor = !connected
    ? "var(--a_danger)"
    : eventsPerMin > 20
      ? "var(--a_warn)"
      : "var(--a_active)";

  const healthLabel = !connected ? "OFFLINE" : eventsPerMin > 20 ? "BUSY" : "NOMINAL";

  const formatUptime = (s: number) => {
    if (s < 60) return `${s}s`;
    if (s < 3600) return `${Math.floor(s / 60)}m`;
    return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  };

  return (
    <div
      className="hidden items-center gap-2 rounded-md border border-border/60 bg-background/40 px-2 py-1 lg:flex"
      title={`System ${healthLabel.toLowerCase()} · ${eventsPerMin} events/min · uptime ${formatUptime(uptime)}`}
    >
      {/* Pulsing health dot */}
      <div className="relative flex h-2.5 w-2.5 items-center justify-center">
        <motion.span
          className="absolute h-full w-full rounded-full"
          style={{ background: healthColor }}
          animate={{ scale: [1, 1.6, 1], opacity: [0.7, 0, 0.7] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="relative h-1.5 w-1.5 rounded-full" style={{ background: healthColor }} />
      </div>

      {/* Status label */}
      <span className="font-mono text-[10px] font-bold uppercase tracking-widest" style={{ color: healthColor }}>
        {healthLabel}
      </span>

      {/* Events/min */}
      <div className="flex items-center gap-1 border-l border-border/40 pl-2">
        <Activity className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono text-[10px] text-muted-foreground">
          <span className="font-bold text-foreground/80">{eventsPerMin}</span>/min
        </span>
      </div>

      {/* Uptime */}
      <div className="flex items-center gap-1 border-l border-border/40 pl-2">
        <Wifi className="h-3 w-3 text-muted-foreground" />
        <span className="font-mono text-[10px] text-muted-foreground">{formatUptime(uptime)}</span>
      </div>
    </div>
  );
}
