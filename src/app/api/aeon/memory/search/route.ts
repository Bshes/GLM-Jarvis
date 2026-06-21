/** POST /api/aeon/memory/search — vector similarity recall over memories. */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { embed, deserialize, cosine } from "@/lib/embed";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const { query, k = 6 } = (await req.json()) as { query: string; k?: number };
  if (!query?.trim()) return NextResponse.json({ results: [] });

  const qv = embed(query);
  const all = await db.memory.findMany({ orderBy: { createdAt: "desc" }, take: 300 });

  const results = all
    .map((m) => {
      const v = deserialize(m.embedding);
      const sim = v ? cosine(qv, v) : 0;
      const importanceBoost = m.importance * 0.08;
      return { m, score: sim + importanceBoost };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(({ m, score }) => ({
      id: m.id,
      content: m.content,
      kind: m.kind,
      tags: m.tags,
      source: m.source,
      importance: m.importance,
      createdAt: m.createdAt.toISOString(),
      score,
    }));

  return NextResponse.json({ results });
}
