/**
 * POST /api/aeon/enhance — The Cognitive Enhancement Pipeline.
 *
 * Gives any LLM (even cheap text-only models) capabilities they don't natively have:
 *  - VISION:   feeds image analysis to a text LLM (cheap LLM gains "eyes")
 *  - AUDIO:    ASR → LLM → TTS (cheap LLM gains voice I/O)
 *  - WEB:      grounds answers in fresh web data (no stale hallucinations)
 *  - MEMORY:   recalls relevant episodic/semantic context (personalization)
 *  - MULTI-STEP: decomposes complex queries into sub-questions, answers each, synthesizes
 *  - SELF-CRITIQUE: identifies gaps the LLM might skip, refines the final answer
 *
 * The pipeline is transparent — every enhancement step is returned for the UI to visualize.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { route } from "@/lib/router";
import { chat, chatJSON, webSearch, textToSpeechBase64, getZAI } from "@/lib/zai";
import { embed, serialize, deserialize, cosine } from "@/lib/embed";
import { logger, emitEvent } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

interface EnhancementStep {
  id: string;
  skill: "analyze" | "vision" | "audio-in" | "web" | "memory" | "decompose" | "sub-answer" | "synthesize" | "critique" | "refine" | "audio-out";
  label: string;
  status: "pending" | "running" | "done" | "skipped";
  detail?: string;
  data?: unknown;
  durationMs?: number;
}

interface EnhanceRequest {
  message: string;
  imageBase64?: string; // optional image for vision
  audioBase64?: string; // optional audio for ASR
  enableVision?: boolean;
  enableWeb?: boolean;
  enableMemory?: boolean;
  enableMultiStep?: boolean;
  enableCritique?: boolean;
  enableVoice?: boolean;
}

interface EnhanceResponse {
  steps: EnhancementStep[];
  analysis: {
    complexity: number;
    route: string;
    model: string;
    recommendedSkills: string[];
    reasoning: string;
  };
  visionDescription?: string;
  transcript?: string;
  webResults?: { url: string; name: string; snippet: string; host_name: string }[];
  memories?: { content: string; score: number; kind: string }[];
  subQuestions?: string[];
  subAnswers?: { question: string; answer: string }[];
  synthesizedAnswer: string;
  critique?: string;
  refinedAnswer: string;
  audioOutput?: string; // data-uri
  durationMs: number;
}

const SYSTEM_PROMPT = `You are A.E.O.N., an autonomous AI operating system with cognitive enhancement capabilities. You can leverage vision, audio, web search, memory, and multi-step reasoning — even when the underlying LLM cannot. Use the provided context from enhancement steps to deliver the best possible answer. Always cite when you use web sources [n] or memory context.`;

export async function POST(req: Request) {
  const started = Date.now();
  const body = (await req.json()) as EnhanceRequest;
  const message = body.message?.trim();

  if (!message && !body.imageBase64 && !body.audioBase64) {
    return NextResponse.json({ error: "message, image, or audio required" }, { status: 400 });
  }

  const steps: EnhancementStep[] = [];
  const result: Partial<EnhanceResponse> = { steps };

  // ─── Step 1: Analyze the query ───
  const analyzeStep: EnhancementStep = { id: "s1", skill: "analyze", label: "Query Analysis", status: "running" };
  steps.push(analyzeStep);

  let inputText = message;
  const routing = route(message || "describe this image");

  // Determine which skills are recommended + enabled
  const recommended: string[] = [];
  const lowerMsg = (message || "").toLowerCase();

  const wantVision = body.enableVision && !!body.imageBase64;
  const wantAudioIn = !!body.audioBase64;
  const wantWeb = body.enableWeb ?? (lowerMsg.includes("latest") || lowerMsg.includes("current") || lowerMsg.includes("news") || lowerMsg.includes("today") || lowerMsg.includes("recent"));
  const wantMemory = body.enableMemory ?? (lowerMsg.includes("my") || lowerMsg.includes("remember") || lowerMsg.includes("previous") || lowerMsg.includes("i ") || routing.complexity > 0.4);
  const wantMultiStep = body.enableMultiStep ?? (routing.complexity > 0.55 || lowerMsg.includes("how") || lowerMsg.includes("why") || lowerMsg.includes("explain") || lowerMsg.includes("compare") || lowerMsg.includes("analyze"));
  const wantCritique = body.enableCritique ?? (routing.complexity > 0.5);
  const wantVoice = body.enableVoice ?? false;

  if (wantVision) recommended.push("vision");
  if (wantAudioIn) recommended.push("audio-in");
  if (wantWeb) recommended.push("web");
  if (wantMemory) recommended.push("memory");
  if (wantMultiStep) recommended.push("multi-step");
  if (wantCritique) recommended.push("critique");
  if (wantVoice) recommended.push("audio-out");

  analyzeStep.status = "done";
  analyzeStep.detail = `complexity ${routing.complexity.toFixed(2)} → ${routing.route} (${routing.model})`;
  analyzeStep.data = { routing, recommended };
  analyzeStep.durationMs = Date.now() - started;
  result.analysis = {
    complexity: routing.complexity,
    route: routing.route,
    model: routing.model,
    recommendedSkills: recommended,
    reasoning: routing.reason,
  };

  await emitEvent({ type: "routing", message: `Enhancement pipeline: ${recommended.length} skills recommended`, data: { recommended, routing } });

  // ─── Step 2: Audio Input (ASR) ───
  if (wantAudioIn && body.audioBase64) {
    const step: EnhancementStep = { id: "s2", skill: "audio-in", label: "Audio Transcription (ASR)", status: "running" };
    steps.push(step);
    const t = Date.now();
    try {
      const clean = body.audioBase64.includes(",") ? body.audioBase64.split(",")[1] : body.audioBase64;
      const zai = await getZAI();
      const asrRes = await zai.audio.asr.create({ file_base64: clean } as Parameters<typeof zai.audio.asr.create>[0]);
      const transcript = (asrRes as { text?: string })?.text ?? "";
      result.transcript = transcript;
      inputText = message ? `${message}\n\n[Transcribed audio]: ${transcript}` : transcript;
      step.status = "done";
      step.detail = `Transcribed: "${transcript.slice(0, 80)}${transcript.length > 80 ? "…" : ""}"`;
      step.durationMs = Date.now() - t;
    } catch (e) {
      step.status = "skipped";
      step.detail = `ASR failed: ${(e as Error).message}`;
    }
  }

  // ─── Step 3: Vision (VLM) ───
  if (wantVision && body.imageBase64) {
    const step: EnhancementStep = { id: "s3", skill: "vision", label: "Vision Analysis (VLM)", status: "running" };
    steps.push(step);
    const t = Date.now();
    try {
      const zai = await getZAI();
      const imageUrl = body.imageBase64.startsWith("data:") ? body.imageBase64 : `data:image/jpeg;base64,${body.imageBase64}`;
      const visionRes = await zai.chat.completions.createVision({
        model: "glm-4.6v",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: `Analyze this image in detail. Describe what you see, any text, objects, people, scenes, data, or anything relevant. Be thorough — this description will be fed to a text-only LLM to answer: "${message || "Describe this image"}"` },
            { type: "image_url", image_url: { url: imageUrl } },
          ],
        }],
        thinking: { type: "disabled" },
      } as Parameters<typeof zai.chat.completions.createVision>[0]);
      const description = visionRes?.choices?.[0]?.message?.content ?? "";
      result.visionDescription = description;
      inputText = `${inputText}\n\n[Vision analysis]: ${description}`;
      step.status = "done";
      step.detail = `Image analyzed: ${description.slice(0, 100)}…`;
      step.durationMs = Date.now() - t;
    } catch (e) {
      step.status = "skipped";
      step.detail = `VLM failed: ${(e as Error).message}`;
    }
  }

  // ─── Step 4: Web Search ───
  if (wantWeb) {
    const step: EnhancementStep = { id: "s4", skill: "web", label: "Web Grounding (Search)", status: "running" };
    steps.push(step);
    const t = Date.now();
    try {
      const hits = await webSearch(message, 5);
      result.webResults = hits;
      const ctx = hits.map((h, i) => `[${i + 1}] ${h.name}\n    ${h.snippet}\n    — ${h.host_name}`).join("\n");
      inputText = `${inputText}\n\n[Fresh web context — cite as [n]]:\n${ctx}`;
      step.status = "done";
      step.detail = `${hits.length} sources retrieved`;
      step.durationMs = Date.now() - t;
    } catch (e) {
      step.status = "skipped";
      step.detail = `Web search failed: ${(e as Error).message}`;
    }
  }

  // ─── Step 5: Memory Recall ───
  if (wantMemory) {
    const step: EnhancementStep = { id: "s5", skill: "memory", label: "Memory Recall (Vector)", status: "running" };
    steps.push(step);
    const t = Date.now();
    try {
      const qv = embed(message);
      const all = await db.memory.findMany({ orderBy: { createdAt: "desc" }, take: 100 });
      const scored = all
        .map((m) => {
          const v = deserialize(m.embedding);
          return { m, score: v ? cosine(qv, v) : 0 };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
      const recalled = scored.map(({ m, score }) => ({ content: m.content, score, kind: m.kind }));
      result.memories = recalled;
      if (recalled.length > 0) {
        const ctx = recalled.map((r, i) => `[Memory ${i + 1}] (relevance ${r.score.toFixed(2)}) ${r.content}`).join("\n");
        inputText = `${inputText}\n\n[Recalled memories — personal context]:\n${ctx}`;
      }
      step.status = "done";
      step.detail = `${recalled.length} memories recalled (top score ${recalled[0]?.score.toFixed(2) ?? 0})`;
      step.durationMs = Date.now() - t;
    } catch (e) {
      step.status = "skipped";
      step.detail = `Memory recall failed: ${(e as Error).message}`;
    }
  }

  // ─── Step 6: Multi-step Decomposition ───
  let subQuestions: string[] = [];
  let subAnswers: { question: string; answer: string }[] = [];

  if (wantMultiStep) {
    const decompStep: EnhancementStep = { id: "s6", skill: "decompose", label: "Query Decomposition (Multi-step)", status: "running" };
    steps.push(decompStep);
    const t = Date.now();
    try {
      const decomp = await chatJSON<{ subQuestions: string[] }>(
        `Decompose this query into 2-4 sub-questions that, when answered, would give a comprehensive answer. Return JSON {"subQuestions": ["...", "..."]}.\n\nQuery: "${message}"`,
        { system: "You are a query decomposition engine. Return only valid JSON.", temperature: 0.3, maxTokens: 300 },
      );
      subQuestions = decomp.subQuestions?.slice(0, 4) ?? [];
      decompStep.status = "done";
      decompStep.detail = `${subQuestions.length} sub-questions generated`;
      decompStep.data = subQuestions;
      decompStep.durationMs = Date.now() - t;
      result.subQuestions = subQuestions;
    } catch (e) {
      decompStep.status = "skipped";
      decompStep.detail = `Decomposition failed: ${(e as Error).message}`;
    }

    // Answer each sub-question
    if (subQuestions.length > 0) {
      for (let i = 0; i < subQuestions.length; i++) {
        const sq = subQuestions[i];
        const subStep: EnhancementStep = { id: `s6.${i + 1}`, skill: "sub-answer", label: `Sub-answer ${i + 1}/${subQuestions.length}`, status: "running" };
        steps.push(subStep);
        const st = Date.now();
        try {
          const answer = await chat(sq, {
            system: `${SYSTEM_PROMPT}\n\nContext from enhancement steps:\n${inputText}`,
            temperature: 0.5,
            maxTokens: 400,
          });
          subAnswers.push({ question: sq, answer });
          subStep.status = "done";
          subStep.detail = `Q: ${sq.slice(0, 60)}…`;
          subStep.durationMs = Date.now() - st;
        } catch (e) {
          subStep.status = "skipped";
          subStep.detail = `Failed: ${(e as Error).message}`;
        }
      }
      result.subAnswers = subAnswers;
      // Add sub-answers to context
      const subCtx = subAnswers.map((sa, i) => `[Sub-answer ${i + 1}] Q: ${sa.question}\nA: ${sa.answer}`).join("\n\n");
      inputText = `${inputText}\n\n[Multi-step sub-answers]:\n${subCtx}`;
    }
  }

  // ─── Step 7: Synthesize ───
  const synthStep: EnhancementStep = { id: "s7", skill: "synthesize", label: "Synthesis", status: "running" };
  steps.push(synthStep);
  const t7 = Date.now();
  try {
    const synthesized = await chat(
      `Answer this query using ALL the enhancement context provided below. Integrate insights from vision, web, memory, and sub-answers. Be comprehensive and cite sources.\n\nOriginal query: ${message}\n\n${inputText}`,
      { system: SYSTEM_PROMPT, thinking: routing.thinking, temperature: 0.6, maxTokens: 900 },
    );
    result.synthesizedAnswer = synthesized;
    synthStep.status = "done";
    synthStep.detail = `Synthesized ${synthesized.length} chars`;
    synthStep.durationMs = Date.now() - t7;
  } catch (e) {
    synthStep.status = "skipped";
    synthStep.detail = `Synthesis failed: ${(e as Error).message}`;
    result.synthesizedAnswer = "Synthesis failed.";
  }

  // ─── Step 8: Self-Critique ───
  if (wantCritique && result.synthesizedAnswer) {
    const critiqueStep: EnhancementStep = { id: "s8", skill: "critique", label: "Self-Critique (Gap Detection)", status: "running" };
    steps.push(critiqueStep);
    const t8 = Date.now();
    try {
      const critique = await chat(
        `Critique this answer for gaps, omissions, or parts the LLM might have skipped that could make a big difference. Identify 1-3 specific improvements. Be concise.\n\nQuery: ${message}\n\nAnswer: ${result.synthesizedAnswer}`,
        { system: "You are a rigorous answer critic. Find what's missing or could be significantly better.", temperature: 0.4, maxTokens: 300 },
      );
      result.critique = critique;
      critiqueStep.status = "done";
      critiqueStep.detail = critique.slice(0, 80) + "…";
      critiqueStep.durationMs = Date.now() - t8;

      // ─── Step 9: Refine ───
      const refineStep: EnhancementStep = { id: "s9", skill: "refine", label: "Refinement", status: "running" };
      steps.push(refineStep);
      const t9 = Date.now();
      try {
        const refined = await chat(
          `Improve this answer based on the critique. Address every gap identified. Deliver the best possible answer.\n\nOriginal answer: ${result.synthesizedAnswer}\n\nCritique: ${critique}\n\nEnhancement context: ${inputText}`,
          { system: SYSTEM_PROMPT, thinking: routing.thinking, temperature: 0.5, maxTokens: 1000 },
        );
        result.refinedAnswer = refined;
        refineStep.status = "done";
        refineStep.detail = `Refined ${refined.length} chars`;
        refineStep.durationMs = Date.now() - t9;
      } catch (e) {
        refineStep.status = "skipped";
        refineStep.detail = `Refinement failed: ${(e as Error).message}`;
        result.refinedAnswer = result.synthesizedAnswer;
      }
    } catch (e) {
      critiqueStep.status = "skipped";
      critiqueStep.detail = `Critique failed: ${(e as Error).message}`;
      result.refinedAnswer = result.synthesizedAnswer;
    }
  } else {
    result.refinedAnswer = result.synthesizedAnswer;
  }

  // ─── Step 10: Audio Output (TTS) ───
  if (wantVoice && result.refinedAnswer) {
    const voiceStep: EnhancementStep = { id: "s10", skill: "audio-out", label: "Voice Output (TTS)", status: "running" };
    steps.push(voiceStep);
    const t10 = Date.now();
    try {
      const audio = await textToSpeechBase64(result.refinedAnswer.slice(0, 500));
      result.audioOutput = audio;
      voiceStep.status = "done";
      voiceStep.detail = "Speech synthesized";
      voiceStep.durationMs = Date.now() - t10;
    } catch (e) {
      voiceStep.status = "skipped";
      voiceStep.detail = `TTS failed: ${(e as Error).message}`;
    }
  }

  result.durationMs = Date.now() - started;
  await logger.info("orchestrator", `Enhancement pipeline complete: ${steps.length} steps, ${result.durationMs}ms`);

  return NextResponse.json(result);
}
