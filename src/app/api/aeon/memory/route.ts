/**
 * GET /api/aeon/memory — graph nodes/edges + recent memories.
 * POST — add a graph node, an edge, or a memory (with embedding).
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { embed, serialize } from "@/lib/embed";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const [nodes, edges, memories] = await Promise.all([
    db.graphNode.findMany(),
    db.edge.findMany(),
    db.memory.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  return NextResponse.json({
    nodes,
    edges,
    memories: memories.map((m) => ({ ...m, createdAt: m.createdAt.toISOString() })),
  });
}

export async function POST(req: Request) {
  const body = (await req.json()) as
    | { kind: "node"; label: string; nodeKind: string; summary?: string }
    | { kind: "edge"; fromId: string; toId: string; relation: string }
    | { kind: "memory"; content: string; memKind: string; tags?: string; source?: string; importance?: number };

  if (body.kind === "node") {
    const node = await db.graphNode.create({
      data: { label: body.label, kind: body.nodeKind, summary: body.summary ?? null },
    });
    await logger.info("memory", `Graph node created: ${body.label} (${body.nodeKind})`);
    return NextResponse.json(node);
  }

  if (body.kind === "edge") {
    const edge = await db.edge.create({
      data: { fromId: body.fromId, toId: body.toId, relation: body.relation, weight: 1 },
    });
    await logger.info("memory", `Edge created: ${body.relation}`);
    return NextResponse.json(edge);
  }

  // memory
  const content = body.content.trim();
  const memory = await db.memory.create({
    data: {
      content,
      kind: body.memKind,
      tags: body.tags ?? null,
      source: body.source ?? "user",
      importance: body.importance ?? 0.5,
      embedding: serialize(embed(content)),
    },
  });
  await logger.info("memory", `Memory stored (${body.memKind}): ${content.slice(0, 60)}`);
  return NextResponse.json({ ...memory, createdAt: memory.createdAt.toISOString() });
}
