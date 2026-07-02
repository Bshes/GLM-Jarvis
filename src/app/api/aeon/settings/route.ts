/**
 * GET /api/aeon/settings — read all settings as a key→value map.
 * PATCH /api/aeon/settings — upsert one or more settings { key: value, ... }.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const DEFAULTS: Record<string, string> = {
  routingThreshold: "0.5",
  thinkingThreshold: "0.66",
  triggerCooldown: "30",
  maxStreamEvents: "160",
  autoEvaluateTriggers: "true",
};

export async function GET() {
  const rows = await db.setting.findMany();
  const map: Record<string, string> = { ...DEFAULTS };
  for (const r of rows) map[r.key] = r.value;
  return NextResponse.json(map);
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as Record<string, string>;
  for (const [key, value] of Object.entries(body)) {
    const existing = await db.setting.findUnique({ where: { key } });
    if (existing) {
      await db.setting.update({ where: { key }, data: { value } });
    } else {
      await db.setting.create({ data: { key, value } });
    }
  }
  return NextResponse.json({ ok: true });
}
