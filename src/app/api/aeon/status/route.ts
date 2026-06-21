/** GET /api/aeon/status — full system snapshot for initial UI load. */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [agents, actions, logs, devices, triggers, nodes, edges, memories, events, pendingActions] =
    await Promise.all([
      db.agent.findMany({ orderBy: { name: "asc" } }),
      db.action.findMany({ orderBy: { createdAt: "desc" }, take: 40 }),
      db.logEntry.findMany({ orderBy: { createdAt: "desc" }, take: 60 }),
      db.device.findMany({ orderBy: [{ room: "asc" }, { name: "asc" }] }),
      db.trigger.findMany({ orderBy: { createdAt: "asc" } }),
      db.graphNode.findMany(),
      db.edge.findMany(),
      db.memory.count(),
      db.sensoryEvent.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
      db.action.count({ where: { status: "pending" } }),
    ]);

  return NextResponse.json({
    agents,
    actions: actions.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), resolvedAt: a.resolvedAt?.toISOString() ?? null })),
    logs: logs.map((l) => ({ ...l, createdAt: l.createdAt.toISOString() })),
    devices,
    triggers: triggers.map((t) => ({ ...t, lastFired: t.lastFired?.toISOString() ?? null })),
    graph: { nodes, edges },
    memoryCount: memories,
    events: events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
    pendingActions,
    ts: Date.now(),
  });
}
