"use client";
/**
 * EnhancedConsole — the Cognitive Enhancement Pipeline UI.
 *
 * Lets any LLM (even cheap text-only ones) use skills they don't natively have:
 * vision (VLM), audio I/O (ASR/TTS), web grounding, memory recall, multi-step
 * reasoning, and self-critique. Shows each pipeline step transparently.
 */
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Eye, Globe, Brain, Zap, Shield, Volume2, Image as ImageIcon,
  Mic, RotateCw, Check, X, Skip, ChevronRight, Sparkles, Cpu, AlertCircle,
  Clock, FileText, Layers,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface EnhancementStep {
  id: string;
  skill: string;
  label: string;
  status: "pending" | "running" | "done" | "skipped";
  detail?: string;
  durationMs?: number;
}

interface EnhanceResult {
  steps: EnhancementStep[];
  analysis: { complexity: number; route: string; model: string; recommendedSkills: string[]; reasoning: string };
  visionDescription?: string;
  transcript?: string;
  webResults?: { url: string; name: string; snippet: string; host_name: string }[];
  memories?: { content: string; score: number; kind: string }[];
  subQuestions?: string[];
  subAnswers?: { question: string; answer: string }[];
  synthesizedAnswer: string;
  critique?: string;
  refinedAnswer: string;
  audioOutput?: string;
  durationMs: number;
}

const SKILL_META: Record<string, { icon: React.ElementType; color: string; label: string; desc: string }> = {
  vision: { icon: Eye, color: "var(--a_core)", label: "Vision", desc: "Image analysis via VLM" },
  "audio-in": { icon: Mic, color: "var(--a_active)", label: "Audio In", desc: "Speech-to-text (ASR)" },
  web: { icon: Globe, color: "var(--a_active)", label: "Web", desc: "Fresh web grounding" },
  memory: { icon: Brain, color: "var(--a_core)", label: "Memory", desc: "Vector recall" },
  "multi-step": { icon: Layers, color: "var(--a_warn)", label: "Multi-step", desc: "Decompose + sub-answers" },
  critique: { icon: Shield, color: "var(--a_danger)", label: "Critique", desc: "Gap detection + refine" },
  "audio-out": { icon: Volume2, color: "var(--a_active)", label: "Voice", desc: "Text-to-speech (TTS)" },
};

const STEP_ICON: Record<string, React.ElementType> = {
  analyze: Cpu, vision: Eye, "audio-in": Mic, web: Globe, memory: Brain,
  decompose: Layers, "sub-answer": ChevronRight, synthesize: Sparkles,
  critique: Shield, refine: Zap, "audio-out": Volume2,
};

