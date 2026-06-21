"use client";
/**
 * SensoryPanel — multimodal sensory I/O (VISUALLY POLISHED).
 * Text + voice (ASR) input with animated rings, TTS playback with waveform,
 * biometric/vision event injection with dramatic feedback, surveillance-style
 * camera overlay, and animated sensory feed.
 */
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Volume2, Square, Send, Radio, Heart, Eye, Ear, Activity, Waves,
  Moon, Footprints, Brain, Timer, Signal, CircleDot,
} from "lucide-react";
import { useAeon } from "@/lib/store";
import { StatusDot, timeAgo } from "@/components/aeon/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

/* ─── Channel metadata ─── */
const CHANNEL_META: Record<string, { icon: React.ElementType; color: string }> = {
  audio: { icon: Ear, color: "var(--aeon-active)" },
  biometric: { icon: Heart, color: "var(--aeon-danger)" },
  vision: { icon: Eye, color: "var(--aeon-core)" },
  text: { icon: Send, color: "var(--aeon-think)" },
  system: { icon: Activity, color: "var(--muted-foreground)" },
};

/* ─── Biometric metric metadata (icon + animation) ─── */
const BIO_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  heart_rate: { icon: Heart, color: "var(--aeon-danger)", label: "bpm" },
  sleep_hours: { icon: Moon, color: "var(--aeon-think)", label: "hrs" },
  steps: { icon: Footprints, color: "var(--aeon-active)", label: "steps" },
  stress_index: { icon: Brain, color: "var(--aeon-warn)", label: "idx" },
  posture: { icon: Activity, color: "var(--aeon-core)", label: "deg" },
};

/* ─── HUD corner bracket component ─── */
function HudCorners({ size = 14, color = "var(--aeon-core)" }: { size?: number; color?: string }) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ color }} aria-hidden>
      {/* top-left */}
      <line x1="0" y1={size} x2="0" y2="0" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <line x1="0" y1="0" x2={size} y2="0" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      {/* top-right */}
      <line x1="100%" y1={size} x2="100%" y2="0" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <line x1="100%" y1="0" x2={`calc(100% - ${size}px)`} y2="0" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      {/* bottom-left */}
      <line x1="0" y1={`calc(100% - ${size}px)`} x2="0" y2="100%" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <line x1="0" y1="100%" x2={size} y2="100%" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      {/* bottom-right */}
      <line x1="100%" y1={`calc(100% - ${size}px)`} x2="100%" y2="100%" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      <line x1="100%" y1="100%" x2={`calc(100% - ${size}px)`} y2="100%" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
    </svg>
  );
}

/* ─── Animated voice rings (concentric, scaling + fading) ─── */
function VoiceRings() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute h-14 w-14 rounded-full border-2"
          style={{ borderColor: "var(--aeon-active)" }}
          initial={{ scale: 1, opacity: 0.6 }}
          animate={{
            scale: [1, 2.2 + i * 0.4],
            opacity: [0.5, 0],
          }}
          transition={{
            duration: 1.8,
            delay: i * 0.35,
            repeat: Infinity,
            ease: "easeOut",
          }}
        />
      ))}
    </div>
  );
}

/* ─── Animated waveform sine wave for recording ─── */
function RecordingWaveform() {
  const pathRef = useRef<SVGPathElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    let t = 0;
    const animate = () => {
      t += 0.06;
      if (pathRef.current) {
        const points: string[] = [];
        for (let x = 0; x <= 200; x += 2) {
          const y =
            20 +
            Math.sin((x / 200) * Math.PI * 4 + t) * 6 * Math.sin((x / 200) * Math.PI) +
            Math.sin((x / 200) * Math.PI * 7 + t * 1.3) * 3 * Math.sin((x / 200) * Math.PI);
          points.push(`${x === 0 ? "M" : "L"}${x},${y.toFixed(1)}`);
        }
        pathRef.current.setAttribute("d", points.join(" "));
      }
      frameRef.current = requestAnimationFrame(animate);
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameRef.current);
  }, []);

  return (
    <svg viewBox="0 0 200 40" className="h-8 w-full" preserveAspectRatio="none">
      <path
        ref={pathRef}
        fill="none"
        stroke="var(--aeon-active)"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

/* ─── Heart-rate ECG line that draws itself ─── */
function EcgLine({ color = "var(--aeon-danger)", speed = 2.5 }: { color?: string; speed?: number }) {
  return (
    <svg viewBox="0 0 200 40" className="h-6 w-full" preserveAspectRatio="none">
      <motion.path
        d="M0,20 L30,20 L40,20 L48,8 L54,32 L60,14 L66,26 L72,20 L90,20 L100,20 L108,8 L114,32 L120,14 L126,26 L132,20 L150,20 L160,20 L168,8 L174,32 L180,14 L186,26 L192,20 L200,20"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0.3 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: speed, repeat: Infinity, ease: "easeInOut" }}
      />
    </svg>
  );
}

