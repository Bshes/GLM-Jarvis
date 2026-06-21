"use client";
/**
 * ConsolePanel — direct LLM console with routing transparency + web_search tool.
 *
 * The operator queries the LLM directly (bypassing the orchestrator's action
 * dispatch). Each query shows the complexity classification, the local-vs-cloud
 * routing decision, and the model's response with markdown rendering. An optional
 * web_search toggle feeds fresh web context into the prompt and cites sources.
 */
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Globe, MessageSquare, Cpu, Clock, Trash2, User, Bot,
  Sparkles, ChevronRight, Zap, Brain, RotateCw,
  Download, FileText, FileJson,
} from "lucide-react";
import { useAeon } from "@/lib/store";
import { timeAgo } from "@/components/aeon/ui";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const SUGGESTIONS = [
  "Explain how your PERCEIVE-THINK-ACT-REFLECT loop works.",
  "What's the difference between your local and cloud models?",
  "How do your safety tiers protect against harmful actions?",
  "Summarize the latest breakthroughs in autonomous AI agents.",
];

export function ConsolePanel() {
  const chat = useAeon((s) => s.chat);
  const chatLoading = useAeon((s) => s.chatLoading);
  const sendChat = useAeon((s) => s.sendChat);
  const refreshChat = useAeon((s) => s.refreshChat);
  const [message, setMessage] = useState("");
  const [useHistory, setUseHistory] = useState(true);
  const [useWebSearch, setUseWebSearch] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void refreshChat();
  }, [refreshChat]);

  // Auto-scroll to bottom on new messages.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat.length, chatLoading]);

  async function send(text?: string) {
    const content = (text ?? message).trim();
    if (!content || chatLoading) return;
    setMessage("");
    await sendChat(content, { useHistory, useWebSearch });
  }

  const localCount = chat.filter((t) => t.routing?.route === "local").length;
  const cloudCount = chat.filter((t) => t.routing?.route === "cloud").length;
  const webCount = chat.filter((t) => t.webResults && t.webResults.length > 0).length;
  const canExport = chat.length > 0;

  function exportMarkdown() {
    if (chat.length === 0) return;
    const lines: string[] = [];
    lines.push("# A.E.O.N. Console Transcript");
    lines.push(`Exported: ${new Date().toISOString()}`);
    lines.push(`Turns: ${chat.length}`);
    lines.push("");
    lines.push("---");
    lines.push("");
    for (const turn of chat) {
      if (turn.role === "user") {
        const route = turn.routing;
        const routeLabel = route ? (route.route === "cloud" ? "CLOUD" : "LOCAL") : "UNROUTED";
        const model = route?.model ?? "—";
        const complexity = route ? route.complexity.toFixed(2) : "—";
        lines.push(`## 👤 You · ${timeAgo(turn.createdAt)} · [${routeLabel} · ${model} · ${complexity}]`);
        lines.push("");
        lines.push(turn.content);
        lines.push("");
        if (turn.webResults && turn.webResults.length > 0) {
          lines.push("**Web sources cited:**");
          turn.webResults.forEach((r, i) => {
            lines.push(`${i + 1}. [${r.host_name}](${r.url}) — ${r.name}`);
          });
          lines.push("");
        }
      } else {
        const dur = turn.durationMs ?? 0;
        lines.push(`### 🤖 A.E.O.N. · ${dur}ms`);
        lines.push("");
        lines.push(turn.content);
        lines.push("");
      }
      lines.push("---");
      lines.push("");
    }
    const text = lines.join("\n");
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aeon-console-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${chat.length} turns as Markdown`);
  }

  function exportJSON() {
    if (chat.length === 0) return;
    const text = JSON.stringify(chat, null, 2);
    const blob = new Blob([text], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `aeon-console-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${chat.length} turns as JSON`);
  }

  return (
    <div className="flex h-full flex-col gap-4">
      {/* stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Turns" value={String(chat.length)} accent="var(--a_core)" icon={MessageSquare} />
        <Stat label="Local Routes" value={String(localCount)} accent="var(--a_active)" icon={Cpu} />
        <Stat label="Cloud Routes" value={String(cloudCount)} accent="var(--a_think)" icon={Brain} />
        <Stat label="Web Searches" value={String(webCount)} accent="var(--a_warn)" icon={Globe} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        {/* chat thread */}
        <div className="flex min-h-0 flex-col rounded-lg border border-border bg-black/30">
          <div className="flex items-center gap-2 border-b border-border/60 bg-background/40 px-3 py-2">
            <Bot className="h-3.5 w-3.5 text-[oklch(0.74_0.16_158)]" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">direct llm console</span>
            <span className="ml-auto inline-flex h-1.5 w-1.5 rounded-full bg-[oklch(0.74_0.16_158)] animate-aeon-pulse" />
          </div>

          <div ref={scrollRef} className="aeon-scroll min-h-0 flex-1 overflow-y-auto p-3">
            {chat.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-4 py-8 text-center">
                {/* Animated icon */}
                <div className="relative flex h-16 w-16 items-center justify-center">
                  <div className="absolute inset-0 rounded-full border border-[oklch(0.82_0.15_75)]/20 animate-aeon-pulse" />
                  <div className="absolute inset-2 rounded-full border border-[oklch(0.82_0.15_75)]/30" />
                  <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[oklch(0.82_0.15_75)]/40 bg-[oklch(0.82_0.15_75)]/10">
                    <Sparkles className="h-5 w-5 text-[oklch(0.82_0.15_75)]" />
                  </div>
                </div>
                <div>
                  <p className="font-mono text-sm font-bold text-foreground">DIRECT REASONING CHANNEL</p>
                  <p className="mt-1 text-xs text-muted-foreground">Query the routed LLM directly — no action dispatch, just answers.</p>
                </div>
                {/* Routing info chips */}
                <div className="flex flex-wrap items-center justify-center gap-1.5">
                  <div className="inline-flex items-center gap-1 rounded-sm border border-[oklch(0.74_0.16_158)]/30 bg-[oklch(0.74_0.16_158)]/8 px-2 py-1 text-[10px]">
                    <Cpu className="h-2.5 w-2.5 text-[oklch(0.74_0.16_158)]" />
                    <span className="font-mono font-bold text-[oklch(0.74_0.16_158)]">LOCAL</span>
                    <span className="text-muted-foreground">simple tasks</span>
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  <div className="inline-flex items-center gap-1 rounded-sm border border-[oklch(0.82_0.15_75)]/30 bg-[oklch(0.82_0.15_75)]/8 px-2 py-1 text-[10px]">
                    <Brain className="h-2.5 w-2.5 text-[oklch(0.82_0.15_75)]" />
                    <span className="font-mono font-bold text-[oklch(0.82_0.15_75)]">CLOUD</span>
                    <span className="text-muted-foreground">complex tasks</span>
                  </div>
                </div>
                {/* Example prompts */}
                <div className="mt-2 w-full max-w-md space-y-1.5">
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground">try asking</p>
                  {SUGGESTIONS.slice(0, 3).map((s, i) => (
                    <button
                      key={i}
                      onClick={() => void send(s)}
                      disabled={chatLoading}
                      className="group flex w-full items-center gap-2 rounded-md border border-border/40 bg-background/30 px-2.5 py-2 text-left text-xs text-muted-foreground transition hover:border-[oklch(0.82_0.15_75)]/40 hover:text-foreground disabled:opacity-40"
                    >
                      <ChevronRight className="h-3 w-3 shrink-0 text-[oklch(0.82_0.15_75)] opacity-0 transition group-hover:opacity-100" />
                      <span className="flex-1">{s}</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {chat.map((turn) => (
                  <TurnBubble key={turn.id} turn={turn} />
                ))}
                {chatLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 pl-9 text-xs text-muted-foreground">
                    <RotateCw className="h-3 w-3 animate-spin text-[oklch(0.82_0.15_75)]" />
                    <span className="font-mono">reasoning…</span>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* composer */}
          <div className="border-t border-border/60 bg-background/40 p-3">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              placeholder="Ask A.E.O.N. anything — routing is automatic…"
              className="min-h-[52px] resize-none border-border/60 bg-background/60 text-sm"
              disabled={chatLoading}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => void send()} disabled={chatLoading || !message.trim()} className="gap-1.5 bg-[oklch(0.82_0.15_75)] text-[var(--primary-foreground)] hover:brightness-110">
                {chatLoading ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send
              </Button>
              <ToggleChip icon={Brain} label="History" active={useHistory} onClick={() => setUseHistory((v) => !v)} />
              <ToggleChip icon={Globe} label="Web search" active={useWebSearch} onClick={() => setUseWebSearch((v) => !v)} />
              <span className="ml-auto hidden text-[10px] text-muted-foreground sm:inline">↵ to send · ⇧↵ for newline</span>
            </div>
          </div>
        </div>

        {/* side panel: suggestions + last routing */}
        <div className="flex flex-col gap-3">
          <Card className="border-border bg-card/40">
            <CardContent className="p-3">
              <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
                <Sparkles className="h-3 w-3 text-[oklch(0.82_0.15_75)]" /> suggestions
              </div>
              <div className="space-y-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    disabled={chatLoading}
                    className="group flex w-full items-start gap-1.5 rounded-md border border-border/40 bg-background/30 p-2 text-left text-xs text-muted-foreground transition hover:border-[oklch(0.82_0.15_75)]/50 hover:text-foreground disabled:opacity-40"
                  >
                    <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-[oklch(0.82_0.15_75)] opacity-0 transition group-hover:opacity-100" />
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <RoutingLegend />
          <ExportCard
            onMarkdown={exportMarkdown}
            onJSON={exportJSON}
            disabled={!canExport}
          />
        </div>
      </div>
    </div>
  );
}

function TurnBubble({ turn }: { turn: import("@/lib/store").ChatTurnView }) {
  const isUser = turn.role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex gap-2.5 ${isUser ? "flex-row-reverse" : ""}`}
    >
      <div
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border"
        style={{
          borderColor: isUser ? "var(--a_core)" : "var(--a_active)",
          background: isUser ? "color-mix(in oklch, var(--a_core) 12%, transparent)" : "color-mix(in oklch, var(--a_active) 12%, transparent)",
        }}
      >
        {isUser ? <User className="h-3.5 w-3.5 text-[oklch(0.82_0.15_75)]" /> : <Bot className="h-3.5 w-3.5 text-[oklch(0.74_0.16_158)]" />}
      </div>
      <div className={`min-w-0 max-w-[85%] ${isUser ? "text-right" : ""}`}>
        <div className="mb-1 flex items-center gap-1.5 text-[9px] text-muted-foreground" style={{ flexDirection: isUser ? "row-reverse" : "row" }}>
          <span className="font-mono uppercase tracking-wider">{isUser ? "you" : "a.e.o.n."}</span>
          <span>·</span>
          <span>{timeAgo(turn.createdAt)}</span>
          {turn.durationMs && (
            <>
              <span>·</span>
              <span className="inline-flex items-center gap-0.5"><Clock className="h-2 w-2" />{turn.durationMs}ms</span>
            </>
          )}
        </div>
        <div
          className="rounded-md border px-3 py-2 text-sm leading-relaxed"
          style={{
            borderColor: isUser ? "color-mix(in oklch, var(--a_core) 30%, transparent)" : "var(--border)",
            background: isUser ? "color-mix(in oklch, var(--a_core) 6%, transparent)" : "var(--background)",
          }}
        >
          {isUser ? (
            <p className="text-foreground/90">{turn.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none text-foreground/90 [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[11px] [&_code]:text-[oklch(0.82_0.15_75)] [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-black/40 [&_pre]:p-2 [&_pre]:text-[11px]">
              <ReactMarkdown>{turn.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* routing badge for user turns */}
        {isUser && turn.routing && (
          <div className="mt-1.5 flex items-center justify-end gap-1.5">
            <Badge variant="outline" className="border-border/60 font-mono text-[9px]" style={{ color: turn.routing.route === "cloud" ? "var(--a_core)" : "var(--a_active)" }}>
              {turn.routing.route === "cloud" ? "CLOUD" : "LOCAL"} · {turn.routing.model}
            </Badge>
            <div className="flex items-center gap-1" title={`complexity ${turn.routing.complexity.toFixed(2)}`}>
              <div className="h-1 w-12 overflow-hidden rounded-full bg-border/40">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.round(turn.routing.complexity * 100)}%`, background: turn.routing.route === "cloud" ? "var(--a_core)" : "var(--a_active)" }}
                />
              </div>
              <span className="font-mono text-[9px] text-muted-foreground">{turn.routing.complexity.toFixed(2)}</span>
            </div>
            {turn.routing.thinking && <Badge variant="outline" className="border-[oklch(0.82_0.15_75)]/40 font-mono text-[9px] text-[oklch(0.82_0.15_75)]">CO Thinking</Badge>}
          </div>
        )}

        {/* web search citations for user turns */}
        {isUser && turn.webResults && turn.webResults.length > 0 && (
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center justify-end gap-1 text-[9px] uppercase tracking-widest text-[oklch(0.72_0.18_55)]">
              <Globe className="h-2.5 w-2.5" /> {turn.webResults.length} web sources
            </div>
            <div className="space-y-0.5">
              {turn.webResults.slice(0, 4).map((r, i) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-sm bg-background/40 px-2 py-1 text-right text-[10px] text-muted-foreground transition hover:text-foreground"
                >
                  <span className="font-mono text-[oklch(0.72_0.18_55)]">[{i + 1}]</span> {r.host_name} — {r.name.slice(0, 50)}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ToggleChip({ icon: Icon, label, active, onClick }: { icon: React.ElementType; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-[11px] transition ${
        active
          ? "border-[oklch(0.82_0.15_75)] bg-[oklch(0.82_0.15_75)]/10 text-foreground"
          : "border-border/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3 w-3" style={{ color: active ? "var(--a_core)" : undefined }} />
      {label}
      <span className={`ml-0.5 h-1.5 w-1.5 rounded-full ${active ? "bg-[oklch(0.82_0.15_75)]" : "bg-muted-foreground/40"}`} />
    </button>
  );
}

function RoutingLegend() {
  return (
    <Card className="border-border bg-card/40">
      <CardContent className="p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Cpu className="h-3 w-3 text-[oklch(0.74_0.16_158)]" /> routing policy
        </div>
        <div className="space-y-2 text-[11px]">
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="border-[oklch(0.74_0.16_158)]/40 font-mono text-[9px] text-[oklch(0.74_0.16_158)]">LOCAL</Badge>
            <p className="text-muted-foreground">complexity &lt; 0.5 → fast Llama-3, no chain-of-thought. Smart-home, scheduling, recall.</p>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="border-[oklch(0.82_0.15_75)]/40 font-mono text-[9px] text-[oklch(0.82_0.15_75)]">CLOUD</Badge>
            <p className="text-muted-foreground">complexity ≥ 0.5 → Claude-3.5 Sonnet, with reasoning. Research, refactoring, analysis.</p>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="border-[oklch(0.82_0.15_75)]/40 font-mono text-[9px] text-[oklch(0.82_0.15_75)]">THINKING</Badge>
            <p className="text-muted-foreground">complexity ≥ 0.66 → chain-of-thought enabled for hardest prompts.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ExportCard({
  onMarkdown,
  onJSON,
  disabled,
}: {
  onMarkdown: () => void;
  onJSON: () => void;
  disabled: boolean;
}) {
  return (
    <Card className="border-border bg-card/40">
      <CardContent className="p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Download className="h-3 w-3 text-[oklch(0.82_0.15_75)]" /> export transcript
        </div>
        {disabled ? (
          <p className="text-[10px] italic text-muted-foreground">No conversation to export yet</p>
        ) : (
          <div className="space-y-1.5">
            <button
              onClick={onMarkdown}
              className="group flex w-full items-center gap-2 rounded-md border border-[oklch(0.82_0.15_75)]/40 bg-[oklch(0.82_0.15_75)]/5 p-2 text-left text-xs text-foreground transition hover:border-[oklch(0.82_0.15_75)] hover:bg-[oklch(0.82_0.15_75)]/10"
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-[oklch(0.82_0.15_75)]" />
              <span className="flex flex-col">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[oklch(0.82_0.15_75)]">Markdown</span>
                <span className="text-[10px] text-muted-foreground">formatted transcript (.md)</span>
              </span>
            </button>
            <button
              onClick={onJSON}
              className="group flex w-full items-center gap-2 rounded-md border border-[oklch(0.74_0.16_158)]/40 bg-[oklch(0.74_0.16_158)]/5 p-2 text-left text-xs text-foreground transition hover:border-[oklch(0.74_0.16_158)] hover:bg-[oklch(0.74_0.16_158)]/10"
            >
              <FileJson className="h-3.5 w-3.5 shrink-0 text-[oklch(0.74_0.16_158)]" />
              <span className="flex flex-col">
                <span className="font-mono text-[11px] uppercase tracking-wider text-[oklch(0.74_0.16_158)]">JSON</span>
                <span className="text-[10px] text-muted-foreground">raw turns array (.json)</span>
              </span>
            </button>
          </div>
        )}
      </CardContent>
    </Card>
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
