/**
 * A.E.O.N. orchestrator — the Master Brain.
 *
 * Runs one cognitive cycle: PERCEIVE → THINK → ACT → REFLECT.
 *  - PERCEIVE: ingest user input + environmental context, recall memories.
 *  - THINK:    route via complexity router, call the LLM for a structured plan.
 *  - ACT:      persist tiered actions; execute tier-1 (IoT) immediately;
 *              tier-2 await confirmation; tier-3 advisory only.
 *  - REFLECT:  store a new episodic memory and score the cycle.
 *
 * Every phase emits live events to the stream service for the UI.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { route } from "@/lib/router";
import { chatJSON } from "@/lib/zai";
import { configureStream, logger, emitEvent } from "@/lib/logger";
import { embed, serialize, deserialize, cosine } from "@/lib/embed";
import type { LoopPhase, OrchestrationResult } from "@/lib/aeon";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

configureStream(process.env.AEON_STREAM_URL ?? null);

interface PlannedAction {
  agent: string;
  tier: 1 | 2 | 3;
  title: string;
  description?: string;
  payload?: Record<string, unknown>;
}

interface LLMPlan {
  perception: string;
  thought: string;
  actions: PlannedAction[];
  reflection: string;
  memory: string;
}

const VALID_AGENTS = ["Coder", "Researcher", "IoT", "Financial"];

function phaseEvent(phase: LoopPhase, message: string) {
  return emitEvent({ type: "phase", phase, message });
}

function shortId() {
  return "cyc_" + Math.random().toString(36).slice(2, 9);
}

async function recallMemories(query: string, k = 4) {
  const qv = embed(query);
  const all = await db.memory.findMany({ orderBy: { createdAt: "desc" }, take: 200 });
  const scored = all
    .map((m) => {
      const v = deserialize(m.embedding);
      return { m, score: v ? cosine(qv, v) : 0 };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
  return scored.map(({ m, score }) => ({
    id: m.id,
    content: m.content,
    kind: m.kind,
    tags: m.tags,
    source: m.source,
    importance: m.importance,
    createdAt: m.createdAt.toISOString(),
    score,
  }));
}

/** Execute a tier-1 IoT action against the simulated device store. */
async function executeIoT(payload: Record<string, unknown> | undefined): Promise<string> {
  if (!payload) return "no payload";
  const deviceName = String(payload.device ?? payload.deviceName ?? "");
  const state = (payload.state ?? payload.changes ?? {}) as Record<string, unknown>;
  if (!deviceName) return "no device specified";
  const device = await db.device.findFirst({ where: { name: { contains: deviceName } } });
  if (!device) return `device '${deviceName}' not found`;
  const current = JSON.parse(device.state || "{}");
  const next = { ...current, ...state };
  await db.device.update({ where: { id: device.id }, data: { state: JSON.stringify(next) } });
  return `${device.name} → ${JSON.stringify(next)}`;
}

