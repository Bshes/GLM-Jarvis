"use client";
/**
 * SensoryPanel — multimodal sensory I/O.
 * Text + voice (ASR) input, TTS spoken output, biometric/vision event injection,
 * and the live sensory feed. Mirrors the Whisper STT + ElevenLabs TTS + wearable
 * parser modules from the Python spec.
 */
import { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Mic, MicOff, Volume2, Square, Send, Radio, Heart, Eye, Ear, Activity, Waves,
} from "lucide-react";
import { useAeon } from "@/lib/store";
import { StatusDot, timeAgo } from "@/components/aeon/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const CHANNEL_META: Record<string, { icon: React.ElementType; color: string }> = {
  audio: { icon: Ear, color: "var(--aeon-active)" },
  biometric: { icon: Heart, color: "var(--aeon-danger)" },
  vision: { icon: Eye, color: "var(--aeon-core)" },
  text: { icon: Send, color: "var(--aeon-think)" },
  system: { icon: Activity, color: "var(--muted-foreground)" },
};

export function SensoryPanel() {
  const sensory = useAeon((s) => s.sensory);
  const refresh = useAeon((s) => s.refresh);
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [ttsText, setTtsText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [bioMetric, setBioMetric] = useState("heart_rate");
  const [bioValue, setBioValue] = useState("125");
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    audioElRef.current = new Audio();
    return () => {
      mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
      audioElRef.current?.pause();
    };
  }, []);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size > 0 && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = (reader.result as string).split(",")[1] ?? "";
          setTranscribing(true);
          try {
            const res = await fetch("/api/aeon/asr", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ base64 }),
            });
            const data = await res.json();
            if (data.text) {
              setText((t) => (t ? t + " " : "") + data.text);
              toast.success("Transcribed");
            } else {
              toast.error("No speech detected");
            }
          } catch {
            toast.error("ASR failed");
          } finally {
            setTranscribing(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
    } catch {
      toast.error("Microphone access denied");
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    setRecording(false);
  }

  async function speak() {
    if (!ttsText.trim() || speaking) return;
    setSpeaking(true);
    try {
      const res = await fetch("/api/aeon/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: ttsText }),
      });
      const data = await res.json();
      if (data.audio && audioElRef.current) {
        audioElRef.current.src = data.audio;
        audioElRef.current.onended = () => setSpeaking(false);
        await audioElRef.current.play();
        toast.success("Speaking…");
      }
    } catch {
      toast.error("TTS failed");
      setSpeaking(false);
    }
  }

  function stopSpeak() {
    audioElRef.current?.pause();
    setSpeaking(false);
  }

  async function injectBiometric() {
    const v = Number(bioValue);
    if (Number.isNaN(v)) return toast.error("Value must be numeric");
    await fetch("/api/aeon/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "biometric", metric: bioMetric, value: v, severity: v > 110 ? "warn" : "info" }),
    });
    // Evaluate triggers right away.
    await fetch("/api/aeon/triggers/evaluate");
    await refresh();
    toast.success(`Injected ${bioMetric}=${v}`);
  }

  const stats = {
    total: sensory.length,
    biometric: sensory.filter((e) => e.channel === "biometric").length,
    audio: sensory.filter((e) => e.channel === "audio").length,
    vision: sensory.filter((e) => e.channel === "vision").length,
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total Events" value={String(stats.total)} accent="var(--aeon-core)" />
        <Stat label="Biometric" value={String(stats.biometric)} accent="var(--aeon-danger)" icon={Heart} />
        <Stat label="Audio" value={String(stats.audio)} accent="var(--aeon-active)" icon={Ear} />
        <Stat label="Vision" value={String(stats.vision)} accent="var(--aeon-think)" icon={Eye} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Voice input (ASR) */}
        <Card className="border-border bg-card/40">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Mic className="h-3 w-3" /> voice input · whisper asr
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={recording ? stopRecording : startRecording}
                disabled={transcribing}
                className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 transition disabled:opacity-50"
                style={{
                  borderColor: recording ? "var(--aeon-danger)" : "var(--aeon-active)",
                  background: recording ? "color-mix(in oklch, var(--aeon-danger) 16%, transparent)" : "color-mix(in oklch, var(--aeon-active) 10%, transparent)",
                }}
              >
                {recording && (
                  <span className="absolute inset-0 rounded-full border-2 border-[var(--aeon-danger)] animate-aeon-pulse" />
                )}
                {recording ? <MicOff className="h-5 w-5 text-[var(--aeon-danger)]" /> : <Mic className="h-5 w-5 text-[var(--aeon-active)]" />}
              </button>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">
                  {transcribing ? "Transcribing…" : recording ? "Listening — tap to stop" : "Tap to speak"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {recording ? <Waves className="inline h-3 w-3 animate-pulse" /> : "local whisper model"}
                </div>
              </div>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Transcribed speech appears here…"
              className="mt-3 min-h-[60px] resize-none border-border/60 bg-background/60 font-mono text-sm"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setText("")} className="text-muted-foreground">Clear</Button>
              <Button size="sm" onClick={() => setTtsText(text)} disabled={!text.trim()} className="ml-auto gap-1.5 bg-[var(--aeon-core)] text-[var(--primary-foreground)] hover:brightness-110">
                <Volume2 className="h-3.5 w-3.5" /> To TTS
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Speech output (TTS) */}
        <Card className="border-border bg-card/40">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Volume2 className="h-3 w-3" /> speech output · tts
            </div>
            <Textarea
              value={ttsText}
              onChange={(e) => setTtsText(e.target.value)}
              placeholder="Text for A.E.O.N. to speak aloud…"
              className="min-h-[96px] resize-none border-border/60 bg-background/60 text-sm"
            />
            <div className="mt-2 flex items-center gap-2">
              {speaking ? (
                <Button size="sm" onClick={stopSpeak} className="gap-1.5 border-[var(--aeon-danger)]/40 bg-[var(--aeon-danger)]/10 text-[var(--aeon-danger)] hover:bg-[var(--aeon-danger)]/20">
                  <Square className="h-3.5 w-3.5" /> Stop
                </Button>
              ) : (
                <Button size="sm" onClick={speak} disabled={!ttsText.trim()} className="gap-1.5 bg-[var(--aeon-active)] text-[var(--primary-foreground)] hover:brightness-110">
                  <Volume2 className="h-3.5 w-3.5" /> Speak
                </Button>
              )}
              {speaking && (
                <div className="flex items-center gap-1 text-[10px] text-[var(--aeon-active)]">
                  <Waves className="h-3 w-3 animate-pulse" /> synthesizing…
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Biometric injection */}
        <Card className="border-border bg-card/40">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Heart className="h-3 w-3" /> biometric injection · wearable parser
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[10px] text-muted-foreground">Metric</label>
                <select
                  value={bioMetric}
                  onChange={(e) => setBioMetric(e.target.value)}
                  className="h-9 w-full rounded-md border border-border/60 bg-background/60 px-2 text-sm"
                >
                  <option value="heart_rate">heart_rate (bpm)</option>
                  <option value="sleep_hours">sleep_hours</option>
                  <option value="steps">steps</option>
                  <option value="stress_index">stress_index</option>
                  <option value="posture">posture (deg)</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] text-muted-foreground">Value</label>
                <Input
                  type="number"
                  value={bioValue}
                  onChange={(e) => setBioValue(e.target.value)}
                  className="h-9 border-border/60 bg-background/60 font-mono text-sm"
                />
              </div>
            </div>
            <Button size="sm" onClick={injectBiometric} className="mt-3 w-full gap-1.5 bg-[var(--aeon-danger)]/90 text-white hover:brightness-110">
              <Radio className="h-3.5 w-3.5" /> Inject & Evaluate Triggers
            </Button>
            <p className="mt-2 text-[10px] text-muted-foreground">
              Injecting a heart_rate &gt; 110 fires the anticipatory focus-break trigger (tier 1).
            </p>
          </CardContent>
        </Card>

        {/* Vision parser mock */}
        <Card className="border-border bg-card/40">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Eye className="h-3 w-3" /> vision parser · camera feed
            </div>
            <div className="relative flex h-[120px] items-center justify-center overflow-hidden rounded-md border border-border/60 bg-black/50 aeon-scanline">
              <div className="text-center">
                <Eye className="mx-auto h-7 w-7 text-[var(--aeon-think)]/60" />
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">CAM_01 · PORCH</p>
                <p className="text-[9px] text-[var(--aeon-active)]">● streaming · no motion</p>
              </div>
              <div className="pointer-events-none absolute inset-0 border border-[var(--aeon-core)]/20" />
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={async () => {
                await fetch("/api/aeon/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channel: "vision", metric: "motion", value: true, severity: "warn" }) });
                await fetch("/api/aeon/triggers/evaluate");
                await refresh();
                toast.success("Motion event injected");
              }} className="gap-1.5 text-[var(--aeon-warn)]">
                <Radio className="h-3.5 w-3.5" /> Simulate Motion
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* sensory feed */}
      <Card className="min-h-0 flex-1 border-border bg-black/20">
        <CardContent className="p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Activity className="h-3 w-3" /> sensory feed
          </div>
          <div className="aeon-scroll max-h-[260px] space-y-1 overflow-y-auto pr-1">
            {sensory.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No sensory events yet.</div>
            ) : (
              sensory.map((e) => {
                const meta = CHANNEL_META[e.channel] ?? CHANNEL_META.system;
                const Icon = meta.icon;
                let detail = e.value;
                try { detail = JSON.stringify(JSON.parse(e.value)); } catch { /* keep raw */ }
                return (
                  <motion.div key={e.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 rounded-sm bg-background/30 px-2 py-1.5">
                    <Icon className="h-3 w-3 shrink-0" style={{ color: meta.color }} />
                    <Badge variant="outline" className="border-border/60 font-mono text-[9px]" style={{ color: meta.color }}>{e.channel}</Badge>
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/80">{detail}</span>
                    <StatusDot status={e.severity === "critical" ? "error" : e.severity === "warn" ? "busy" : "online"} />
                    <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(e.createdAt)}</span>
                  </motion.div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ label, value, accent, icon: Icon }: { label: string; value: string; accent: string; icon?: React.ElementType }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border bg-card/40 p-3">
      <div className="absolute left-0 top-0 h-full w-0.5" style={{ background: accent }} />
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" style={{ color: accent }} />} {label}
      </div>
      <div className="mt-1 font-mono text-lg font-bold" style={{ color: accent }}>{value}</div>
    </div>
  );
}