/* ─── TTS waveform bars (bouncing while speaking) ─── */
function TtsWaveform() {
  const bars = 24;
  return (
    <div className="flex h-6 items-center justify-center gap-[2px]">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          className="w-[3px] rounded-full"
          style={{ backgroundColor: "var(--aeon-active)", originY: 1 }}
          animate={{
            height: [4, 8 + Math.sin(i * 0.7) * 10, 4],
          }}
          transition={{
            duration: 0.5 + Math.random() * 0.4,
            repeat: Infinity,
            delay: i * 0.04,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/* ─── TTS progress bar ─── */
function TtsProgressBar({ progress }: { progress: number }) {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-border/40">
      <motion.div
        className="h-full rounded-full"
        style={{ backgroundColor: "var(--aeon-active)" }}
        initial={{ width: "0%" }}
        animate={{ width: `${Math.min(progress, 100)}%` }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      />
    </div>
  );
}

/* ─── Surveillance-style camera overlay ─── */
function CameraOverlay() {
  const [time, setTime] = useState("");
  const [signal, setSignal] = useState(4);

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString("en-GB", { hour12: false }));
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => setSignal(Math.floor(Math.random() * 2) + 3), 3000);
    return () => clearInterval(iv);
  }, []);

  return (
    <>
      {/* REC indicator */}
      <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
        <span className="animate-aeon-blink inline-block h-2 w-2 rounded-full bg-[var(--aeon-danger)]" />
        <span className="font-mono text-[10px] font-bold text-[var(--aeon-danger)]">REC</span>
      </div>
      {/* Timestamp */}
      <div className="absolute right-2.5 top-2.5 font-mono text-[10px] text-[var(--aeon-core)]">
        {time}
      </div>
      {/* CAM label */}
      <div className="absolute bottom-2 left-2.5 font-mono text-[9px] text-[var(--aeon-core)]/70">
        CAM_01 · PORCH
      </div>
      {/* Signal strength */}
      <div className="absolute bottom-2 right-2.5 flex items-center gap-[2px]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="w-[3px] rounded-sm"
            style={{
              height: `${4 + i * 3}px`,
              backgroundColor: i < signal ? "var(--aeon-active)" : "var(--border)",
              opacity: i < signal ? 0.8 : 0.3,
            }}
          />
        ))}
      </div>
      {/* Scanning line */}
      <motion.div
        className="pointer-events-none absolute left-0 h-[2px] w-full"
        style={{
          background: "linear-gradient(to right, transparent, var(--aeon-core), transparent)",
          opacity: 0.15,
        }}
        animate={{ top: ["0%", "100%"] }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
      {/* Corner brackets */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ color: "var(--aeon-core)" }} aria-hidden>
        <line x1="4" y1="18" x2="4" y2="4" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="4" y1="4" x2="18" y2="4" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="calc(100% - 18px)" y1="4" x2="calc(100% - 4px)" y2="4" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="calc(100% - 4px)" y1="4" x2="calc(100% - 4px)" y2="18" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="4" y1="calc(100% - 18px)" x2="4" y2="calc(100% - 4px)" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="4" y1="calc(100% - 4px)" x2="18" y2="calc(100% - 4px)" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="calc(100% - 18px)" y1="calc(100% - 4px)" x2="calc(100% - 4px)" y2="calc(100% - 4px)" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
        <line x1="calc(100% - 4px)" y1="calc(100% - 18px)" x2="calc(100% - 4px)" y2="calc(100% - 4px)" stroke="currentColor" strokeWidth="1.5" opacity="0.5" />
      </svg>
    </>
  );
}

