"use client";

/**
 * A.E.O.N. — Memory Graph panel
 *
 * Interactive force-directed visualization of the graph memory (GraphNode +
 * Edge) layered on top of a semantic vector-recall search box (Memory +
 * deterministic embedding). Nodes are colored by `kind`, the "User" node is
 * pinned at the center, and the simulation can be dragged with mouse/touch.
 */
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  Search,
  Plus,
  Network,
  Sparkles,
  X,
  CircleDot,
  Boxes,
  MapPin,
  Calendar,
  Wrench,
  Bot,
  User as UserIcon,
  Loader2,
  Database,
  Link2,
  type LucideIcon,
} from "lucide-react";
import { useAeon } from "@/lib/store";
import type { MemoryView } from "@/lib/aeon";
import { timeAgo } from "@/components/aeon/ui";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MemoryTimeline } from "@/components/aeon/memory-timeline";

// ────────────────────────────────────────────────────────────────────────────
// Kind taxonomy → color + icon. The 7 canonical kinds each get a distinct
// hue drawn from the warm A.E.O.N. palette (no indigo/blue).
// ────────────────────────────────────────────────────────────────────────────
interface KindMeta {
  color: string;
  icon: LucideIcon;
  label: string;
}

const KIND_META: Record<string, KindMeta> = {
  entity: { color: "var(--a_core)", icon: Boxes, label: "Entity" },
  concept: { color: "var(--a_active)", icon: Brain, label: "Concept" },
  person: { color: "var(--a_warn)", icon: UserIcon, label: "Person" },
  place: { color: "var(--a_danger)", icon: MapPin, label: "Place" },
  event: { color: "var(--a_reflect)", icon: Calendar, label: "Event" },
  device: { color: "var(--chart-5)", icon: Wrench, label: "Device" },
  agent: { color: "oklch(0.76 0.15 125)", icon: Bot, label: "Agent" },
};
const KIND_FALLBACK: KindMeta = {
  color: "var(--muted-foreground)",
  icon: CircleDot,
  label: "Node",
};
function kindMeta(kind: string): KindMeta {
  return KIND_META[(kind ?? "").toLowerCase()] ?? KIND_FALLBACK;
}

// ────────────────────────────────────────────────────────────────────────────
// Force simulation — repulsion + spring + centering, integrated with
// requestAnimationFrame and a cooling alpha that settles over ~2s.
// ────────────────────────────────────────────────────────────────────────────
interface SimNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: string;
  label: string;
  pinned: boolean; // User node — locked to center
  fixed: boolean; // currently being dragged
}

const REPULSION = 24000;
const SPRING_K = 0.045;
const REST_LEN = 120;
const CENTER_K = 0.018;
const DAMP = 0.84;
const MAX_VEL = 14;
const ALPHA_DECAY = 1 / 130; // ~2.2s to settle at 60fps

type SideTab = "nodes" | "add" | "recall";

