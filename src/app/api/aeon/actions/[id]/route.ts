/**
 * PATCH /api/aeon/actions/[id] — resolve a tier-2 action (confirm/deny) or
 * re-execute. The human-in-the-loop gate for the Confirmative safety tier.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger, emitEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = (await req.json()) as { decision: "approved" | "denied" | "reexecute" };

  const action = await db.action.findUnique({ where: { id } });
  if (!action) return NextResponse.json({ error: "not found" }, { status: 404 });

  let status = action.status;
  let result = action.result;

  if (body.decision === "approved") {
    status = "executed";
    // For IoT payloads, actually apply the device change on approval.
    if (action.agentName === "IoT" && action.payload) {
      try {
        const payload = JSON.parse(action.payload) as { device?: string; state?: Record<string, unknown> };
        const deviceName = String(payload.device ?? "");
        const state = payload.state ?? {};
        if (deviceName) {
          const device = await db.device.findFirst({ where: { name: { contains: deviceName } } });
          if (device) {
            const current = JSON.parse(device.state || "{}");
            const next = { ...current, ...state };
            await db.device.update({ where: { id: device.id }, data: { state: JSON.stringify(next) } });
            result = `${device.name} → ${JSON.stringify(next)}`;
          }
        }
      } catch {
        result = "approved (payload parse failed)";
      }
    } else {
      result = "approved & executed";
    }
    await db.agent.update({
      where: { name: action.agentName },
      data: { tasksDone: { increment: 1 }, lastActive: new Date(), status: "idle" },
    });
  } else if (body.decision === "denied") {
    status = "denied";
    result = "denied by operator";
  } else if (body.decision === "reexecute") {
    status = "executed";
    result = "re-executed";
  }

  const updated = await db.action.update({
    where: { id },
    data: { status, result, resolvedAt: new Date() },
  });

  await logger.info(`agent:${action.agentName}`, `Action ${body.decision}: ${action.title} → ${status}`);
  await emitEvent({
    type: "action",
    message: `[T${action.tier}] ${action.agentName}: ${action.title} → ${status}`,
    data: { id, status, decision: body.decision },
  });

  return NextResponse.json({ ...updated, createdAt: updated.createdAt.toISOString(), resolvedAt: updated.resolvedAt?.toISOString() ?? null });
}