export function EnhancedConsole() {
  const [message, setMessage] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<EnhanceResult | null>(null);
  const [skills, setSkills] = useState<Record<string, boolean>>({
    vision: false, web: true, memory: true, "multi-step": true, critique: true, "audio-out": false,
  });
  const [liveSteps, setLiveSteps] = useState<EnhancementStep[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioRef.current = new Audio();
  }, []);

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setImageBase64(base64);
      setSkills((s) => ({ ...s, vision: true }));
    };
    reader.readAsDataURL(file);
  }

  async function run() {
    if (!message.trim() || running) return;
    setRunning(true);
    setResult(null);
    setLiveSteps([{ id: "init", skill: "analyze", label: "Initializing pipeline", status: "running" }]);

    try {
      const res = await fetch("/api/aeon/enhance", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          imageBase64: imageBase64 ?? undefined,
          enableVision: skills.vision,
          enableWeb: skills.web,
          enableMemory: skills.memory,
          enableMultiStep: skills["multi-step"],
          enableCritique: skills.critique,
          enableVoice: skills["audio-out"],
        }),
      });
      const data = (await res.json()) as EnhanceResult;
      setResult(data);
      setLiveSteps(data.steps);
      toast.success(`Pipeline complete: ${data.steps.length} steps in ${(data.durationMs / 1000).toFixed(1)}s`);
    } catch (e) {
      toast.error("Pipeline failed");
      setLiveSteps([]);
    } finally {
      setRunning(false);
    }
  }

  function playAudio() {
    if (result?.audioOutput && audioRef.current) {
      audioRef.current.src = result.audioOutput;
      void audioRef.current.play();
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <Card className="border-[oklch(0.82_0.15_75)]/30 bg-card/40">
        <CardContent className="p-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[oklch(0.82_0.15_75)]/40 bg-[oklch(0.82_0.15_75)]/10">
              <Sparkles className="h-4 w-4 text-[oklch(0.82_0.15_75)]" />
            </div>
            <div className="flex-1">
              <h3 className="font-mono text-sm font-bold text-foreground">COGNITIVE ENHANCEMENT PIPELINE</h3>
              <p className="text-[10px] text-muted-foreground">
                Gives any LLM capabilities it doesn&apos;t natively have: vision, audio, web grounding, memory, multi-step reasoning, and self-critique.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
        {/* Main column: input + pipeline + result */}
        <div className="flex min-h-0 flex-col gap-3">
          {/* Input */}
          <Card className="border-border bg-card/40">
            <CardContent className="p-3">
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask anything — the pipeline will enhance the LLM with the skills it needs…"
                className="min-h-[60px] resize-none border-border/60 bg-background/60 text-sm"
                disabled={running}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void run(); }
                }}
              />
              {/* Image preview */}
              {imageBase64 && (
                <div className="mt-2 flex items-center gap-2">
                  <img src={imageBase64} alt="upload" className="h-12 w-12 rounded-md border border-border object-cover" />
                  <Button size="sm" variant="ghost" onClick={() => { setImageBase64(null); setSkills((s) => ({ ...s, vision: false })); }} className="h-7 gap-1 text-muted-foreground">
                    <X className="h-3 w-3" /> Remove
                  </Button>
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={running} className="h-7 gap-1 text-xs">
                  <ImageIcon className="h-3 w-3" /> Image
                </Button>
                <Button size="sm" onClick={run} disabled={running || !message.trim()} className="ml-auto gap-1.5 bg-[oklch(0.82_0.15_75)] text-[oklch(0.16_0.02_70)] hover:brightness-110">
                  {running ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  {running ? "Running…" : "Run Pipeline"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline steps */}
          {(liveSteps.length > 0 || running) && (
            <Card className="border-border bg-black/20">
              <CardContent className="p-3">
                <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <Zap className="h-3 w-3 text-[oklch(0.82_0.15_75)]" /> enhancement pipeline
                  {result && <span className="ml-auto font-mono text-[oklch(0.82_0.15_75)]">{result.durationMs}ms</span>}
                </div>
                <div className="space-y-1">
                  <AnimatePresence initial={false}>
                    {liveSteps.map((step) => {
                      const Icon = STEP_ICON[step.skill] ?? Cpu;
                      const color =
                        step.status === "done" ? "var(--a_active)" :
                        step.status === "running" ? "var(--a_core)" :
                        step.status === "skipped" ? "var(--muted-foreground)" : "var(--muted-foreground)";
                      return (
                        <motion.div
                          key={step.id}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center gap-2 rounded-md bg-background/30 px-2 py-1.5"
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" style={{ color }} />
                          <span className="font-mono text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
                            {step.label}
                          </span>
                          {step.status === "running" && <RotateCw className="h-3 w-3 animate-spin text-[oklch(0.82_0.15_75)]" />}
                          {step.status === "done" && <Check className="h-3 w-3 text-[oklch(0.74_0.16_158)]" />}
                          {step.status === "skipped" && <Skip className="h-3 w-3 text-muted-foreground" />}
                          {step.detail && <span className="min-w-0 flex-1 truncate text-[10px] text-muted-foreground">{step.detail}</span>}
                          {step.durationMs && <span className="ml-auto font-mono text-[9px] text-muted-foreground">{step.durationMs}ms</span>}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Result */}
          {result && (
            <Card className="min-h-0 flex-1 border-border bg-card/40">
              <CardContent className="aeon-scroll max-h-[500px] overflow-y-auto p-3">
                <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <FileText className="h-3 w-3 text-[oklch(0.82_0.15_75)]" /> enhanced answer
                  <Badge variant="outline" className="ml-auto border-border/60 font-mono text-[9px]" style={{ color: result.analysis.route === "cloud" ? "var(--a_core)" : "var(--a_active)" }}>
                    {result.analysis.model}
                  </Badge>
                </div>

                {/* Vision description */}
                {result.visionDescription && (
                  <DetailBlock icon={Eye} label="Vision Analysis" color="var(--a_core)">
                    {result.visionDescription}
                  </DetailBlock>
                )}

                {/* Web results */}
                {result.webResults && result.webResults.length > 0 && (
                  <DetailBlock icon={Globe} label="Web Sources" color="var(--a_active)">
                    <div className="space-y-1">
                      {result.webResults.map((w, i) => (
                        <a key={i} href={w.url} target="_blank" rel="noreferrer" className="block rounded-sm bg-background/40 px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground">
                          <span className="font-mono text-[oklch(0.72_0.18_55)]">[{i + 1}]</span> {w.host_name} — {w.name.slice(0, 60)}
                        </a>
                      ))}
                    </div>
                  </DetailBlock>
                )}

                {/* Memories */}
                {result.memories && result.memories.length > 0 && (
                  <DetailBlock icon={Brain} label="Recalled Memories" color="var(--a_core)">
                    <div className="space-y-1">
                      {result.memories.map((m, i) => (
                        <div key={i} className="rounded-sm bg-background/40 px-2 py-1 text-[10px]">
                          <span className="font-mono text-[oklch(0.82_0.15_75)]">({m.score.toFixed(2)})</span> {m.content.slice(0, 80)}…
                        </div>
                      ))}
                    </div>
                  </DetailBlock>
                )}

                {/* Sub-answers */}
                {result.subAnswers && result.subAnswers.length > 0 && (
                  <DetailBlock icon={Layers} label="Multi-step Sub-answers" color="var(--a_warn)">
                    <div className="space-y-2">
                      {result.subAnswers.map((sa, i) => (
                        <div key={i} className="rounded-sm bg-background/40 px-2 py-1.5 text-[10px]">
                          <div className="font-mono text-[oklch(0.72_0.18_55)]">Q{i + 1}: {sa.question}</div>
                          <div className="mt-0.5 text-muted-foreground">{sa.answer.slice(0, 150)}…</div>
                        </div>
                      ))}
                    </div>
                  </DetailBlock>
                )}

                {/* Critique */}
                {result.critique && (
                  <DetailBlock icon={Shield} label="Self-Critique" color="var(--a_danger)">
                    {result.critique}
                  </DetailBlock>
                )}

                {/* Final refined answer */}
                <div className="mt-3 rounded-md border border-[oklch(0.82_0.15_75)]/30 bg-[oklch(0.82_0.15_75)]/5 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest text-[oklch(0.82_0.15_75)]">
                    <Sparkles className="h-2.5 w-2.5" /> Final Enhanced Answer
                  </div>
                  <div className="prose prose-invert prose-sm max-w-none text-foreground/90 [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:font-mono [&_code]:text-[11px] [&_code]:text-[oklch(0.82_0.15_75)]">
                    <ReactMarkdown>{result.refinedAnswer}</ReactMarkdown>
                  </div>
                </div>

                {/* Audio playback */}
                {result.audioOutput && (
                  <div className="mt-2 flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={playAudio} className="h-7 gap-1 text-xs">
                      <Volume2 className="h-3 w-3" /> Play Voice
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Side column: skill toggles */}
        <div className="flex flex-col gap-3">
          <Card className="border-border bg-card/40">
            <CardContent className="p-3">
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Cpu className="h-3 w-3 text-[oklch(0.82_0.15_75)]" /> enhancement skills
              </div>
              <p className="mb-2 text-[10px] text-muted-foreground">
                Toggle skills to give the LLM capabilities it doesn&apos;t natively have:
              </p>
              <div className="space-y-1.5">
                {Object.entries(SKILL_META).map(([key, meta]) => {
                  const Icon = meta.icon;
                  const active = skills[key];
                  const autoOn = key === "web" || key === "memory" || key === "multi-step" || key === "critique";
                  return (
                    <button
                      key={key}
                      onClick={() => setSkills((s) => ({ ...s, [key]: !s[key] }))}
                      className="group flex w-full items-center gap-2 rounded-md border px-2.5 py-2 text-left transition"
                      style={{
                        borderColor: active ? `color-mix(in oklch, ${meta.color} 40%, transparent)` : "var(--border)",
                        background: active ? `color-mix(in oklch, ${meta.color} 8%, transparent)` : "transparent",
                      }}
                    >
                      <div
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border"
                        style={{
                          borderColor: active ? `color-mix(in oklch, ${meta.color} 40%, transparent)` : "var(--border)",
                          background: active ? `color-mix(in oklch, ${meta.color} 14%, transparent)` : "transparent",
                        }}
                      >
                        <Icon className="h-3 w-3" style={{ color: active ? meta.color : "var(--muted-foreground)" }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium" style={{ color: active ? meta.color : "var(--foreground)" }}>{meta.label}</div>
                        <div className="text-[9px] text-muted-foreground">{meta.desc}</div>
                      </div>
                      <div className="h-2 w-2 rounded-full" style={{ background: active ? meta.color : "var(--muted-foreground)", opacity: active ? 1 : 0.3 }} />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Analysis card */}
          {result && (
            <Card className="border-border bg-card/40">
              <CardContent className="p-3">
                <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                  <AlertCircle className="h-3 w-3 text-[oklch(0.82_0.15_75)]" /> routing analysis
                </div>
                <div className="space-y-1.5 text-[10px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Route</span>
                    <span className="font-mono font-bold" style={{ color: result.analysis.route === "cloud" ? "var(--a_core)" : "var(--a_active)" }}>
                      {result.analysis.route.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Model</span>
                    <span className="font-mono text-foreground/80">{result.analysis.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Complexity</span>
                    <span className="font-mono text-[oklch(0.82_0.15_75)]">{result.analysis.complexity.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-border/30">
                      <div className="h-full rounded-full bg-[oklch(0.82_0.15_75)]" style={{ width: `${result.analysis.complexity * 100}%` }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailBlock({ icon: Icon, label, color, children }: { icon: React.ElementType; label: string; color: string; children: React.ReactNode }) {
  return (
    <div className="mb-2 rounded-md border border-border/40 bg-background/30 p-2">
      <div className="mb-1 flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-widest" style={{ color }}>
        <Icon className="h-2.5 w-2.5" /> {label}
      </div>
      <div className="text-[11px] leading-relaxed text-muted-foreground">{children}</div>
    </div>
  );
}