export default function MemoryGraphPanel() {
  const graph = useAeon((s) => s.graph);
  const memoryCount = useAeon((s) => s.memoryCount);
  const refresh = useAeon((s) => s.refresh);

  // Container measurement
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  const sizeRef = React.useRef<{ w: number; h: number }>({ w: 600, h: 400 });
  const [size, setSize] = React.useState<{ w: number; h: number }>({
    w: 600,
    h: 400,
  });

  // Simulation state (mutable refs — no re-render needed for physics)
  const simRef = React.useRef<Map<string, SimNode>>(new Map());
  const graphRef = React.useRef(graph);
  graphRef.current = graph;
  const alphaRef = React.useRef(0);
  const rafRef = React.useRef<number | null>(null);
  const dragRef = React.useRef<{ id: string; moved: boolean } | null>(null);
  const [, forceRender] = React.useReducer((x: number) => x + 1, 0);

  // UI state
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [sideTab, setSideTab] = React.useState<SideTab>("nodes");

  // Vector recall
  const [query, setQuery] = React.useState("");
  const [k, setK] = React.useState(6);
  const [results, setResults] = React.useState<MemoryView[]>([]);
  const [searching, setSearching] = React.useState(false);

  // Add-node form
  const [newLabel, setNewLabel] = React.useState("");
  const [newKind, setNewKind] = React.useState("entity");
  const [newSummary, setNewSummary] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  // ── The physics loop. Reassigned every render so it always closes over the
  // latest props/state. Invoked via loopRef.current() so scheduled rAF
  // callbacks always dispatch to the freshest version. ──
  const loopRef = React.useRef<() => void>(() => {});
  loopRef.current = () => {
    const sim = simRef.current;
    const g = graphRef.current;
    const { w, h } = sizeRef.current;
    const cx = w / 2;
    const cy = h / 2;
    const alpha = alphaRef.current;
    const nodes = Array.from(sim.values());
    const n = nodes.length;

    // Coulomb repulsion between every pair (O(n²) — fine for small graphs)
    for (let i = 0; i < n; i++) {
      const a = nodes[i];
      for (let j = i + 1; j < n; j++) {
        const b = nodes[j];
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let d2 = dx * dx + dy * dy;
        if (d2 < 0.01) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          d2 = 0.25;
        }
        const d = Math.sqrt(d2);
        const f = (REPULSION * alpha) / d2;
        const fx = (dx / d) * f;
        const fy = (dy / d) * f;
        if (!a.fixed && !a.pinned) {
          a.vx += fx;
          a.vy += fy;
        }
        if (!b.fixed && !b.pinned) {
          b.vx -= fx;
          b.vy -= fy;
        }
      }
    }

    // Hooke spring attraction along edges
    for (const e of g.edges) {
      const a = sim.get(e.fromId);
      const b = sim.get(e.toId);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const f = SPRING_K * (d - REST_LEN) * alpha;
      const fx = (dx / d) * f;
      const fy = (dy / d) * f;
      if (!a.fixed && !a.pinned) {
        a.vx += fx;
        a.vy += fy;
      }
      if (!b.fixed && !b.pinned) {
        b.vx -= fx;
        b.vy -= fy;
      }
    }

    // Centering + velocity damping + integration + soft bounds
    for (const node of nodes) {
      if (node.pinned || node.fixed) {
        node.vx = 0;
        node.vy = 0;
        if (node.pinned) {
          node.x = cx;
          node.y = cy;
        }
        continue;
      }
      node.vx += (cx - node.x) * CENTER_K * alpha;
      node.vy += (cy - node.y) * CENTER_K * alpha;
      node.vx *= DAMP;
      node.vy *= DAMP;
      const sp = Math.hypot(node.vx, node.vy);
      if (sp > MAX_VEL) {
        node.vx = (node.vx / sp) * MAX_VEL;
        node.vy = (node.vy / sp) * MAX_VEL;
      }
      node.x += node.vx;
      node.y += node.vy;
      const m = 26;
      if (node.x < m) {
        node.x = m;
        node.vx *= -0.4;
      }
      if (node.x > w - m) {
        node.x = w - m;
        node.vx *= -0.4;
      }
      if (node.y < m) {
        node.y = m;
        node.vy *= -0.4;
      }
      if (node.y > h - m) {
        node.y = h - m;
        node.vy *= -0.4;
      }
    }

    if (alphaRef.current > 0) {
      alphaRef.current = Math.max(0, alphaRef.current - ALPHA_DECAY);
    }

    const moving =
      alphaRef.current > 0 ||
      nodes.some((nd) => Math.hypot(nd.vx, nd.vy) > 0.05);

    forceRender();
    if (moving) {
      rafRef.current = requestAnimationFrame(() => loopRef.current());
    } else {
      rafRef.current = null;
    }
  };

  function startLoop() {
    if (rafRef.current != null) return;
    rafRef.current = requestAnimationFrame(() => loopRef.current());
  }

  // ── Measure container ──
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      const w = Math.max(280, r.width);
      const h = Math.max(220, r.height);
      sizeRef.current = { w, h };
      setSize({ w, h });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Sync sim nodes when graph data changes ──
  React.useEffect(() => {
    const sim = simRef.current;
    const seen = new Set<string>();
    const { w, h } = sizeRef.current;
    const cx = w / 2;
    const cy = h / 2;
    for (const gn of graph.nodes) {
      seen.add(gn.id);
      const isUser = gn.label?.toLowerCase() === "user";
      const existing = sim.get(gn.id);
      if (existing) {
        existing.kind = gn.kind;
        existing.label = gn.label;
        existing.pinned = isUser;
        if (isUser) {
          existing.x = cx;
          existing.y = cy;
          existing.vx = 0;
          existing.vy = 0;
        }
      } else {
        const ang = Math.random() * Math.PI * 2;
        const r = 60 + Math.random() * 90;
        sim.set(gn.id, {
          id: gn.id,
          x: isUser ? cx : cx + Math.cos(ang) * r,
          y: isUser ? cy : cy + Math.sin(ang) * r,
          vx: 0,
          vy: 0,
          kind: gn.kind,
          label: gn.label,
          pinned: isUser,
          fixed: false,
        });
      }
    }
    // Drop removed nodes
    for (const id of Array.from(sim.keys())) {
      if (!seen.has(id)) sim.delete(id);
    }
    alphaRef.current = 1;
    startLoop();
  }, [graph]);

  // ── Re-center pinned nodes when the canvas resizes ──
  React.useEffect(() => {
    const sim = simRef.current;
    for (const nd of sim.values()) {
      if (nd.pinned) {
        nd.x = size.w / 2;
        nd.y = size.h / 2;
      }
    }
    alphaRef.current = Math.max(alphaRef.current, 0.5);
    startLoop();
  }, [size]);

  // ── Cleanup on unmount ──
  React.useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // ── Pointer / drag handlers ──
  function toSvgCoords(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const sx = (clientX - rect.left) * (sizeRef.current.w / rect.width);
    const sy = (clientY - rect.top) * (sizeRef.current.h / rect.height);
    return { x: sx, y: sy };
  }

  function onNodePointerDown(e: React.PointerEvent, id: string) {
    e.stopPropagation();
    const nd = simRef.current.get(id);
    if (!nd) return;
    nd.fixed = true;
    dragRef.current = { id, moved: false };
    svgRef.current?.setPointerCapture(e.pointerId);
    setSelectedId(id);
    alphaRef.current = Math.max(alphaRef.current, 0.4);
    startLoop();
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const nd = simRef.current.get(dragRef.current.id);
    if (!nd) return;
    const p = toSvgCoords(e.clientX, e.clientY);
    nd.x = p.x;
    nd.y = p.y;
    nd.vx = 0;
    nd.vy = 0;
    dragRef.current.moved = true;
    forceRender();
  }

  function onPointerUp(e: React.PointerEvent) {
    if (dragRef.current) {
      const nd = simRef.current.get(dragRef.current.id);
      if (nd) nd.fixed = false;
      try {
        svgRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        /* pointerId may already be released */
      }
      dragRef.current = null;
      alphaRef.current = Math.max(alphaRef.current, 0.5);
      startLoop();
    }
  }

  // ── Add node ──
  async function handleAddNode() {
    const label = newLabel.trim();
    if (!label) return;
    setAdding(true);
    try {
      await fetch("/api/aeon/memory", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "node",
          label,
          nodeKind: newKind,
          summary: newSummary.trim() || undefined,
        }),
      });
      setNewLabel("");
      setNewSummary("");
      await refresh();
    } finally {
      setAdding(false);
    }
  }

  // ── Vector recall ──
  async function handleSearch() {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch("/api/aeon/memory/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query: q, k }),
      });
      const data = (await res.json()) as { results: MemoryView[] };
      setResults(data.results);
    } finally {
      setSearching(false);
    }
  }

  // ── Derived render data ──
  const sim = simRef.current;
  const nodes = Array.from(sim.values());
  const selectedNode = graph.nodes.find((nd) => nd.id === selectedId) ?? null;

  const neighborIds = React.useMemo(() => {
    if (!selectedId) return new Set<string>();
    const set = new Set<string>([selectedId]);
    for (const e of graph.edges) {
      if (e.fromId === selectedId) set.add(e.toId);
      if (e.toId === selectedId) set.add(e.fromId);
    }
    return set;
  }, [selectedId, graph.edges]);

  const selectedEdges = React.useMemo(
    () =>
      selectedNode
        ? graph.edges.filter(
            (e) => e.fromId === selectedNode.id || e.toId === selectedNode.id,
          )
        : [],
    [graph.edges, selectedNode],
  );

  return (
    <div className="flex h-full w-full min-h-0 flex-col gap-3">
      {/* ── Header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative grid place-items-center">
            <Network className="h-5 w-5 text-[color:var(--a_core)]" />
            <span
              className="pointer-events-none absolute inset-0 text-[color:var(--a_core)] opacity-40 blur-md"
              aria-hidden
            >
              <Network className="h-5 w-5" />
            </span>
          </div>
          <div>
            <h2 className="aeon-text-glow font-mono text-sm font-bold tracking-[0.22em] text-foreground">
              MEMORY · GRAPH
            </h2>
            <p className="text-[11px] text-muted-foreground">
              Knowledge graph + vector recall
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <StatChip
            icon={Boxes}
            label="NODES"
            value={graph.nodes.length}
            color="var(--a_core)"
          />
          <StatChip
            icon={Link2}
            label="EDGES"
            value={graph.edges.length}
            color="var(--a_active)"
          />
          <StatChip
            icon={Database}
            label="VECTORS"
            value={memoryCount}
            color="var(--a_warn)"
          />
        </div>
      </div>

      {/* ── Main: graph + side panel ── */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
        {/* Graph canvas */}
        <Card className="aeon-grid-bg relative min-h-[300px] flex-1 overflow-hidden p-0">
          <div className="aeon-radial-bg pointer-events-none absolute inset-0" />
          <div className="aeon-scanline pointer-events-none absolute inset-0 opacity-40" />
          <div ref={containerRef} className="absolute inset-0">
            {nodes.length === 0 ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
                <Network className="h-8 w-8 text-muted-foreground/40" />
                <p className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
                  Graph memory empty
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Add a node from the side panel to seed the lattice.
                </p>
              </div>
            ) : (
              <svg
                ref={svgRef}
                width={size.w}
                height={size.h}
                viewBox={`0 0 ${size.w} ${size.h}`}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
                onPointerCancel={onPointerUp}
                className="absolute inset-0 touch-none select-none"
                style={{ cursor: dragRef.current ? "grabbing" : "default" }}
              >
                {/* Edges */}
                <g>
                  {graph.edges.map((e) => {
                    const a = sim.get(e.fromId);
                    const b = sim.get(e.toId);
                    if (!a || !b) return null;
                    const hi =
                      selectedId &&
                      (e.fromId === selectedId || e.toId === selectedId);
                    const mx = (a.x + b.x) / 2;
                    const my = (a.y + b.y) / 2;
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const len = Math.hypot(dx, dy) || 1;
                    // offset label slightly off the line for legibility
                    const nx = -dy / len;
                    const ny = dx / len;
                    return (
                      <g key={e.id}>
                        <line
                          x1={a.x}
                          y1={a.y}
                          x2={b.x}
                          y2={b.y}
                          stroke={
                            hi
                              ? "var(--a_core)"
                              : "oklch(0.62 0.04 75 / 0.42)"
                          }
                          strokeWidth={hi ? 2 : 1}
                          strokeDasharray={hi ? "0" : "4 5"}
                          style={
                            hi
                              ? {
                                  filter:
                                    "drop-shadow(0 0 4px oklch(0.82 0.15 75 / 0.7))",
                                }
                              : undefined
                          }
                        />
                        <text
                          x={mx + nx * 8}
                          y={my + ny * 8}
                          textAnchor="middle"
                          dominantBaseline="middle"
                          fontSize={9}
                          className="font-mono"
                          fill={
                            hi
                              ? "var(--a_core)"
                              : "oklch(0.62 0.03 75 / 0.7)"
                          }
                          style={{
                            pointerEvents: "none",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            fontWeight: hi ? 600 : 400,
                          }}
                        >
                          {e.relation}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* Nodes */}
                <g>
                  {nodes.map((nd) => {
                    const meta = kindMeta(nd.kind);
                    const isSel = selectedId === nd.id;
                    const isNeighbor =
                      neighborIds.has(nd.id) && !isSel;
                    const dim = selectedId && !isSel && !isNeighbor;
                    const r = nd.pinned ? 12 : nd.kind === "agent" ? 10 : 8;
                    return (
                      <g
                        key={nd.id}
                        onPointerDown={(e) => onNodePointerDown(e, nd.id)}
                        style={{
                          cursor: "pointer",
                          opacity: dim ? 0.32 : 1,
                          transition: "opacity 0.2s ease",
                        }}
                      >
                        {/* outer halo */}
                        <circle
                          cx={nd.x}
                          cy={nd.y}
                          r={r * 2.4}
                          fill={meta.color}
                          opacity={isSel ? 0.34 : 0.13}
                          style={{ pointerEvents: "none" }}
                        />
                        <circle
                          cx={nd.x}
                          cy={nd.y}
                          r={r * 1.6}
                          fill={meta.color}
                          opacity={isSel ? 0.5 : 0.24}
                          style={{ pointerEvents: "none" }}
                        />
                        {/* core */}
                        <circle
                          cx={nd.x}
                          cy={nd.y}
                          r={r}
                          fill={meta.color}
                          stroke={
                            isSel
                              ? "oklch(0.96 0.008 80)"
                              : "oklch(1 0 0 / 0.32)"
                          }
                          strokeWidth={isSel ? 2 : 1}
                        />
                        {/* pinned ring */}
                        {nd.pinned && (
                          <circle
                            cx={nd.x}
                            cy={nd.y}
                            r={r + 5}
                            fill="none"
                            stroke={meta.color}
                            strokeWidth={1}
                            strokeDasharray="2 3"
                            className="animate-aeon-spin-slow"
                            style={{
                              transformBox: "fill-box",
                              transformOrigin: "center",
                              opacity: 0.7,
                            }}
                          />
                        )}
                        {/* label */}
                        <text
                          x={nd.x}
                          y={nd.y + r + 13}
                          textAnchor="middle"
                          fontSize={11}
                          className="font-mono"
                          fill={
                            isSel
                              ? "oklch(0.96 0.008 80)"
                              : "oklch(0.78 0.02 75)"
                          }
                          style={{
                            pointerEvents: "none",
                            fontWeight: isSel ? 700 : 500,
                            letterSpacing: "0.04em",
                          }}
                        >
                          {nd.label}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            )}
          </div>

          {/* Legend */}
          <div className="pointer-events-none absolute bottom-2 left-2 right-2 flex flex-wrap gap-1.5">
            {Object.entries(KIND_META).map(([key, m]) => (
              <div
                key={key}
                className="flex items-center gap-1.5 rounded-sm border border-border/50 bg-background/70 px-1.5 py-0.5 backdrop-blur-sm"
              >
                <span
                  className="h-2 w-2 rounded-full"
                  style={{
                    background: m.color,
                    boxShadow: `0 0 6px ${m.color}`,
                  }}
                />
                <span className="font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </span>
              </div>
            ))}
          </div>

          {/* HUD corner annotations */}
          <div className="pointer-events-none absolute left-2 top-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">
            ◇ FORCE-DIRECTED LATTICE
          </div>
          <div className="pointer-events-none absolute right-2 top-2 font-mono text-[9px] uppercase tracking-[0.2em] text-muted-foreground/70">
            α={alphaRef.current.toFixed(2)}
          </div>
        </Card>

        {/* Side panel */}
        <Card className="flex min-h-[260px] flex-col p-0 lg:min-h-0 lg:w-[368px]">
          {/* Tab bar */}
          <div className="flex border-b border-border/50">
            {(
              [
                { id: "nodes" as const, label: "Nodes", icon: Boxes },
                { id: "add" as const, label: "Add", icon: Plus },
                { id: "recall" as const, label: "Recall", icon: Search },
              ]
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setSideTab(t.id)}
                className={`relative flex flex-1 items-center justify-center gap-1.5 px-2 py-2.5 font-mono text-[10px] uppercase tracking-[0.18em] transition-colors ${
                  sideTab === t.id
                    ? "text-[color:var(--a_core)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
                {sideTab === t.id && (
                  <motion.span
                    layoutId="memtab-underline"
                    className="absolute bottom-0 left-2 right-2 h-[2px] bg-[color:var(--a_core)]"
                    style={{ boxShadow: "0 0 8px var(--a_core)" }}
                  />
                )}
              </button>
            ))}
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <AnimatePresence mode="wait">
              {/* ── Nodes tab ── */}
              {sideTab === "nodes" && (
                <motion.div
                  key="nodes"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.16 }}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div className="aeon-scroll max-h-64 flex-1 overflow-y-auto p-2 lg:max-h-none">
                    <div className="space-y-1">
                      {graph.nodes.length === 0 && (
                        <div className="py-8 text-center font-mono text-xs text-muted-foreground">
                          empty graph
                        </div>
                      )}
                      {graph.nodes.map((gn) => {
                        const meta = kindMeta(gn.kind);
                        const Icon = meta.icon;
                        const isSel = selectedId === gn.id;
                        return (
                          <button
                            key={gn.id}
                            onClick={() =>
                              setSelectedId(isSel ? null : gn.id)
                            }
                            className={`flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors ${
                              isSel
                                ? "border-border bg-accent/60"
                                : "border-transparent hover:bg-accent/30"
                            }`}
                          >
                            <span
                              className="grid h-6 w-6 shrink-0 place-items-center rounded-sm"
                              style={{
                                background: `color-mix(in oklch, ${meta.color} 16%, transparent)`,
                                boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${meta.color} 35%, transparent)`,
                              }}
                            >
                              <Icon
                                className="h-3.5 w-3.5"
                                style={{ color: meta.color }}
                              />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span className="truncate font-mono text-xs text-foreground">
                                  {gn.label}
                                </span>
                                {gn.label?.toLowerCase() === "user" && (
                                  <Badge
                                    variant="outline"
                                    className="h-4 px-1 text-[8px] text-[color:var(--a_core)]"
                                  >
                                    PIN
                                  </Badge>
                                )}
                              </div>
                              <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                {meta.label}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Selected node detail */}
                  <AnimatePresence>
                    {selectedNode && (
                      <motion.div
                        key="detail"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden border-t border-border/50"
                      >
                        <div className="bg-card/50 p-3">
                          <div className="mb-1.5 flex items-start justify-between gap-2">
                            <div className="font-mono text-sm font-bold text-foreground">
                              {selectedNode.label}
                            </div>
                            <button
                              onClick={() => setSelectedId(null)}
                              className="text-muted-foreground transition-colors hover:text-foreground"
                              aria-label="Deselect node"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <Badge
                            variant="outline"
                            className="mb-2 text-[9px]"
                            style={{
                              color: kindMeta(selectedNode.kind).color,
                              borderColor: `color-mix(in oklch, ${kindMeta(selectedNode.kind).color} 35%, transparent)`,
                            }}
                          >
                            {kindMeta(selectedNode.kind).label.toUpperCase()}
                          </Badge>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {selectedNode.summary ?? (
                              <span className="italic opacity-60">
                                no summary recorded
                              </span>
                            )}
                          </p>

                          <div className="mt-2.5 space-y-1">
                            <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                              Relations · {selectedEdges.length}
                            </div>
                            <div className="space-y-1">
                              {selectedEdges.map((e) => {
                                const otherId =
                                  e.fromId === selectedNode.id
                                    ? e.toId
                                    : e.fromId;
                                const other = graph.nodes.find(
                                  (nd) => nd.id === otherId,
                                );
                                const dir =
                                  e.fromId === selectedNode.id ? "→" : "←";
                                return (
                                  <div
                                    key={e.id}
                                    className="flex items-center gap-1.5 font-mono text-[11px]"
                                  >
                                    <span className="text-muted-foreground">
                                      {dir}
                                    </span>
                                    <span className="text-[color:var(--a_core)]">
                                      {e.relation}
                                    </span>
                                    <span className="text-muted-foreground">
                                      →
                                    </span>
                                    <button
                                      onClick={() => setSelectedId(otherId)}
                                      className="truncate text-foreground transition-colors hover:text-[color:var(--a_active)]"
                                    >
                                      {other?.label ?? otherId.slice(0, 6)}
                                    </button>
                                  </div>
                                );
                              })}
                              {selectedEdges.length === 0 && (
                                <div className="text-[10px] italic text-muted-foreground">
                                  no relations
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* ── Add tab ── */}
              {sideTab === "add" && (
                <motion.div
                  key="add"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.16 }}
                  className="aeon-scroll flex-1 space-y-3 overflow-y-auto p-3"
                >
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Label
                    </label>
                    <Input
                      value={newLabel}
                      onChange={(e) => setNewLabel(e.target.value)}
                      placeholder="e.g. Project Aurora"
                      className="mt-1 h-9 font-mono text-sm"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && newLabel.trim())
                          handleAddNode();
                      }}
                    />
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Kind
                    </label>
                    <Select value={newKind} onValueChange={setNewKind}>
                      <SelectTrigger className="mt-1 w-full font-mono text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(KIND_META).map(([key, m]) => (
                          <SelectItem
                            key={key}
                            value={key}
                            className="font-mono text-xs"
                          >
                            <span className="flex items-center gap-2">
                              <span
                                className="h-2 w-2 rounded-full"
                                style={{
                                  background: m.color,
                                  boxShadow: `0 0 4px ${m.color}`,
                                }}
                              />
                              {m.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      Summary
                    </label>
                    <Input
                      value={newSummary}
                      onChange={(e) => setNewSummary(e.target.value)}
                      placeholder="optional context"
                      className="mt-1 h-9 font-mono text-sm"
                    />
                  </div>
                  <Button
                    onClick={handleAddNode}
                    disabled={adding || !newLabel.trim()}
                    className="w-full font-mono text-xs tracking-widest"
                    style={{
                      background: "var(--a_core)",
                      color: "var(--background)",
                    }}
                  >
                    {adding ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    {adding ? "Committing…" : "Commit Node"}
                  </Button>
                  <div className="border-t border-border/40 pt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                    New nodes spawn near the core. The lattice reheats and
                    rebalances automatically.
                  </div>
                </motion.div>
              )}

              {/* ── Recall tab ── */}
              {sideTab === "recall" && (
                <motion.div
                  key="recall"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 8 }}
                  transition={{ duration: 0.16 }}
                  className="flex min-h-0 flex-1 flex-col"
                >
                  <div className="space-y-2 border-b border-border/40 p-3">
                    <label className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                      <Sparkles className="h-3 w-3 text-[color:var(--a_active)]" />
                      Semantic Recall
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSearch();
                        }}
                        placeholder="query memory vectors…"
                        className="h-9 flex-1 font-mono text-xs"
                      />
                      <Select
                        value={String(k)}
                        onValueChange={(v) => setK(Number(v))}
                      >
                        <SelectTrigger className="h-9 w-[68px] px-2 font-mono text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[3, 6, 10, 15].map((n) => (
                            <SelectItem
                              key={n}
                              value={String(n)}
                              className="font-mono text-xs"
                            >
                              k={n}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleSearch}
                      disabled={searching || !query.trim()}
                      className="w-full font-mono text-xs tracking-widest"
                      style={{
                        background: "var(--a_active)",
                        color: "var(--background)",
                      }}
                    >
                      {searching ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                      {searching ? "Embedding…" : "Recall"}
                    </Button>
                  </div>
                  <div className="aeon-scroll min-h-0 flex-1 overflow-y-auto p-2">
                    <div className="space-y-2">
                      {results.length === 0 && !searching && (
                        <div className="py-8 text-center font-mono text-xs text-muted-foreground">
                          {query
                            ? "run recall to surface matches"
                            : "vector store ready"}
                        </div>
                      )}
                      {searching &&
                        results.length === 0 && (
                          <div className="py-8 text-center font-mono text-xs text-muted-foreground">
                            embedding query…
                          </div>
                        )}
                      {results.map((r) => (
                        <RecallResult key={r.id} mem={r} />
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </Card>
      </div>

      {/* Memory Timeline — temporal view of memory creation */}
      <MemoryTimeline />
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Sub-components
// ────────────────────────────────────────────────────────────────────────────

function StatChip({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: LucideIcon;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-md border border-border/50 bg-card/60 px-2 py-1.5"
      style={{
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 12%, transparent)`,
      }}
    >
      <Icon className="h-3 w-3" style={{ color }} />
      <div className="flex flex-col leading-none">
        <span className="font-mono text-[8px] uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
        <span
          className="font-mono text-sm font-bold tabular-nums"
          style={{ color }}
        >
          {value}
        </span>
      </div>
    </div>
  );
}

function RecallResult({ mem }: { mem: MemoryView }) {
  const score = Math.max(0, Math.min(1, mem.score ?? 0));
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="rounded-md border border-border/50 bg-card/40 p-2.5"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <Badge
            variant="outline"
            className="h-4 px-1 font-mono text-[8px] uppercase"
            style={{
              color: "var(--a_active)",
              borderColor:
                "color-mix(in oklch, var(--a_active) 30%, transparent)",
            }}
          >
            {mem.kind}
          </Badge>
          {mem.source && (
            <span className="font-mono text-[9px] text-muted-foreground">
              {mem.source}
            </span>
          )}
        </div>
        <span className="font-mono text-[9px] text-muted-foreground">
          {timeAgo(mem.createdAt)} ago
        </span>
      </div>
      <p className="mb-2 text-xs leading-relaxed text-foreground">
        {mem.content}
      </p>
      {/* Relevance bar */}
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-border/50">
          <div
            className="h-full rounded-full"
            style={{
              width: `${score * 100}%`,
              background:
                "linear-gradient(90deg, var(--a_active), var(--a_core))",
              boxShadow: "0 0 6px var(--a_active)",
            }}
          />
        </div>
        <span
          className="font-mono text-[9px] tabular-nums"
          style={{ color: "var(--a_active)" }}
        >
          {(score * 100).toFixed(0)}%
        </span>
      </div>
      {mem.tags && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {mem.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .map((t, i) => (
              <span
                key={i}
                className="rounded-sm bg-muted/50 px-1 py-0.5 font-mono text-[8px] text-muted-foreground"
              >
                #{t}
              </span>
            ))}
        </div>
      )}
    </motion.div>
  );
}