export async function POST(req: Request) {
  const started = Date.now();
  const cycleId = shortId();
  const body = (await req.json().catch(() => ({}))) as {
    input?: string;
    context?: string;
  };
  const userInput = (body.input ?? "").trim();
  const envContext = (body.context ?? "").trim();

  if (!userInput) {
    return NextResponse.json({ error: "input required" }, { status: 400 });
  }

  // Persist the inbound sensory observation.
  await db.sensoryEvent.create({
    data: {
      channel: "text",
      value: JSON.stringify({ input: userInput, context: envContext }),
      severity: "info",
    },
  });

  await logger.info("orchestrator", `Cycle ${cycleId} initiated: "${userInput.slice(0, 80)}"`);

  // ───────────────────────── PERCEIVE ─────────────────────────
  await phaseEvent("PERCEIVE", "Ingesting sensory input & environmental context");
  const recalled = await recallMemories(userInput);
  const recentEvents = await db.sensoryEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 3,
  });
  const perceptionContext = [
    `USER INPUT: ${userInput}`,
    envContext ? `ENVIRONMENT: ${envContext}` : null,
    `RECENT EVENTS: ${recentEvents.length}`,
    `RECALLED MEMORIES:\n${recalled.map((r, i) => `  ${i + 1}. (${r.score.toFixed(2)}) ${r.content}`).join("\n")}`,
  ]
    .filter(Boolean)
    .join("\n");

  await emitEvent({ type: "memory", phase: "PERCEIVE", message: `Recalled ${recalled.length} memories`, data: recalled });
  await logger.info("orchestrator", `Perceived input; recalled ${recalled.length} memories`, "PERCEIVE");

  // ───────────────────────── THINK ─────────────────────────
  await phaseEvent("THINK", "Routing to model & reasoning over the plan");
  const routing = route(userInput);
  await emitEvent({ type: "routing", phase: "THINK", message: `Routed to ${routing.route} model`, data: routing });
  await logger.info(
    "router",
    `route=${routing.route} model=${routing.model} complexity=${routing.complexity.toFixed(2)} thinking=${routing.thinking} (${routing.reason})`,
    "THINK",
  );

  const agents = await db.agent.findMany();
  const agentRoster = agents
    .map((a) => `- ${a.name} (${a.role}, tier ${a.tier}, model ${a.model})`)
    .join("\n");

  const systemPrompt = `You are A.E.O.N., an autonomous AI operating system orchestrator.
Reason through the user's request and produce a STRICT JSON plan. No prose outside JSON.

Available sub-agents:
${agentRoster}

Safety tiers:
- Tier 1 (Autonomous): smart-home, scheduling, recall — execute immediately.
- Tier 2 (Confirmative): emails, payments under $50, publishing — require yes/no confirmation.
- Tier 3 (Advisory): investments, legal, large spending — output recommendation only.

Respond with EXACTLY this JSON shape:
{
  "perception": "one-sentence summary of what you perceived",
  "thought": "2-4 sentences of reasoning, including which agent(s) to use and why",
  "actions": [
    { "agent": "IoT|Coder|Researcher|Financial", "tier": 1|2|3, "title": "short action title", "description": "what it does", "payload": { "device": "name", "state": { ... } } }
  ],
  "reflection": "one sentence on expected outcome and what to learn",
  "memory": "one sentence of durable knowledge to store from this cycle (or empty string)"
}

Rules:
- actions may be empty if only advice is needed.
- For IoT actions include a "payload" with "device" (device name substring) and "state" object.
- Keep titles concise. Prefer 1-3 actions. Never invent agents outside the roster.`;

  let plan: LLMPlan;
  try {
    plan = await chatJSON<LLMPlan>(`${perceptionContext}\n\nProduce the JSON plan now.`, {
      system: systemPrompt,
      thinking: routing.thinking,
      temperature: 0.5,
      maxTokens: 1100,
    });
  } catch (e) {
    const msg = (e as Error).message;
    await logger.error("orchestrator", `LLM plan failed: ${msg}`, "THINK");
    await emitEvent({ type: "error", phase: "THINK", message: `LLM failure: ${msg}` });
    plan = {
      perception: "Failed to parse model output.",
      thought: `The reasoning model returned an unparseable response (${msg}). Falling back to a safe advisory.`,
      actions: [
        {
          agent: "Researcher",
          tier: 3,
          title: "Advisory only",
          description: "Model output could not be structured; no side effects taken.",
        },
      ],
      reflection: "Need to harden the JSON contract or retry with a stricter prompt.",
      memory: "",
    };
  }

  await emitEvent({ type: "thought", phase: "THINK", message: plan.thought, data: { perception: plan.perception } });
  await logger.info("orchestrator", `Thought: ${plan.thought}`, "THINK");

  // ───────────────────────── ACT ─────────────────────────
  await phaseEvent("ACT", `Dispatching ${plan.actions.length} action(s) to sub-agents`);
  const createdActions: OrchestrationResult["actions"] = [];

  for (const a of plan.actions) {
    const agentName = VALID_AGENTS.includes(a.agent) ? a.agent : "Researcher";
    const tier = ([1, 2, 3].includes(a.tier) ? a.tier : 3) as 1 | 2 | 3;
    const agent = await db.agent.findUnique({ where: { name: agentName } });

    let status: string;
    let result: string | null = null;

    if (tier === 1) {
      status = "executed";
      await db.agent.update({
        where: { name: agentName },
        data: { status: "busy", lastTask: a.title, lastActive: new Date() },
      });
      await emitEvent({ type: "agent", phase: "ACT", message: `${agentName} executing: ${a.title}`, data: { agent: agentName, status: "busy" } });
      if (agentName === "IoT") {
        result = await executeIoT(a.payload);
      } else {
        result = "executed (autonomous, no side-effectful target)";
      }
      await db.agent.update({
        where: { name: agentName },
        data: { status: "idle", tasksDone: { increment: 1 } },
      });
      await emitEvent({ type: "agent", phase: "ACT", message: `${agentName} done: ${a.title}`, data: { agent: agentName, status: "idle" } });
    } else if (tier === 2) {
      status = "pending";
      await db.agent.update({
        where: { name: agentName },
        data: { lastTask: a.title, lastActive: new Date() },
      });
      await emitEvent({ type: "agent", phase: "ACT", message: `${agentName} awaiting confirmation: ${a.title}`, data: { agent: agentName, status: "awaiting" } });
    } else {
      status = "advisory";
      result = a.description ?? "advisory only";
    }

    const action = await db.action.create({
      data: {
        title: a.title,
        description: a.description ?? null,
        agentName,
        tier,
        status,
        payload: a.payload ? JSON.stringify(a.payload) : null,
        result,
        resolvedAt: tier === 1 || tier === 3 ? new Date() : null,
      },
    });

    await emitEvent({
      type: "action",
      phase: "ACT",
      message: `[T${tier}] ${agentName}: ${a.title} → ${status}`,
      data: {
        id: action.id,
        title: a.title,
        agent: agentName,
        tier,
        status,
        result,
      },
    });
    await logger.info(`agent:${agentName}`, `[T${tier}] ${a.title} → ${status}`, "ACT");

    createdActions.push({
      id: action.id,
      title: action.title,
      description: action.description,
      agentName: action.agentName,
      tier: action.tier,
      status: action.status,
      payload: action.payload,
      result: action.result,
      createdAt: action.createdAt.toISOString(),
      resolvedAt: action.resolvedAt?.toISOString() ?? null,
    });
  }

  // ───────────────────────── REFLECT ─────────────────────────
  await phaseEvent("REFLECT", "Scoring outcome & consolidating memory");
  let memoriesCreated = 0;
  if (plan.memory && plan.memory.trim().length > 4) {
    await db.memory.create({
      data: {
        content: plan.memory.trim(),
        kind: "episodic",
        tags: "cycle,reflection",
        source: "orchestrator",
        importance: 0.6,
        embedding: serialize(embed(plan.memory.trim())),
      },
    });
    memoriesCreated = 1;
    await emitEvent({ type: "memory", phase: "REFLECT", message: `Stored memory: ${plan.memory.trim().slice(0, 80)}` });
  }

  const outcome = plan.actions.length === 0
    ? "advisory"
    : plan.actions.some((a) => a.tier === 2)
      ? "awaiting-confirmation"
      : "executed";
  await logger.info("orchestrator", `Reflection: ${plan.reflection} (outcome=${outcome})`, "REFLECT");
  await emitEvent({ type: "status", phase: "REFLECT", message: `Cycle ${cycleId} complete — ${outcome}` });

  const durationMs = Date.now() - started;

  // Persist the completed cycle to history.
  try {
    await db.cycleHistory.create({
      data: {
        cycleId,
        input: userInput,
        perception: plan.perception,
        thought: plan.thought,
        reflection: plan.reflection,
        routing: JSON.stringify(routing),
        route: routing.route,
        complexity: routing.complexity,
        model: routing.model,
        thinking: routing.thinking,
        durationMs,
        actionCount: createdActions.length,
        memoriesCreated,
        outcome,
      },
    });
  } catch (e) {
    await logger.warn("orchestrator", `Failed to persist cycle history: ${(e as Error).message}`);
  }

  const result: OrchestrationResult = {
    cycleId,
    perception: plan.perception,
    routing,
    thought: plan.thought,
    actions: createdActions,
    reflection: plan.reflection,
    memoriesCreated,
    durationMs,
  };

  return NextResponse.json(result);
}
