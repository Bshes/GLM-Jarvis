/**
 * POST /api/aeon/llm — direct LLM call with explicit complexity routing.
 * Returns the routing decision + the model's response. Used by the "direct
 * query" console and to demonstrate the hot-swap router.
 */
import { NextResponse } from "next/server";
import { route } from "@/lib/router";
import { chat } from "@/lib/zai";
import { logger, emitEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You are A.E.O.N., an autonomous AI operating system. Answer concisely and precisely. When asked about your architecture, describe the PERCEIVE-THINK-ACT-REFLECT loop, graph+vector memory, LLM routing, and tiered safety execution.`;

export async function POST(req: Request) {
  const { prompt, thinking } = (await req.json()) as { prompt: string; thinking?: boolean };
  if (!prompt?.trim()) return NextResponse.json({ error: "prompt required" }, { status: 400 });

  const routing = route(prompt);
  const useThinking = thinking ?? routing.thinking;

  await logger.info("router", `direct query → ${routing.route} (${routing.model}, thinking=${useThinking})`);
  await emitEvent({ type: "routing", message: `Direct query routed to ${routing.route} model`, data: routing });

  const start = Date.now();
  const response = await chat(prompt, {
    system: SYSTEM,
    thinking: useThinking,
    temperature: 0.6,
    maxTokens: 700,
  });
  const durationMs = Date.now() - start;

  return NextResponse.json({ response, routing, durationMs });
}
