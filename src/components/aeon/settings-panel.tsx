"use client";
/**
 * SettingsPanel — A.E.O.N. operator preferences & data management.
 *
 * Sections:
 *  - Routing: complexity thresholds for local/cloud + thinking mode
 *  - Triggers: default cooldown period
 *  - Data Management: clear logs/cycles/chat/actions/messages, re-seed
 *  - About: system info, version, architecture summary
 */
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Settings, Cpu, Brain, Zap, Database, Trash2, RotateCw, Info,
  Shield, Gauge, Save, AlertTriangle, Check,
} from "lucide-react";
import { useAeon } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";

export function SettingsPanel() {
  const refresh = useAeon((s) => s.refresh);
  const refreshCycles = useAeon((s) => s.refreshCycles);
  const refreshChat = useAeon((s) => s.refreshChat);
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/aeon/settings")
      .then((r) => r.json())
      .then((data) => {
        setSettings(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  function update(key: string, value: string) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  async function saveSettings() {
    setSaving(true);
    try {
      await fetch("/api/aeon/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      toast.success("Settings saved");
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function dataAction(action: string, label: string) {
    try {
      await fetch("/api/aeon/data", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      await refresh();
      void refreshCycles();
      void refreshChat();
      toast.success(`${label} — done`);
    } catch {
      toast.error(`${label} failed`);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <RotateCw className="h-6 w-6 animate-spin text-[var(--a_core)]" />
      </div>
    );
  }

  const routingThreshold = Number(settings.routingThreshold ?? 0.5);
  const thinkingThreshold = Number(settings.thinkingThreshold ?? 0.66);
  const triggerCooldown = Number(settings.triggerCooldown ?? 30);

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header with save button */}
      <div className="flex items-center gap-2">
        <Settings className="h-4 w-4 text-[var(--a_core)]" />
        <span className="text-sm text-muted-foreground">Operator preferences & system configuration</span>
        <Button
          size="sm"
          onClick={saveSettings}
          disabled={saving}
          className="ml-auto gap-1.5 bg-[var(--a_core)] text-[var(--primary-foreground)] hover:brightness-110"
        >
          {saving ? <RotateCw className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Save Settings
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Routing Configuration */}
        <Card className="border-border bg-card/40">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[oklch(0.74_0.16_158)]/40 bg-[oklch(0.74_0.16_158)]/10">
                <Cpu className="h-3.5 w-3.5 text-[oklch(0.74_0.16_158)]" />
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold text-foreground">ROUTING</h3>
                <p className="text-[10px] text-muted-foreground">Model hot-swap thresholds</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Cloud threshold */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="text-xs text-foreground">Cloud routing threshold</Label>
                  <Badge variant="outline" className="border-border/60 font-mono text-[10px] text-[oklch(0.82_0.15_75)]">
                    {routingThreshold.toFixed(2)}
                  </Badge>
                </div>
                <Slider
                  value={[routingThreshold * 100]}
                  onValueChange={(v) => update("routingThreshold", (v[0] / 100).toFixed(2))}
                  min={10}
                  max={90}
                  step={1}
                  className="py-1"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Complexity ≥ this value routes to <span className="text-[oklch(0.82_0.15_75)]">Claude-3.5 cloud</span>. Below stays on <span className="text-[oklch(0.74_0.16_158)]">Llama-3 local</span>.
                </p>
              </div>

              {/* Thinking threshold */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="text-xs text-foreground">Chain-of-thought threshold</Label>
                  <Badge variant="outline" className="border-border/60 font-mono text-[10px] text-[oklch(0.82_0.15_75)]">
                    {thinkingThreshold.toFixed(2)}
                  </Badge>
                </div>
                <Slider
                  value={[thinkingThreshold * 100]}
                  onValueChange={(v) => update("thinkingThreshold", (v[0] / 100).toFixed(2))}
                  min={50}
                  max={95}
                  step={1}
                  className="py-1"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Complexity ≥ this value enables <span className="text-[oklch(0.82_0.15_75)]">extended reasoning</span> mode.
                </p>
              </div>

              {/* Threshold visualization */}
              <div className="rounded-md border border-border/40 bg-background/30 p-2.5">
                <div className="mb-1.5 flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-muted-foreground">
                  <Gauge className="h-2.5 w-2.5" /> complexity spectrum
                </div>
                <div className="relative h-6 overflow-hidden rounded-sm bg-border/30">
                  <div className="absolute inset-y-0 left-0 bg-[oklch(0.74_0.16_158)]/30" style={{ width: `${routingThreshold * 100}%` }} />
                  <div className="absolute inset-y-0 bg-[oklch(0.82_0.15_75)]/30" style={{ left: `${routingThreshold * 100}%`, right: `${(1 - thinkingThreshold) * 100}%` }} />
                  <div className="absolute inset-y-0 right-0 bg-[oklch(0.72_0.18_55)]/30" style={{ width: `${(1 - thinkingThreshold) * 100}%` }} />
                  {/* Threshold markers */}
                  <div className="absolute inset-y-0 w-0.5 bg-[oklch(0.82_0.15_75)]" style={{ left: `${routingThreshold * 100}%` }} />
                  <div className="absolute inset-y-0 w-0.5 bg-[oklch(0.72_0.18_55)]" style={{ left: `${thinkingThreshold * 100}%` }} />
                </div>
                <div className="mt-1 flex justify-between font-mono text-[8px] text-muted-foreground">
                  <span className="text-[oklch(0.74_0.16_158)]">LOCAL</span>
                  <span className="text-[oklch(0.82_0.15_75)]">CLOUD</span>
                  <span className="text-[oklch(0.72_0.18_55)]">THINKING</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trigger Configuration */}
        <Card className="border-border bg-card/40">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[oklch(0.72_0.18_55)]/40 bg-[oklch(0.72_0.18_55)]/10">
                <Zap className="h-3.5 w-3.5 text-[oklch(0.72_0.18_55)]" />
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold text-foreground">TRIGGERS</h3>
                <p className="text-[10px] text-muted-foreground">Anticipatory engine config</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <Label className="text-xs text-foreground">Trigger cooldown (seconds)</Label>
                  <Badge variant="outline" className="border-border/60 font-mono text-[10px] text-[oklch(0.72_0.18_55)]">
                    {triggerCooldown}s
                  </Badge>
                </div>
                <Slider
                  value={[triggerCooldown]}
                  onValueChange={(v) => update("triggerCooldown", String(v[0]))}
                  min={5}
                  max={120}
                  step={5}
                  className="py-1"
                />
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Minimum time between repeated fires of the same trigger.
                </p>
              </div>

              <div className="flex items-center justify-between rounded-md border border-border/40 bg-background/30 p-2.5">
                <div>
                  <Label className="text-xs text-foreground">Auto-evaluate triggers</Label>
                  <p className="text-[10px] text-muted-foreground">Run anticipatory check on sensory events</p>
                </div>
                <Switch
                  checked={settings.autoEvaluateTriggers === "true"}
                  onCheckedChange={(v) => update("autoEvaluateTriggers", String(v))}
                />
              </div>

              <div className="rounded-md border border-[oklch(0.64_0.21_18)]/30 bg-[oklch(0.64_0.21_18)]/5 p-2.5">
                <div className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[oklch(0.64_0.21_18)]" />
                  <p className="text-[10px] leading-relaxed text-muted-foreground">
                    <span className="font-bold text-[oklch(0.64_0.21_18)]">Safety:</span> Tier-1 triggers execute autonomously. Tier-2 require confirmation. Tier-3 are advisory only. Configure individual triggers in the Triggers view.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="border-border bg-card/40">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[oklch(0.64_0.21_18)]/40 bg-[oklch(0.64_0.21_18)]/10">
                <Database className="h-3.5 w-3.5 text-[oklch(0.64_0.21_18)]" />
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold text-foreground">DATA MANAGEMENT</h3>
                <p className="text-[10px] text-muted-foreground">Clear or reset system data</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <DataButton icon={Trash2} label="Clear Logs" color="var(--a_danger)" onClick={() => dataAction("clearLogs", "Logs cleared")} />
              <DataButton icon={Trash2} label="Clear Cycles" color="var(--a_danger)" onClick={() => dataAction("clearCycles", "Cycles cleared")} />
              <DataButton icon={Trash2} label="Clear Chat" color="var(--a_danger)" onClick={() => dataAction("clearChat", "Chat cleared")} />
              <DataButton icon={Trash2} label="Clear Actions" color="var(--a_danger)" onClick={() => dataAction("clearActions", "Actions cleared")} />
              <DataButton icon={Trash2} label="Clear Messages" color="var(--a_danger)" onClick={() => dataAction("clearMessages", "Messages cleared")} />
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <button className="flex items-center gap-2 rounded-md border border-[oklch(0.82_0.15_75)]/40 bg-[oklch(0.82_0.15_75)]/5 px-2.5 py-2 text-xs text-[oklch(0.82_0.15_75)] transition hover:bg-[oklch(0.82_0.15_75)]/10">
                    <RotateCw className="h-3.5 w-3.5" /> Re-seed All
                  </button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-border bg-card">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 font-mono text-[oklch(0.82_0.15_75)]">
                      <AlertTriangle className="h-4 w-4" /> RE-SEED DATABASE
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      This will reset all agents, devices, graph nodes/edges, memories, and triggers to their default seeded state. Existing actions, cycles, and logs will be preserved. This cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="gap-1.5">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => dataAction("reseed", "Database re-seeded")}
                      className="gap-1.5 bg-[oklch(0.82_0.15_75)] text-[oklch(0.16_0.02_70)] hover:brightness-110"
                    >
                      <RotateCw className="h-3.5 w-3.5" /> Re-seed
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </Card>

        {/* About */}
        <Card className="border-border bg-card/40">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md border border-[oklch(0.82_0.15_75)]/40 bg-[oklch(0.82_0.15_75)]/10">
                <Info className="h-3.5 w-3.5 text-[oklch(0.82_0.15_75)]" />
              </div>
              <div>
                <h3 className="font-mono text-sm font-bold text-foreground">ABOUT</h3>
                <p className="text-[10px] text-muted-foreground">System information</p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <AboutRow label="System" value="A.E.O.N. Core v1.0" />
              <AboutRow label="Architecture" value="PERCEIVE → THINK → ACT → REFLECT" />
              <AboutRow label="Models" value="Llama-3.1 (local) · Claude-3.5 (cloud)" />
              <AboutRow label="Memory" value="Graph + Vector (128-dim embeddings)" />
              <AboutRow label="Safety" value="3-tier (Autonomous / Confirmative / Advisory)" />
              <AboutRow label="Framework" value="Next.js 16 · TypeScript · Tailwind v4" />
              <AboutRow label="Realtime" value="Socket.io stream (port 3003)" />
            </div>

            <div className="mt-3 rounded-md border border-border/40 bg-background/30 p-2.5">
              <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-widest text-muted-foreground">
                <Brain className="h-2.5 w-2.5 text-[oklch(0.82_0.15_75)]" /> cognitive loop
              </div>
              <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                A.E.O.N. cycles continuously through four phases: <span className="text-[oklch(0.74_0.16_158)]">Perceive</span> (ingest sensory data), <span className="text-[oklch(0.82_0.15_75)]">Think</span> (route to model + plan), <span className="text-[oklch(0.72_0.18_55)]">Act</span> (execute tiered actions), <span className="text-[oklch(0.66_0.16_350)]">Reflect</span> (store memory + score outcome).
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DataButton({ icon: Icon, label, color, onClick }: { icon: React.ElementType; label: string; color: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded-md border border-border/40 bg-background/30 px-2.5 py-2 text-xs text-muted-foreground transition hover:text-foreground"
      style={{ borderColor: `color-mix(in oklch, ${color} 30%, transparent)` }}
    >
      <Icon className="h-3.5 w-3.5" style={{ color }} />
      {label}
    </button>
  );
}

function AboutRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-border/20 py-1 last:border-0">
      <span className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="truncate font-mono text-[11px] text-foreground/80">{value}</span>
    </div>
  );
}