/* ─── Stat tile with HUD styling ─── */
function Stat({ label, value, accent, icon: Icon }: { label: string; value: string; accent: string; icon?: React.ElementType }) {
  return (
    <div className="relative overflow-hidden rounded-lg border border-border/60 bg-card/40 p-3">
      <HudCorners size={10} color={accent} />
      <div className="absolute left-0 top-0 h-full w-[3px]" style={{ background: accent }} />
      <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
        {Icon && <Icon className="h-3 w-3" style={{ color: accent }} />} {label}
      </div>
      <div className="mt-0.5 font-mono text-lg font-bold" style={{ color: accent }}>{value}</div>
    </div>
  );
}

/* ─── Main panel ─── */
export function SensoryPanel() {
  const sensory = useAeon((s) => s.sensory);
  const refresh = useAeon((s) => s.refresh);

  // ASR state
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);

  // TTS state
  const [ttsText, setTtsText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [ttsProgress, setTtsProgress] = useState(0);
  const [ttsCompleted, setTtsCompleted] = useState(false);

  // Biometric state
  const [bioMetric, setBioMetric] = useState("heart_rate");
  const [bioValue, setBioValue] = useState("125");
  const [injecting, setInjecting] = useState(false);
  const [bioFlash, setBioFlash] = useState<string | null>(null); // "danger" | "active"

  // Refs
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const ttsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    audioElRef.current = new Audio();
    return () => {
      mediaRef.current?.stream.getTracks().forEach((t) => t.stop());
      audioElRef.current?.pause();
      if (ttsTimerRef.current) clearInterval(ttsTimerRef.current);
    };
  }, []);

  // ─── ASR ───
  const startRecording = useCallback(async () => {
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
  }, []);

  const stopRecording = useCallback(() => {
    mediaRef.current?.stop();
    setRecording(false);
  }, []);

  // ─── TTS ───
  const speak = useCallback(async () => {
    if (!ttsText.trim() || speaking) return;
    setSpeaking(true);
    setTtsCompleted(false);
    setTtsProgress(0);
    try {
      const res = await fetch("/api/aeon/tts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input: ttsText }),
      });
      const data = await res.json();
      if (data.audio && audioElRef.current) {
        audioElRef.current.src = data.audio;
        audioElRef.current.onended = () => {
          setSpeaking(false);
          setTtsCompleted(true);
          setTtsProgress(100);
          if (ttsTimerRef.current) clearInterval(ttsTimerRef.current);
          setTimeout(() => setTtsCompleted(false), 2000);
        };
        // Estimate duration ~150 words/min, ~5 chars/word
        const estDurationMs = (ttsText.length / 5) * (60000 / 150);
        const startTime = Date.now();
        ttsTimerRef.current = setInterval(() => {
          const elapsed = Date.now() - startTime;
          const pct = Math.min((elapsed / estDurationMs) * 100, 95);
          setTtsProgress(pct);
        }, 200);
        await audioElRef.current.play();
      }
    } catch {
      toast.error("TTS failed");
      setSpeaking(false);
    }
  }, [ttsText, speaking]);

  const stopSpeak = useCallback(() => {
    audioElRef.current?.pause();
    setSpeaking(false);
    setTtsProgress(0);
    if (ttsTimerRef.current) clearInterval(ttsTimerRef.current);
  }, []);

  // ─── Biometric injection with flash feedback ───
  const injectBiometric = useCallback(async () => {
    const v = Number(bioValue);
    if (Number.isNaN(v)) return toast.error("Value must be numeric");
    setInjecting(true);

    // Simulate brief progress
    await new Promise((r) => setTimeout(r, 600));

    await fetch("/api/aeon/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        channel: "biometric",
        metric: bioMetric,
        value: v,
        severity: v > 110 ? "warn" : "info",
      }),
    });
    await fetch("/api/aeon/triggers/evaluate");
    await refresh();

    // Flash feedback
    const isHigh = bioMetric === "heart_rate" && v > 110;
    setBioFlash(isHigh ? "danger" : "active");
    setTimeout(() => setBioFlash(null), 800);

    toast.success(`Injected ${bioMetric}=${v}${isHigh ? " — ELEVATED" : ""}`);
    setInjecting(false);
  }, [bioMetric, bioValue, refresh]);

  // ─── Vision motion injection ───
  const injectMotion = useCallback(async () => {
    await fetch("/api/aeon/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: "vision", metric: "motion", value: true, severity: "warn" }),
    });
    await fetch("/api/aeon/triggers/evaluate");
    await refresh();
    toast.success("Motion event injected");
  }, [refresh]);

  // ─── Stats ───
  const stats = useMemo(() => ({
    total: sensory.length,
    biometric: sensory.filter((e) => e.channel === "biometric").length,
    audio: sensory.filter((e) => e.channel === "audio").length,
    vision: sensory.filter((e) => e.channel === "vision").length,
  }), [sensory]);

  const currentBioMeta = BIO_META[bioMetric] ?? BIO_META.heart_rate;
  const BioIcon = currentBioMeta.icon;

  return (
    <div className="flex h-full flex-col gap-3">
      {/* ─── Stat tiles ─── */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Stat label="Total Events" value={String(stats.total)} accent="var(--aeon-core)" />
        <Stat label="Biometric" value={String(stats.biometric)} accent="var(--aeon-danger)" icon={Heart} />
        <Stat label="Audio" value={String(stats.audio)} accent="var(--aeon-active)" icon={Ear} />
        <Stat label="Vision" value={String(stats.vision)} accent="var(--aeon-think)" icon={Eye} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* ─── Voice input (ASR) ─── */}
        <Card className="relative overflow-hidden border-border/60 bg-card/40">
          <HudCorners size={12} color="var(--aeon-active)" />
          <CardContent className="p-4">
            <div className="mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Mic className="h-3 w-3" /> voice input · whisper asr
            </div>
            <div className="flex items-center gap-3">
              {/* Mic button with animated rings */}
              <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
                {recording && <VoiceRings />}
                <motion.button
                  onClick={recording ? stopRecording : startRecording}
                  disabled={transcribing}
                  className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full border-2 transition disabled:opacity-50"
                  style={{
                    borderColor: recording ? "var(--aeon-danger)" : "var(--aeon-active)",
                    background: recording
                      ? "color-mix(in oklch, var(--aeon-danger) 18%, transparent)"
                      : "color-mix(in oklch, var(--aeon-active) 12%, transparent)",
                    boxShadow: recording
                      ? "0 0 20px 2px color-mix(in oklch, var(--aeon-danger) 30%, transparent)"
                      : "0 0 12px 1px color-mix(in oklch, var(--aeon-active) 15%, transparent)",
                  }}
                  whileTap={{ scale: 0.92 }}
                  animate={recording ? { scale: [1, 1.06, 1] } : {}}
                  transition={recording ? { duration: 1.2, repeat: Infinity, ease: "easeInOut" } : {}}
                >
                  {recording ? (
                    <MicOff className="h-5 w-5 text-[var(--aeon-danger)]" />
                  ) : (
                    <Mic className="h-5 w-5 text-[var(--aeon-active)]" />
                  )}
                </motion.button>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-foreground">
                  {transcribing ? "Transcribing…" : recording ? "Listening — tap to stop" : "Tap to speak"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {recording ? <Waves className="inline h-3 w-3 animate-pulse" /> : "local whisper model"}
                </div>
                {/* Animated waveform while recording */}
                {recording && (
                  <motion.div className="mt-1.5" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
                    <RecordingWaveform />
                  </motion.div>
                )}
              </div>
            </div>
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Transcribed speech appears here…"
              className="mt-2.5 min-h-[52px] resize-none border-border/60 bg-background/60 font-mono text-sm"
            />
            <div className="mt-2 flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => setText("")} className="text-muted-foreground">Clear</Button>
              <Button
                size="sm"
                onClick={() => { setTtsText(text); setTtsCompleted(false); }}
                disabled={!text.trim()}
                className="ml-auto gap-1.5 bg-[var(--aeon-core)] text-[var(--primary-foreground)] hover:brightness-110"
              >
                <Volume2 className="h-3.5 w-3.5" /> To TTS
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ─── Speech output (TTS) ─── */}
        <Card className="relative overflow-hidden border-border/60 bg-card/40">
          <HudCorners size={12} color={speaking ? "var(--aeon-active)" : "var(--aeon-core)"} />
          <CardContent className="p-4">
            <div className="mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Volume2 className="h-3 w-3" /> speech output · tts
              {speaking && (
                <Badge variant="outline" className="ml-auto border-[var(--aeon-active)]/50 font-mono text-[9px] text-[var(--aeon-active)]">
                  LIVE
                </Badge>
              )}
              {ttsCompleted && (
                <Badge variant="outline" className="ml-auto border-[var(--aeon-core)]/50 font-mono text-[9px] text-[var(--aeon-core)]">
                  DONE
                </Badge>
              )}
            </div>
            <Textarea
              value={ttsText}
              onChange={(e) => { setTtsText(e.target.value); setTtsCompleted(false); }}
              placeholder="Text for A.E.O.N. to speak aloud…"
              className="min-h-[80px] resize-none border-border/60 bg-background/60 text-sm"
            />
            {/* Waveform + progress */}
            <AnimatePresence>
              {speaking && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2">
                  <TtsWaveform />
                  <div className="mt-1.5">
                    <TtsProgressBar progress={ttsProgress} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
                <span className="flex items-center gap-1 font-mono text-[10px] text-[var(--aeon-active)]">
                  <CircleDot className="h-3 w-3 animate-pulse" /> synthesizing
                </span>
              )}
              {ttsCompleted && !speaking && (
                <span className="font-mono text-[10px] text-[var(--aeon-core)]">✓ playback complete</span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ─── Biometric injection ─── */}
        <motion.div
          animate={
            bioFlash === "danger"
              ? { boxShadow: "0 0 24px 4px color-mix(in oklch, var(--aeon-danger) 40%, transparent)" }
              : bioFlash === "active"
                ? { boxShadow: "0 0 24px 4px color-mix(in oklch, var(--aeon-active) 40%, transparent)" }
                : { boxShadow: "0 0 0px 0px transparent" }
          }
          transition={{ duration: 0.3 }}
          className="rounded-lg"
        >
          <Card className="relative overflow-hidden border-border/60 bg-card/40">
            <HudCorners size={12} color={currentBioMeta.color} />
            <CardContent className="p-4">
              <div className="mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <BioIcon className="h-3 w-3" style={{ color: currentBioMeta.color }} /> biometric injection · wearable parser
              </div>
              {/* Metric-specific animated visualization */}
              <AnimatePresence mode="wait">
                {bioMetric === "heart_rate" && (
                  <motion.div key="ecg" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-2">
                    <EcgLine color={currentBioMeta.color} />
                  </motion.div>
                )}
                {bioMetric === "sleep_hours" && (
                  <motion.div key="moon" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="mb-2 flex items-center gap-2">
                    <Moon className="h-5 w-5" style={{ color: currentBioMeta.color }} />
                    <span className="font-mono text-[10px] text-muted-foreground">sleep cycle analysis</span>
                  </motion.div>
                )}
                {bioMetric === "steps" && (
                  <motion.div key="steps" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="mb-2 flex items-center gap-2">
                    <Footprints className="h-5 w-5" style={{ color: currentBioMeta.color }} />
                    <span className="font-mono text-[10px] text-muted-foreground">pedometer input</span>
                  </motion.div>
                )}
                {bioMetric === "stress_index" && (
                  <motion.div key="stress" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-2 flex items-center gap-2">
                    <Brain className="h-5 w-5" style={{ color: currentBioMeta.color }} />
                    <span className="font-mono text-[10px] text-muted-foreground">cognitive load metric</span>
                  </motion.div>
                )}
                {bioMetric === "posture" && (
                  <motion.div key="posture" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mb-2 flex items-center gap-2">
                    <Activity className="h-5 w-5" style={{ color: currentBioMeta.color }} />
                    <span className="font-mono text-[10px] text-muted-foreground">inclinometer reading</span>
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] text-muted-foreground">Metric</label>
                  <select
                    value={bioMetric}
                    onChange={(e) => setBioMetric(e.target.value)}
                    className="h-9 w-full rounded-md border border-border/60 bg-background/60 px-2 font-mono text-sm"
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
              <motion.div
                className="mt-2.5"
                animate={injecting ? { opacity: 0.7 } : { opacity: 1 }}
              >
                <Button
                  size="sm"
                  onClick={injectBiometric}
                  disabled={injecting}
                  className="w-full gap-1.5 bg-[var(--aeon-danger)]/90 text-white hover:brightness-110"
                  style={{
                    boxShadow: injecting
                      ? "0 0 16px 2px color-mix(in oklch, var(--aeon-danger) 40%, transparent)"
                      : "0 0 8px 1px color-mix(in oklch, var(--aeon-danger) 15%, transparent)",
                    animation: injecting ? "aeon-pulse 0.8s ease-in-out infinite" : undefined,
                  }}
                >
                  {injecting ? (
                    <>
                      <motion.div
                        className="h-3.5 w-3.5 rounded-full border-2 border-white/50"
                        style={{ borderTopColor: "white" }}
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                      Injecting…
                    </>
                  ) : (
                    <>
                      <Radio className="h-3.5 w-3.5" /> Inject & Evaluate Triggers
                    </>
                  )}
                </Button>
              </motion.div>
              <p className="mt-1.5 text-[10px] text-muted-foreground">
                Injecting heart_rate &gt; 110 fires the anticipatory focus-break trigger (tier 1).
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* ─── Vision parser / Camera feed ─── */}
        <Card className="relative overflow-hidden border-border/60 bg-card/40">
          <HudCorners size={12} color="var(--aeon-think)" />
          <CardContent className="p-4">
            <div className="mb-2.5 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
              <Eye className="h-3 w-3" /> vision parser · camera feed
            </div>
            <div className="relative flex h-[140px] items-center justify-center overflow-hidden rounded-md border border-border/60 bg-black/60 aeon-scanline">
              {/* Surveillance overlay */}
              <CameraOverlay />
              {/* Center content */}
              <div className="relative z-10 text-center">
                <Eye className="mx-auto h-6 w-6 text-[var(--aeon-think)]/50" />
                <p className="mt-0.5 font-mono text-[10px] text-[var(--aeon-active)]/70">● streaming · no motion</p>
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="outline" onClick={injectMotion} className="gap-1.5 text-[var(--aeon-warn)]">
                <Radio className="h-3.5 w-3.5" /> Simulate Motion
              </Button>
              <div className="ml-auto flex items-center gap-1.5">
                <Signal className="h-3 w-3 text-[var(--aeon-active)]" />
                <span className="font-mono text-[10px] text-muted-foreground">RTSP</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Sensory feed ─── */}
      <Card className="relative min-h-0 flex-1 overflow-hidden border-border/60 bg-black/20">
        <HudCorners size={14} color="var(--aeon-core)" />
        <CardContent className="p-3">
          <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
            <Activity className="h-3 w-3" /> sensory feed
            <span className="ml-auto font-mono text-[9px]">{sensory.length} events</span>
          </div>
          <div className="aeon-scroll max-h-[280px] space-y-1 overflow-y-auto pr-1">
            {sensory.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground">No sensory events yet.</div>
            ) : (
              sensory.map((e, idx) => {
                const meta = CHANNEL_META[e.channel] ?? CHANNEL_META.system;
                const Icon = meta.icon;
                const isLatest = idx === 0;
                let detail = e.value;
                try { detail = JSON.stringify(JSON.parse(e.value)); } catch { /* keep raw */ }
                return (
                  <motion.div
                    key={e.id}
                    initial={{ opacity: 0, x: -12, height: 0 }}
                    animate={{ opacity: 1, x: 0, height: "auto" }}
                    transition={{ duration: 0.25, delay: 0 }}
                    className={`flex items-center gap-2 rounded-sm px-2 py-1.5 ${
                      isLatest
                        ? "bg-[var(--aeon-core)]/8 border border-[var(--aeon-core)]/15"
                        : "bg-background/30"
                    }`}
                  >
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded ${isLatest ? "animate-aeon-pulse" : ""}`}
                      style={{ backgroundColor: `color-mix(in oklch, ${meta.color} 15%, transparent)` }}
                    >
                      <Icon className="h-3.5 w-3.5" style={{ color: meta.color }} />
                    </div>
                    <Badge variant="outline" className="border-border/60 font-mono text-[9px]" style={{ color: meta.color }}>{e.channel}</Badge>
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground/80">{detail}</span>
                    <StatusDot status={e.severity === "critical" ? "error" : e.severity === "warn" ? "busy" : "online"} />
                    <span className="shrink-0 font-mono text-[10px] text-muted-foreground">{timeAgo(e.createdAt)}</span>
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

export default SensoryPanel;
