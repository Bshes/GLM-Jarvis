/** GET /api/aeon/actions — list actions. POST — manually create an action. */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger, emitEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const take = Math.min(200, Number(url.searchParams.get("take") ?? 60));
  const actions = await db.action.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take,
  });
  return NextResponse.json(
    actions.map((a) => ({ ...a, createdAt: a.createdAt.toISOString(), resolvedAt: a.resolvedAt?.toISOString() ?? null })),
  );
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    title: string;
    description?: string;
    agentName: string;
    tier: 1 | 2 | 3;
    payload?: unknown;
  };
  const action = await db.action.create({
    data: {
      title: body.title,
      description: body.description ?? null,
      agentName: body.agentName,
      tier: body.tier,
      status: "pending",
      payload: body.payload ? JSON.stringify(body.payload) : null,
    },
  });
  await logger.info(`agent:${body.agentName}`, `Action queued: ${body.title} [T${body.tier}]`);
  await emitEvent({ type: "action", message: `[T${body.tier}] ${body.agentName}: ${body.title} → pending`, data: { id: action.id, status: "pending" } });
  return NextResponse.json({ ...action, createdAt: action.createdAt.toISOString(), resolvedAt: null });
}
