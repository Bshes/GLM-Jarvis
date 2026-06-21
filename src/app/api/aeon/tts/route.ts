/** POST /api/aeon/tts — synthesize speech, return a data-uri for <audio>. */
import { NextResponse } from "next/server";
import { textToSpeechBase64 } from "@/lib/zai";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { input, voice } = (await req.json()) as { input: string; voice?: string };
  if (!input?.trim()) return NextResponse.json({ error: "input required" }, { status: 400 });
  const dataUri = await textToSpeechBase64(input.slice(0, 600), voice ?? "tongtong");
  await logger.info("sensory", `TTS synthesized ${input.length} chars`);
  return NextResponse.json({ audio: dataUri });
}
