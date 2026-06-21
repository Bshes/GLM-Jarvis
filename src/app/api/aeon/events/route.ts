/** GET /api/aeon/events — recent sensory events. POST — inject a sensory observation (biometric/vision/audio/system). */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger, emitEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET() {
  const events = await db.sensoryEvent.findMany({ orderBy: { createdAt: "desc" }, take: 40 });
  return NextResponse.json(
    events.map((e) => ({ ...e, createdAt: e.createdAt.toISOString() })),
  );
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    channel: string;
    metric?: string;
    value: number | string | Record<string, unknown>;
    severity?: string;
  };
  const value = JSON.stringify(
    body.metric ? { metric: body.metric, value: body.value } : { value: body.value },
  );
  const event = await db.sensoryEvent.create({
    data: {
      channel: body.channel,
      value,
      severity: body.severity ?? "info",
    },
  });
  await logger.info("sensory", `Event [${body.channel}]: ${value}`);
  await emitEvent({
    type: "sensory",
    message: `Sensory [${body.channel}]: ${value.slice(0, 90)}`,
    data: { channel: body.channel, metric: body.metric, value: body.value },
  });
  return NextResponse.json({ ...event, createdAt: event.createdAt.toISOString() });
}
