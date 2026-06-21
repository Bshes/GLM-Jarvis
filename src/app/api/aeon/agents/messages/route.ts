/**
 * GET  /api/aeon/agents/messages — list recent inter-agent messages.
 *   Optional `?agent=Name` filters by `toAgent` (includes "broadcast").
 *   Returns up to 50 messages, newest first.
 *
 * POST /api/aeon/agents/messages — create a message on the collaboration bus.
 *   Body: { fromAgent, toAgent, kind, subject, body }
 *   - kind = "delegate" | "query" → simulate the target agent processing the
 *     request: after ~1.5s, persist an auto-generated `response` message back
 *     from the target agent. This makes the bus feel alive.
 *   - broadcast delegates fan out to all known agents and each replies.
 *
 * PATCH /api/aeon/agents/messages — mark messages as read.
 *   Body: { ids: string[] } | { agent: string }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { logger, emitEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";

const VALID_KINDS = new Set(["delegate", "status", "result", "query", "response"]);

/** Map of agent name → canned processing acknowledgement. */
const AUTO_REPLY: Record<string, (subject: string, kind: string) => string> = {
  Coder: (s, k) =>
    k === "delegate"
      ? `Sandbox ready. Drafting implementation for "${s}". Will open a tier-2 confirmation once tests pass.`
      : `On it — sketching the approach for "${s}". Will reply with a result patch shortly.`,
  Researcher: (s, k) =>
    k === "delegate"
      ? `Crawling fresh sources for "${s}". Synthesis will follow with citations.`
      : `Query acknowledged — searching the web for "${s}".`,
  IoT: (s, k) =>
    k === "delegate"
      ? `Acknowledged — applying device state change for "${s}".`
      : `Routing your query through the Home Assistant bridge for "${s}".`,
  Financial: (s, k) =>
    k === "delegate"
      ? `Compiling figures for "${s}". Advisory note will follow (tier-3 — no side effects).`
      : `Reading the latest spend telemetry to answer "${s}".`,
  Orchestrator: (s) =>
    `Received "${s}". Folding this into the next PERCEIVE-THINK-ACT-REFLECT cycle.`,
};

/** List the agent names we know how to simulate (so broadcast delegates fan out). */
async function knownAgents(): Promise<string[]> {
  const rows = await db.agent.findMany({ select: { name: true } });
  return rows.map((r) => r.name);
}

function serialize(m: {
  id: string;
  fromAgent: string;
  toAgent: string;
  kind: string;
  subject: string;
  body: string;
  read: boolean;
  createdAt: Date;
}) {
  return {
    id: m.id,
    fromAgent: m.fromAgent,
    toAgent: m.toAgent,
    kind: m.kind,
    subject: m.subject,
    body: m.body,
    read: m.read,
    createdAt: m.createdAt.toISOString(),
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const agent = url.searchParams.get("agent");
  const take = Math.min(100, Number(url.searchParams.get("take") ?? 50));

  const rows = agent
    ? await db.agentMessage.findMany({
        where: { OR: [{ toAgent: agent }, { toAgent: "broadcast" }, { fromAgent: agent }] },
        orderBy: { createdAt: "desc" },
        take,
      })
    : await db.agentMessage.findMany({
        orderBy: { createdAt: "desc" },
        take,
      });

  return NextResponse.json(rows.map(serialize));
}

export async function POST(req: Request) {
  const body = (await req.json()) as {
    fromAgent?: string;
    toAgent?: string;
    kind?: string;
    subject?: string;
    body?: string;
  };

  const fromAgent = (body.fromAgent ?? "").trim();
  const toAgent = (body.toAgent ?? "").trim();
  const kind = (body.kind ?? "").trim();
  const subject = (body.subject ?? "").trim();
  const msgBody = (body.body ?? "").trim();

  if (!fromAgent || !toAgent || !kind || !subject || !msgBody) {
    return NextResponse.json(
      { error: "fromAgent, toAgent, kind, subject, body are all required" },
      { status: 400 },
    );
  }
  if (!VALID_KINDS.has(kind)) {
    return NextResponse.json(
      { error: `kind must be one of delegate | status | result | query | response` },
      { status: 400 },
    );
  }

  const created = await db.agentMessage.create({
    data: { fromAgent, toAgent, kind, subject, body: msgBody },
  });

  await logger.info(
    `agent:${fromAgent}`,
    `Message → ${toAgent} [${kind}] "${subject}"`,
  );
  await emitEvent({
    type: "agent",
    message: `${fromAgent} → ${toAgent} [${kind}] ${subject}`,
    data: { from: fromAgent, to: toAgent, kind, subject, messageId: created.id },
  });

  // ── Simulated auto-reply for delegate / query kinds ───────────────────────
  // Fire-and-forget: schedule a response from the target agent after ~1.5s.
  // For broadcast, every known agent replies (slightly staggered).
  if (kind === "delegate" || kind === "query") {
    const targets = toAgent === "broadcast" ? await knownAgents() : [toAgent];
    // Avoid the pathological self-reply when an agent broadcasts to itself.
    const replyTargets = targets.filter((t) => t !== fromAgent);

    for (let i = 0; i < replyTargets.length; i++) {
      const target = replyTargets[i];
      const replyFn = AUTO_REPLY[target] ?? AUTO_REPLY.Orchestrator;
      const replyBody = replyFn(subject, kind);
      const delay = 1500 + i * 700; // stagger broadcast replies
      setTimeout(() => {
        void (async () => {
          try {
            const reply = await db.agentMessage.create({
              data: {
                fromAgent: target,
                toAgent: fromAgent,
                kind: "response",
                subject: `Re: ${subject}`,
                body: replyBody,
              },
            });
            await logger.info(
              `agent:${target}`,
              `Auto-response → ${fromAgent} [response] "Re: ${subject}"`,
            );
            await emitEvent({
              type: "agent",
              message: `${target} → ${fromAgent} [response] Re: ${subject}`,
              data: {
                from: target,
                to: fromAgent,
                kind: "response",
                subject: `Re: ${subject}`,
                messageId: reply.id,
              },
            });
          } catch (e) {
            await logger.error(
              `agent:${target}`,
              `Auto-response failed: ${(e as Error).message}`,
            );
          }
        })();
      }, delay);
    }
  }

  return NextResponse.json(serialize(created), { status: 201 });
}

export async function PATCH(req: Request) {
  const body = (await req.json()) as { ids?: string[]; agent?: string };
  if (body.ids && Array.isArray(body.ids)) {
    await db.agentMessage.updateMany({
      where: { id: { in: body.ids } },
      data: { read: true },
    });
  } else if (body.agent) {
    await db.agentMessage.updateMany({
      where: { toAgent: body.agent, read: false },
      data: { read: true },
    });
  } else {
    return NextResponse.json(
      { error: "Provide { ids: string[] } or { agent: string }" },
      { status: 400 },
    );
  }
  return NextResponse.json({ ok: true });
}
