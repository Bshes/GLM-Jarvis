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

  return (
    <div className="flex h-full flex-col gap-4">
      {/* stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Turns" value={String(chat.length)} accent="var(--aeon-core)" icon={MessageSquare} />
        <Stat label="Local Routes" value={String(localCount)} accent="var(--aeon-active)" icon={Cpu} />
        <Stat label="Cloud Routes" value={String(cloudCount)} accent="var(--aeon-think)" icon={Brain} />
        <Stat label="Web Searches" value={String(webCount)} accent="var(--aeon-warn)" icon={Globe} />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
        {/* chat thread */}
        <div className="flex min-h-0 flex-col rounded-lg border border-border bg-black/30">
          <div className="flex items-center gap-2 border-b border-border/60 bg-background/40 px-3 py-2">
            <Bot className="h-3.5 w-3.5 text-[var(--aeon-active)]" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">direct llm console</span>
            <span className="ml-auto inline-flex h-1.5 w-1.5 rounded-full bg-[var(--aeon-active)] animate-aeon-pulse" />
          </div>

          <div ref={scrollRef} className="aeon-scroll min-h-0 flex-1 overflow-y-auto p-3">
            {chat.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--aeon-core)]/30 bg-[var(--aeon-core)]/5">
                  <Sparkles className="h-5 w-5 text-[var(--aeon-core)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Direct reasoning channel open</p>
                  <p className="mt-1 text-xs text-muted-foreground">Query the routed LLM directly — no action dispatch, just answers.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {chat.map((turn) => (
                  <TurnBubble key={turn.id} turn={turn} />
                ))}
                {chatLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 pl-9 text-xs text-muted-foreground">
                    <RotateCw className="h-3 w-3 animate-spin text-[var(--aeon-core)]" />
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
              <Button size="sm" onClick={() => void send()} disabled={chatLoading || !message.trim()} className="gap-1.5 bg-[var(--aeon-core)] text-[var(--primary-foreground)] hover:brightness-110">
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
                <Sparkles className="h-3 w-3 text-[var(--aeon-core)]" /> suggestions
              </div>
              <div className="space-y-1.5">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    disabled={chatLoading}
                    className="group flex w-full items-start gap-1.5 rounded-md border border-border/40 bg-background/30 p-2 text-left text-xs text-muted-foreground transition hover:border-[var(--aeon-core)]/50 hover:text-foreground disabled:opacity-40"
                  >
                    <ChevronRight className="mt-0.5 h-3 w-3 shrink-0 text-[var(--aeon-core)] opacity-0 transition group-hover:opacity-100" />
                    <span>{s}</span>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          <RoutingLegend />
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
          borderColor: isUser ? "var(--aeon-core)" : "var(--aeon-active)",
          background: isUser ? "color-mix(in oklch, var(--aeon-core) 12%, transparent)" : "color-mix(in oklch, var(--aeon-active) 12%, transparent)",
        }}
      >
        {isUser ? <User className="h-3.5 w-3.5 text-[var(--aeon-core)]" /> : <Bot className="h-3.5 w-3.5 text-[var(--aeon-active)]" />}
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
            borderColor: isUser ? "color-mix(in oklch, var(--aeon-core) 30%, transparent)" : "var(--border)",
            background: isUser ? "color-mix(in oklch, var(--aeon-core) 6%, transparent)" : "var(--background)",
          }}
        >
          {isUser ? (
            <p className="text-foreground/90">{turn.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none text-foreground/90 [&_code]:rounded [&_code]:bg-background/60 [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[11px] [&_code]:text-[var(--aeon-core)] [&_pre]:rounded-md [&_pre]:border [&_pre]:border-border/60 [&_pre]:bg-black/40 [&_pre]:p-2 [&_pre]:text-[11px]">
              <ReactMarkdown>{turn.content}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* routing badge for user turns */}
        {isUser && turn.routing && (
          <div className="mt-1.5 flex items-center justify-end gap-1.5">
            <Badge variant="outline" className="border-border/60 font-mono text-[9px]" style={{ color: turn.routing.route === "cloud" ? "var(--aeon-core)" : "var(--aeon-active)" }}>
              {turn.routing.route === "cloud" ? "CLOUD" : "LOCAL"} · {turn.routing.model}
            </Badge>
            <div className="flex items-center gap-1" title={`complexity ${turn.routing.complexity.toFixed(2)}`}>
              <div className="h-1 w-12 overflow-hidden rounded-full bg-border/40">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${Math.round(turn.routing.complexity * 100)}%`, background: turn.routing.route === "cloud" ? "var(--aeon-core)" : "var(--aeon-active)" }}
                />
              </div>
              <span className="font-mono text-[9px] text-muted-foreground">{turn.routing.complexity.toFixed(2)}</span>
            </div>
            {turn.routing.thinking && <Badge variant="outline" className="border-[var(--aeon-think)]/40 font-mono text-[9px] text-[var(--aeon-think)]">CO Thinking</Badge>}
          </div>
        )}

        {/* web search citations for user turns */}
        {isUser && turn.webResults && turn.webResults.length > 0 && (
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center justify-end gap-1 text-[9px] uppercase tracking-widest text-[var(--aeon-warn)]">
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
                  <span className="font-mono text-[var(--aeon-warn)]">[{i + 1}]</span> {r.host_name} — {r.name.slice(0, 50)}
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
          ? "border-[var(--aeon-core)] bg-[var(--aeon-core)]/10 text-foreground"
          : "border-border/60 text-muted-foreground hover:text-foreground"
      }`}
    >
      <Icon className="h-3 w-3" style={{ color: active ? "var(--aeon-core)" : undefined }} />
      {label}
      <span className={`ml-0.5 h-1.5 w-1.5 rounded-full ${active ? "bg-[var(--aeon-core)]" : "bg-muted-foreground/40"}`} />
    </button>
  );
}

function RoutingLegend() {
  return (
    <Card className="border-border bg-card/40">
      <CardContent className="p-3">
        <div className="mb-2 flex items-center gap-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          <Cpu className="h-3 w-3 text-[var(--aeon-active)]" /> routing policy
        </div>
        <div className="space-y-2 text-[11px]">
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="border-[var(--aeon-active)]/40 font-mono text-[9px] text-[var(--aeon-active)]">LOCAL</Badge>
            <p className="text-muted-foreground">complexity &lt; 0.5 → fast Llama-3, no chain-of-thought. Smart-home, scheduling, recall.</p>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="border-[var(--aeon-core)]/40 font-mono text-[9px] text-[var(--aeon-core)]">CLOUD</Badge>
            <p className="text-muted-foreground">complexity ≥ 0.5 → Claude-3.5 Sonnet, with reasoning. Research, refactoring, analysis.</p>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="border-[var(--aeon-think)]/40 font-mono text-[9px] text-[var(--aeon-think)]">THINKING</Badge>
            <p className="text-muted-foreground">complexity ≥ 0.66 → chain-of-thought enabled for hardest prompts.</p>
          </div>
        </div>
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
