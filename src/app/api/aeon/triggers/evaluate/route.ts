/**
 * GET /api/aeon/triggers/evaluate — anticipatory engine.
 *
 * Compares each enabled trigger against the latest sensory observation for
 * its channel/metric. When a condition is met (and not fired in the last 30s),
 * it autonomously fires: creates a tiered action and emits an event. This is
 * the "anticipatory execution" contract — sub-agent workflows triggered
 * without explicit user prompting.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger, emitEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";

function compare(operator: string, threshold: string, value: number): boolean {
  const t = Number(threshold);
  if (Number.isNaN(t)) return false;
  switch (operator) {
    case "gt": return value > t;
    case "lt": return value < t;
    case "eq": return Math.abs(value - t) < 0.001;
    case "between": {
      const [lo, hi] = threshold.split(",").map(Number);
      return value >= lo && value <= hi;
    }
    default: return false;
  }
}

export async function GET() {
  const triggers = await db.trigger.findMany({ where: { enabled: true } });
  const fired: { trigger: string; action: string; agent: string; tier: number }[] = [];
  const now = Date.now();
  const COOLDOWN_MS = 30_000;

  for (const t of triggers) {
    if (t.lastFired && now - t.lastFired.getTime() < COOLDOWN_MS) continue;

    // For "time" channel triggers, evaluate against the current hour.
    if (t.channel === "time") {
      const hour = new Date().getHours();
      if (compare(t.operator, t.threshold, hour)) {
        const action = await db.action.create({
          data: {
            title: t.name,
            description: t.action,
            agentName: t.agentName,
            tier: t.tier,
            status: t.tier === 1 ? "executed" : t.tier === 2 ? "pending" : "advisory",
            resolvedAt: t.tier === 1 || t.tier === 3 ? new Date() : null,
          },
        });
        await db.trigger.update({
          where: { id: t.id },
          data: { lastFired: new Date(), fireCount: { increment: 1 } },
        });
        await logger.info("orchestrator", `Anticipatory trigger fired: ${t.name}`, "ACT");
        await emitEvent({
          type: "trigger",
          phase: "ACT",
          message: `Trigger fired: ${t.name} → ${t.action.slice(0, 60)}`,
          data: { trigger: t.name, agent: t.agentName, tier: t.tier, actionId: action.id },
        });
        fired.push({ trigger: t.name, action: t.action, agent: t.agentName, tier: t.tier });
      }
      continue;
    }

    // Otherwise, look at the latest sensory event for this channel.
    const latest = await db.sensoryEvent.findFirst({
      where: { channel: t.channel },
      orderBy: { createdAt: "desc" },
    });
    if (!latest) continue;

    let value: number | null = null;
    try {
      const parsed = JSON.parse(latest.value) as { metric?: string; value?: number | string };
      if (parsed.metric === t.metric && typeof parsed.value === "number") value = parsed.value;
      else if (typeof parsed.value === "number") value = parsed.value;
    } catch {
      /* ignore */
    }
    if (value === null) continue;

    if (compare(t.operator, t.threshold, value)) {
      const status = t.tier === 1 ? "executed" : t.tier === 2 ? "pending" : "advisory";
      const action = await db.action.create({
        data: {
          title: t.name,
          description: t.action,
          agentName: t.agentName,
          tier: t.tier,
          status,
          resolvedAt: t.tier === 1 || t.tier === 3 ? new Date() : null,
        },
      });
      await db.trigger.update({
        where: { id: t.id },
        data: { lastFired: new Date(), fireCount: { increment: 1 } },
      });
      await logger.info("orchestrator", `Anticipatory trigger fired: ${t.name} (${t.metric}=${value} ${t.operator} ${t.threshold})`, "ACT");
      await emitEvent({
        type: "trigger",
        phase: "ACT",
        message: `Trigger fired: ${t.name} (${t.metric}=${value})`,
        data: { trigger: t.name, agent: t.agentName, tier: t.tier, actionId: action.id, value },
      });
      fired.push({ trigger: t.name, action: t.action, agent: t.agentName, tier: t.tier });
    }
  }

  return NextResponse.json({ ok: true, fired, evaluatedAt: new Date().toISOString() });
}
