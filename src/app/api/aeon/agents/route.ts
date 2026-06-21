/** GET /api/aeon/agents — list sub-agents. PATCH — update agent status. */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger, emitEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const agents = await db.agent.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(
    agents.map((a) => ({ ...a, lastActive: a.lastActive?.toISOString() ?? null })),
  );
}

export async function PATCH(req: Request) {
  const { name, status } = (await req.json()) as { name: string; status: string };
  const agent = await db.agent.update({
    where: { name },
    data: { status },
  });
  await logger.info(`agent:${name}`, `status → ${status}`);
  await emitEvent({ type: "agent", message: `${name} status → ${status}`, data: { agent: name, status } });
  return NextResponse.json({ ok: true, agent });
}
