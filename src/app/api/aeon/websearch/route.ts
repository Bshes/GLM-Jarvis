/** POST /api/aeon/websearch — researcher agent web search via the SDK. */
import { NextResponse } from "next/server";
import { webSearch } from "@/lib/zai";
import { logger, emitEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { query, num } = (await req.json()) as { query: string; num?: number };
  if (!query?.trim()) return NextResponse.json({ error: "query required" }, { status: 400 });

  await emitEvent({ type: "agent", message: `Researcher querying web: ${query}` });
  const results = await webSearch(query, num ?? 6);
  await logger.info("agent:Researcher", `Web search "${query}" → ${results.length} results`);
  return NextResponse.json({ query, results });
}
