/** POST /api/aeon/asr — transcribe an uploaded audio file (base64 wav/webm). */
import { NextResponse } from "next/server";
import { speechToText } from "@/lib/zai";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request) {
  const { base64 } = (await req.json()) as { base64: string };
  if (!base64) return NextResponse.json({ error: "base64 audio required" }, { status: 400 });

  // Strip any data-uri prefix.
  const clean = base64.includes(",") ? base64.split(",")[1] : base64;
  const text = await speechToText(clean);
  await logger.info("sensory", `ASR transcribed: ${text.slice(0, 60)}`);
  return NextResponse.json({ text });
}
