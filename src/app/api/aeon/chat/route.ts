/**
 * POST /api/aeon/chat — direct LLM console with routing transparency + optional
 * web_search tool. Persists the user + assistant turns to ChatTurn for history.
 *
 * Body: { message: string, useHistory?: boolean, useWebSearch?: boolean }
 * Returns: { response, routing, durationMs, webResults? }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { route } from "@/lib/router";
import { chat, webSearch, extractJSON } from "@/lib/zai";
import { logger, emitEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SYSTEM = `You are A.E.O.N., an autonomous AI operating system. Answer with precision and clarity. When asked about your architecture, describe the PERCEIVE-THINK-ACT-REFLECT cognitive loop, the graph + vector memory, the complexity-based LLM router (local Llama-3 vs cloud Claude-3.5), and the three-tier safety execution (autonomous / confirmative / advisory). Use markdown for structure when helpful.`;

interface WebHit {
  url: string;
  name: string;
  snippet: string;
  host_name: string;
}

export async function POST(req: Request) {
  const { message, useHistory, useWebSearch } = (await req.json()) as {
    message: string;
    useHistory?: boolean;
    useWebSearch?: boolean;
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const routing = route(message);
  await emitEvent({ type: "routing", message: `Console query → ${routing.route} model`, data: routing });
  await logger.info("router", `console query → ${routing.route} (${routing.model}, thinking=${routing.thinking})`);

  // Optional web search: gather fresh context first.
  let webResults: WebHit[] = [];
  if (useWebSearch) {
    webResults = await webSearch(message, 5);
    await logger.info("agent:Researcher", `Console web_search → ${webResults.length} results`);
  }

  // Build message history from prior turns if requested.
  const priorMessages: { role: "system" | "user" | "assistant"; content: string }[] = [{ role: "system", content: SYSTEM }];
  if (useHistory) {
    const prior = await db.chatTurn.findMany({ orderBy: { createdAt: "asc" }, take: 12 });
    for (const t of prior) {
      priorMessages.push({ role: t.role as "user" | "assistant", content: t.content });
    }
  }

  // Augment the user message with web context if available.
  let augmented = message;
  if (webResults.length > 0) {
    const ctx = webResults
      .map((r, i) => `[${i + 1}] ${r.name}\n    ${r.snippet}\n    — ${r.host_name} (${r.url})`)
      .join("\n");
    augmented = `${message}\n\nRelevant fresh web context (cite as [n] when used):\n${ctx}`;
  }
  priorMessages.push({ role: "user", content: augmented });

  const start = Date.now();
  let response: string;
  try {
    // Use the SDK's chat directly with a multi-turn message array.
    const zai = await (await import("@/lib/zai")).getZAI();
    const completion = await zai.chat.completions.create({
      messages: priorMessages,
      thinking: { type: routing.thinking ? "enabled" : "disabled" },
      temperature: 0.6,
      max_tokens: 900,
    } as Parameters<typeof zai.chat.completions.create>[0]);
    response = completion?.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    await logger.error("router", `Console LLM call failed: ${(e as Error).message}`);
    response = `⚠ The reasoning model encountered an error: ${(e as Error).message}`;
  }
  const durationMs = Date.now() - start;

  // Persist both turns.
  try {
    await db.chatTurn.create({
      data: {
        role: "user",
        content: message,
        routing: JSON.stringify(routing),
        webResults: webResults.length ? JSON.stringify(webResults) : null,
      },
    });
    await db.chatTurn.create({
      data: { role: "assistant", content: response, durationMs },
    });
  } catch (e) {
    await logger.warn("router", `Failed to persist chat turns: ${(e as Error).message}`);
  }

  return NextResponse.json({ response, routing, durationMs, webResults });
}

/** GET /api/aeon/chat — retrieve the conversation history. */
export async function GET() {
  const turns = await db.chatTurn.findMany({ orderBy: { createdAt: "asc" }, take: 50 });
  return NextResponse.json(
    turns.map((t) => ({
      id: t.id,
      role: t.role,
      content: t.content,
      routing: t.routing ? safeParse(t.routing) : null,
      webResults: t.webResults ? safeParse(t.webResults) : null,
      durationMs: t.durationMs,
      createdAt: t.createdAt.toISOString(),
    })),
  );
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// (extractJSON import kept for potential future structured mode)
void extractJSON;
