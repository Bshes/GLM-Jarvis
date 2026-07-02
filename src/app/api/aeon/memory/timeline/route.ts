/**
 * GET /api/aeon/memory/timeline — memories grouped by day for the temporal view.
 * Returns { days: [{ date, count, memories: [...] }], total, span }
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const memories = await db.memory.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Group by calendar day.
  const dayMap = new Map<string, { date: string; count: number; memories: typeof memories }>();
  for (const m of memories) {
    const d = m.createdAt;
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, { date: dateKey, count: 0, memories: [] });
    }
    const day = dayMap.get(dateKey)!;
    day.count++;
    day.memories.push(m);
  }

  const days = Array.from(dayMap.values()).sort((a, b) => b.date.localeCompare(a.date));

  // Compute span (earliest to latest).
  const timestamps = memories.map((m) => m.createdAt.getTime());
  const span = timestamps.length > 0
    ? { earliest: new Date(Math.min(...timestamps)).toISOString(), latest: new Date(Math.max(...timestamps)).toISOString() }
    : null;

  // Kind distribution.
  const kindCounts: Record<string, number> = {};
  for (const m of memories) {
    kindCounts[m.kind] = (kindCounts[m.kind] ?? 0) + 1;
  }

  return NextResponse.json({
    days: days.map((d) => ({
      ...d,
      memories: d.memories.map((m) => ({
        id: m.id,
        content: m.content,
        kind: m.kind,
        tags: m.tags,
        source: m.source,
        importance: m.importance,
        createdAt: m.createdAt.toISOString(),
      })),
    })),
    total: memories.length,
    span,
    kindCounts,
  });
}
