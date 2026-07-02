/** GET /api/aeon/iot — list devices. PATCH — update a device's state. */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger, emitEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const devices = await db.device.findMany({ orderBy: [{ room: "asc" }, { name: "asc" }] });
  return NextResponse.json(devices);
}

export async function PATCH(req: Request) {
  const { id, state, online } = (await req.json()) as {
    id: string;
    state?: Record<string, unknown>;
    online?: boolean;
  };
  const device = await db.device.findUnique({ where: { id } });
  if (!device) return NextResponse.json({ error: "not found" }, { status: 404 });

  const current = JSON.parse(device.state || "{}");
  const next = state ? { ...current, ...state } : current;
  const updated = await db.device.update({
    where: { id },
    data: { state: JSON.stringify(next), online: online ?? device.online },
  });

  await logger.info("agent:IoT", `Device ${updated.name} updated → ${JSON.stringify(next)}`);
  await emitEvent({
    type: "action",
    message: `IoT: ${updated.name} → ${JSON.stringify(next)}`,
    data: { device: updated.name, state: next },
  });
  return NextResponse.json(updated);
}
