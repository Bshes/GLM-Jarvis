/** GET /api/aeon/triggers — list triggers. POST — create. PATCH — update/toggle. DELETE — remove. */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger, emitEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const triggers = await db.trigger.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(
    triggers.map((t) => ({ ...t, lastFired: t.lastFired?.toISOString() ?? null })),
  );
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    name: string;
    channel: string;
    metric: string;
    operator: string;
    threshold: string;
    agentName: string;
    action: string;
    tier: 1 | 2 | 3;
  };
  const trigger = await db.trigger.create({
    data: { ...body, enabled: true },
  });
  await logger.info("orchestrator", `Trigger created: ${body.name} (${body.channel}/${body.metric})`);
  await emitEvent({ type: "trigger", message: `Trigger armed: ${body.name}`, data: { id: trigger.id, name: body.name } });
  return NextResponse.json({ ...trigger, lastFired: null });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as { id: string; enabled?: boolean; name?: string; action?: string };
  const { id, ...rest } = body;
  const updated = await db.trigger.update({ where: { id }, data: rest });
  await logger.info("orchestrator", `Trigger ${updated.name} ${updated.enabled ? "armed" : "disarmed"}`);
  return NextResponse.json({ ...updated, lastFired: updated.lastFired?.toISOString() ?? null });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await db.trigger.delete({ where: { id } });
  await logger.info("orchestrator", `Trigger ${id} deleted`);
  return NextResponse.json({ ok: true });
}
