"use client";
/**
 * A.E.O.N. — IoT smart-home control surface.
 *
 * Reads the device list from the A.E.O.N. Zustand store, groups by room,
 * and renders per-type interactive controls (lights, climate, locks, blinds,
 * speakers, cameras). Every control PATCHes /api/aeon/iot optimistically and
 * then calls refresh() to sync. Includes scene quick-actions that batch
 * updates across many devices in parallel.
 *
 * Color-coding follows the A.E.O.N. HUD palette — amber core, emerald active,
 * orange warn, rose danger. NO indigo/blue.
 */
import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  Thermometer,
  Lock,
  LockOpen,
  Blinds,
  Speaker,
  Camera,
  Film,
  Plane,
  Brain,
  Moon,
  Sun,
  Plus,
  Minus,
  Loader2,
  Radio,
  Activity,
  WifiOff,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { useAeon } from "@/lib/store";
import type { DeviceView } from "@/lib/aeon";
import { StatusDot } from "@/components/aeon/ui";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* ------------------------------------------------------------------ */
/* State types per device family                                       */
/* ------------------------------------------------------------------ */

type LightState = {
  on: boolean;
  brightness: number;
  color: "warm" | "cool";
};
type ThermostatState = {
  on: boolean;
  temp: number;
  mode: "heat" | "cool" | "auto" | "off";
};
type LockState = { locked: boolean };
type BlindsState = { open: number };
type SpeakerState = { on: boolean; volume: number };
type CameraState = { recording: boolean; motion: boolean };

type DeviceType =
  | "light"
  | "thermostat"
  | "lock"
  | "blinds"
  | "speaker"
  | "camera";

interface TypeMeta {
  color: string;
  icon: LucideIcon;
  label: string;
}

const TYPE_META: Record<DeviceType, TypeMeta> = {
  light: { color: "var(--a_core)", icon: Lightbulb, label: "LIGHT" },
  thermostat: { color: "var(--a_warn)", icon: Thermometer, label: "CLIMATE" },
  lock: { color: "var(--a_active)", icon: Lock, label: "LOCK" },
  blinds: { color: "var(--a_reflect)", icon: Blinds, label: "BLINDS" },
  speaker: { color: "var(--a_core)", icon: Speaker, label: "AUDIO" },
  camera: { color: "var(--a_danger)", icon: Camera, label: "CAMERA" },
};

function isDeviceType(t: string): t is DeviceType {
  return t in TYPE_META;
}

function parseState(raw: string): Record<string, unknown> {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/* ------------------------------------------------------------------ */
/* Scenes — batched quick-actions                                      */
/* ------------------------------------------------------------------ */

type SceneId = "movie" | "away" | "focus" | "sleep" | "wake";

interface Scene {
  id: SceneId;
  name: string;
  icon: LucideIcon;
  description: string;
  build: (
    devices: DeviceView[],
  ) => Array<{ id: string; state: Record<string, unknown> }>;
}

const SCENES: Scene[] = [
  {
    id: "movie",
    name: "Movie Night",
    icon: Film,
    description: "Dim living-room lights to 20%, speakers on, blinds closed",
    build: (ds) => {
      const u: Array<{ id: string; state: Record<string, unknown> }> = [];
      ds.filter((d) => d.type === "light" && d.room === "Living Room").forEach(
        (d) =>
          u.push({
            id: d.id,
            state: { on: true, brightness: 20, color: "warm" },
          }),
      );
      ds.filter((d) => d.type === "speaker").forEach((d) =>
        u.push({ id: d.id, state: { on: true, volume: 55 } }),
      );
      ds.filter((d) => d.type === "blinds").forEach((d) =>
        u.push({ id: d.id, state: { open: 0 } }),
      );
      return u;
    },
  },
  {
    id: "away",
    name: "Away",
    icon: Plane,
    description: "Lock all entries, lights off, cameras recording",
    build: (ds) => {
      const u: Array<{ id: string; state: Record<string, unknown> }> = [];
      ds.filter((d) => d.type === "lock").forEach((d) =>
        u.push({ id: d.id, state: { locked: true } }),
      );
      ds.filter((d) => d.type === "light").forEach((d) =>
        u.push({ id: d.id, state: { on: false } }),
      );
      ds.filter((d) => d.type === "camera").forEach((d) =>
        u.push({ id: d.id, state: { recording: true } }),
      );
      ds.filter((d) => d.type === "speaker").forEach((d) =>
        u.push({ id: d.id, state: { on: false } }),
      );
      ds.filter((d) => d.type === "blinds").forEach((d) =>
        u.push({ id: d.id, state: { open: 0 } }),
      );
      return u;
    },
  },
  {
    id: "focus",
    name: "Focus",
    icon: Brain,
    description: "Office lamp 80% cool, blinds 100% open, audio off",
    build: (ds) => {
      const u: Array<{ id: string; state: Record<string, unknown> }> = [];
      ds.filter((d) => d.type === "light" && d.room === "Office").forEach((d) =>
        u.push({
          id: d.id,
          state: { on: true, brightness: 80, color: "cool" },
        }),
      );
      ds.filter((d) => d.type === "blinds").forEach((d) =>
        u.push({ id: d.id, state: { open: 100 } }),
      );
      ds.filter((d) => d.type === "speaker").forEach((d) =>
        u.push({ id: d.id, state: { on: false } }),
      );
      return u;
    },
  },
  {
    id: "sleep",
    name: "Sleep",
    icon: Moon,
    description: "Lights off, locks engaged, bedroom cool",
    build: (ds) => {
      const u: Array<{ id: string; state: Record<string, unknown> }> = [];
      ds.filter((d) => d.type === "light").forEach((d) =>
        u.push({ id: d.id, state: { on: false } }),
      );
      ds.filter((d) => d.type === "lock").forEach((d) =>
        u.push({ id: d.id, state: { locked: true } }),
      );
      ds.filter((d) => d.type === "thermostat" && d.room === "Bedroom").forEach(
        (d) => u.push({ id: d.id, state: { on: true, mode: "cool", temp: 19 } }),
      );
      ds.filter((d) => d.type === "speaker").forEach((d) =>
        u.push({ id: d.id, state: { on: false } }),
      );
      return u;
    },
  },
  {
    id: "wake",
    name: "Wake Up",
    icon: Sun,
    description: "Warm lights 60%, blinds rise, soft audio, heat 21°",
    build: (ds) => {
      const u: Array<{ id: string; state: Record<string, unknown> }> = [];
      ds.filter((d) => d.type === "light").forEach((d) =>
        u.push({
          id: d.id,
          state: { on: true, brightness: 60, color: "warm" },
        }),
      );
      ds.filter((d) => d.type === "blinds").forEach((d) =>
        u.push({ id: d.id, state: { open: 80 } }),
      );
      ds.filter((d) => d.type === "thermostat").forEach((d) =>
        u.push({ id: d.id, state: { on: true, mode: "heat", temp: 21 } }),
      );
      ds.filter((d) => d.type === "speaker").forEach((d) =>
        u.push({ id: d.id, state: { on: true, volume: 30 } }),
      );
      return u;
    },
  },
];

/* ------------------------------------------------------------------ */
/* Control hook — optimistic updates + syncing state                   */
/* ------------------------------------------------------------------ */

function useDeviceControl() {
  const refresh = useAeon((s) => s.refresh);
  const [syncing, setSyncing] = React.useState<Set<string>>(new Set());
  const [activeScene, setActiveScene] = React.useState<SceneId | null>(null);

  const mark = React.useCallback((ids: string[], on: boolean) => {
    setSyncing((prev) => {
      const n = new Set(prev);
      ids.forEach((id) => (on ? n.add(id) : n.delete(id)));
      return n;
    });
  }, []);

  const update = React.useCallback(
    async (id: string, patch: Record<string, unknown>) => {
      // optimistic local mutation (bypasses setDevices so pendingActions is untouched)
      const cur = useAeon.getState().devices;
      const next = cur.map((d) =>
        d.id === id
          ? { ...d, state: JSON.stringify({ ...parseState(d.state), ...patch }) }
          : d,
      );
      useAeon.setState({ devices: next });

      mark([id], true);
      try {
        await fetch("/api/aeon/iot", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, state: patch }),
        });
        await refresh();
      } finally {
        mark([id], false);
      }
    },
    [mark, refresh],
  );

  const batchUpdate = React.useCallback(
    async (updates: Array<{ id: string; state: Record<string, unknown> }>) => {
      if (!updates.length) return;
      const cur = useAeon.getState().devices;
      const map = new Map(updates.map((u) => [u.id, u.state]));
      const next = cur.map((d) =>
        map.has(d.id)
          ? {
              ...d,
              state: JSON.stringify({
                ...parseState(d.state),
                ...map.get(d.id),
              }),
            }
          : d,
      );
      useAeon.setState({ devices: next });
      const ids = updates.map((u) => u.id);
      mark(ids, true);
      try {
        await Promise.all(
          updates.map((u) =>
            fetch("/api/aeon/iot", {
              method: "PATCH",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ id: u.id, state: u.state }),
            }),
          ),
        );
        await refresh();
      } finally {
        mark(ids, false);
      }
    },
    [mark, refresh],
  );

  const runScene = React.useCallback(
    async (scene: Scene) => {
      const ds = useAeon.getState().devices;
      const updates = scene.build(ds);
      if (!updates.length) return;
      setActiveScene(scene.id);
      await batchUpdate(updates);
      // brief visual linger after the network settles
      window.setTimeout(
        () => setActiveScene((cur) => (cur === scene.id ? null : cur)),
        650,
      );
    },
    [batchUpdate],
  );

  return { update, batchUpdate, runScene, syncing, activeScene };
}

/* ------------------------------------------------------------------ */
/* Shared device shell — type strip, name, status, syncing indicator   */
/* ------------------------------------------------------------------ */

function ControlShell({
  device,
  type,
  syncing,
  children,
}: {
  device: DeviceView;
  type: DeviceType;
  syncing: boolean;
  children: React.ReactNode;
}) {
  const meta = TYPE_META[type];
  const Icon = meta.icon;
  const offline = !device.online;
  const state = React.useMemo(
    () => parseState(device.state),
    [device.state],
  );

  // Per-type "active" highlight — drives the glow + accent strip
  let active = false;
  if (!offline) {
    switch (type) {
      case "light":
        active = !!state.on;
        break;
      case "thermostat":
        active = !!state.on && state.mode !== "off";
        break;
      case "lock":
        active = !!state.locked;
        break;
      case "blinds":
        active = (state.open as number) > 0;
        break;
      case "speaker":
        active = !!state.on;
        break;
      case "camera":
        active = !!state.recording;
        break;
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: offline ? 0.45 : 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="relative rounded-lg border bg-card/60 backdrop-blur-sm p-3 sm:p-4"
      style={{
        borderColor: active
          ? `color-mix(in oklch, ${meta.color} 40%, transparent)`
          : "var(--border)",
        boxShadow: active
          ? `0 0 0 1px color-mix(in oklch, ${meta.color} 35%, transparent), 0 0 22px -6px color-mix(in oklch, ${meta.color} 55%, transparent)`
          : "none",
      }}
    >
      {/* accent strip — glows when the device is in an active state */}
      <div
        aria-hidden
        className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full transition-all"
        style={{
          background: active ? meta.color : "transparent",
          opacity: active ? 0.9 : 0,
          boxShadow: active ? `0 0 10px ${meta.color}` : "none",
        }}
      />

      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-md shrink-0"
            style={{
              color: meta.color,
              background: `color-mix(in oklch, ${meta.color} 14%, transparent)`,
              boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${meta.color} 25%, transparent)`,
            }}
          >
            <Icon className="h-3.5 w-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium leading-tight truncate">
              {device.name}
            </div>
            <div className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">
              {meta.label}
              {offline && (
                <span className="ml-1.5 text-[oklch(0.64_0.21_18)]">· OFFLINE</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <AnimatePresence>
            {syncing && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="font-mono text-[9px] tracking-widest uppercase text-[oklch(0.82_0.15_75)] flex items-center gap-1"
              >
                <Loader2 className="h-2.5 w-2.5 animate-spin" />
                sync
              </motion.span>
            )}
          </AnimatePresence>
          <StatusDot status={offline ? "offline" : "online"} />
        </div>
      </div>

      <div
        aria-disabled={offline}
        className={offline ? "pointer-events-none opacity-50" : ""}
      >
        {children}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/* Per-device controls                                                 */
/* ------------------------------------------------------------------ */

function RowLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  );
}

function LightControl({
  state,
  onPatch,
}: {
  device: DeviceView;
  state: LightState;
  onPatch: (patch: Partial<LightState>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <RowLabel>Power</RowLabel>
        <Switch
          checked={state.on}
          onCheckedChange={(v) => onPatch({ on: v })}
          aria-label="Light power"
        />
      </div>
      <div
        className={
          state.on ? "" : "opacity-40 pointer-events-none transition-opacity"
        }
      >
        <div className="flex items-center justify-between mb-1.5">
          <RowLabel>Brightness</RowLabel>
          <span className="font-mono text-xs text-[oklch(0.82_0.15_75)]">
            {state.brightness}%
          </span>
        </div>
        <Slider
          value={[state.brightness]}
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => onPatch({ brightness: v[0] })}
          aria-label="Brightness"
        />
      </div>
      <div className="flex items-center justify-between">
        <RowLabel>Color</RowLabel>
        <div className="flex items-center gap-1">
          {(["warm", "cool"] as const).map((c) => {
            const cColor =
              c === "warm" ? "var(--a_core)" : "var(--a_active)";
            const selected = state.color === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => onPatch({ color: c })}
                className="px-2 py-1 rounded-md font-mono text-[10px] uppercase tracking-wider transition-all"
                style={{
                  color: selected ? "var(--background)" : cColor,
                  background: selected ? cColor : "transparent",
                  boxShadow: selected
                    ? "none"
                    : `inset 0 0 0 1px color-mix(in oklch, ${cColor} 40%, transparent)`,
                }}
                aria-pressed={selected}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ThermostatControl({
  state,
  onPatch,
}: {
  device: DeviceView;
  state: ThermostatState;
  onPatch: (patch: Partial<ThermostatState>) => void;
}) {
  const setTemp = (t: number) =>
    onPatch({ temp: Math.max(16, Math.min(28, t)), on: true });
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <RowLabel>Set Point</RowLabel>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-md"
            onClick={() => setTemp(state.temp - 1)}
            aria-label="Decrease temperature"
          >
            <Minus className="h-3 w-3" />
          </Button>
          <div className="font-mono text-xl tabular-nums w-14 text-center text-[oklch(0.72_0.18_55)]">
            {state.temp}°
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-7 w-7 rounded-md"
            onClick={() => setTemp(state.temp + 1)}
            aria-label="Increase temperature"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </div>
      <div>
        <div className="mb-1.5">
          <RowLabel>Mode</RowLabel>
        </div>
        <Select
          value={state.mode}
          onValueChange={(v) =>
            onPatch({
              mode: v as ThermostatState["mode"],
              on: v !== "off",
            })
          }
        >
          <SelectTrigger className="w-full h-8 text-xs" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="heat">Heat</SelectItem>
            <SelectItem value="cool">Cool</SelectItem>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="off">Off</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

function LockControl({
  state,
  onPatch,
}: {
  device: DeviceView;
  state: LockState;
  onPatch: (patch: Partial<LockState>) => void;
}) {
  const locked = state.locked;
  const color = locked ? "var(--a_active)" : "var(--a_warn)";
  const Icon = locked ? Lock : LockOpen;
  return (
    <button
      type="button"
      onClick={() => onPatch({ locked: !locked })}
      className="w-full flex items-center justify-between gap-3 rounded-md px-3 py-2.5 transition-all hover:brightness-110"
      style={{
        color,
        background: `color-mix(in oklch, ${color} 12%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${color} 35%, transparent)`,
      }}
      aria-pressed={locked}
      aria-label={locked ? "Unlock" : "Lock"}
    >
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 shrink-0" />
        <div className="text-left">
          <div className="text-sm font-medium leading-tight">
            {locked ? "Locked" : "Unlocked"}
          </div>
          <div className="font-mono text-[9px] tracking-widest uppercase opacity-70">
            {locked ? "SECURED" : "OPEN ACCESS"}
          </div>
        </div>
      </div>
      <span className="font-mono text-[10px] tracking-widest uppercase opacity-80 hidden sm:inline">
        Tap to {locked ? "unlock" : "lock"}
      </span>
    </button>
  );
}

function BlindsControl({
  state,
  onPatch,
}: {
  device: DeviceView;
  state: BlindsState;
  onPatch: (patch: Partial<BlindsState>) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <RowLabel>Open</RowLabel>
        <span className="font-mono text-xs text-[oklch(0.66_0.16_350)]">
          {state.open}%
        </span>
      </div>
      <Slider
        value={[state.open]}
        min={0}
        max={100}
        step={1}
        onValueChange={(v) => onPatch({ open: v[0] })}
        aria-label="Blinds open percent"
      />
      <div className="flex justify-between font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
        <span>Closed</span>
        <span>Open</span>
      </div>
    </div>
  );
}

function SpeakerControl({
  state,
  onPatch,
}: {
  device: DeviceView;
  state: SpeakerState;
  onPatch: (patch: Partial<SpeakerState>) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <RowLabel>Power</RowLabel>
        <Switch
          checked={state.on}
          onCheckedChange={(v) => onPatch({ on: v })}
          aria-label="Speaker power"
        />
      </div>
      <div
        className={
          state.on ? "" : "opacity-40 pointer-events-none transition-opacity"
        }
      >
        <div className="flex items-center justify-between mb-1.5">
          <RowLabel>Volume</RowLabel>
          <span className="font-mono text-xs text-[oklch(0.82_0.15_75)]">
            {state.volume}
          </span>
        </div>
        <Slider
          value={[state.volume]}
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => onPatch({ volume: v[0] })}
          aria-label="Speaker volume"
        />
      </div>
    </div>
  );
}

function CameraControl({
  state,
  onPatch,
}: {
  device: DeviceView;
  state: CameraState;
  onPatch: (patch: Partial<CameraState>) => void;
}) {
  const motionColor = state.motion
    ? "var(--a_danger)"
    : "var(--muted-foreground)";
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <RowLabel>Recording</RowLabel>
        <Switch
          checked={state.recording}
          onCheckedChange={(v) => onPatch({ recording: v })}
          aria-label="Camera recording"
        />
      </div>
      <div
        className="flex items-center justify-between rounded-md px-3 py-2"
        style={{
          background: `color-mix(in oklch, ${motionColor} 12%, transparent)`,
          boxShadow: `inset 0 0 0 1px color-mix(in oklch, ${motionColor} 25%, transparent)`,
        }}
      >
        <div className="flex items-center gap-2">
          <Radio
            className={`h-3.5 w-3.5 ${state.motion ? "animate-pulse" : ""}`}
            style={{ color: motionColor }}
          />
          <span
            className="font-mono text-[10px] uppercase tracking-wider"
            style={{ color: motionColor }}
          >
            Motion
          </span>
        </div>
        <span
          className="font-mono text-[10px] uppercase tracking-wider"
          style={{ color: motionColor }}
        >
          {state.motion ? "DETECTED" : "CLEAR"}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Device card dispatcher                                              */
/* ------------------------------------------------------------------ */

function DeviceCard({
  device,
  syncing,
  onPatch,
}: {
  device: DeviceView;
  syncing: boolean;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
}) {
  if (!isDeviceType(device.type)) return null;
  const type = device.type as DeviceType;
  const state = parseState(device.state) as Record<string, unknown>;

  const render = () => {
    switch (type) {
      case "light":
        return (
          <LightControl
            device={device}
            state={state as unknown as LightState}
            onPatch={(p) => onPatch(device.id, p)}
          />
        );
      case "thermostat":
        return (
          <ThermostatControl
            device={device}
            state={state as unknown as ThermostatState}
            onPatch={(p) => onPatch(device.id, p)}
          />
        );
      case "lock":
        return (
          <LockControl
            device={device}
            state={state as unknown as LockState}
            onPatch={(p) => onPatch(device.id, p)}
          />
        );
      case "blinds":
        return (
          <BlindsControl
            device={device}
            state={state as unknown as BlindsState}
            onPatch={(p) => onPatch(device.id, p)}
          />
        );
      case "speaker":
        return (
          <SpeakerControl
            device={device}
            state={state as unknown as SpeakerState}
            onPatch={(p) => onPatch(device.id, p)}
          />
        );
      case "camera":
        return (
          <CameraControl
            device={device}
            state={state as unknown as CameraState}
            onPatch={(p) => onPatch(device.id, p)}
          />
        );
    }
  };

  return (
    <ControlShell device={device} type={type} syncing={syncing}>
      {render()}
    </ControlShell>
  );
}

/* ------------------------------------------------------------------ */
/* Room card                                                           */
/* ------------------------------------------------------------------ */

function RoomCard({
  room,
  devices,
  syncingSet,
  onPatch,
}: {
  room: string;
  devices: DeviceView[];
  syncingSet: Set<string>;
  onPatch: (id: string, patch: Record<string, unknown>) => void;
}) {
  const onlineCount = devices.filter((d) => d.online).length;
  return (
    <Card className="bg-card/40 backdrop-blur-sm border-border/60 gap-3 py-4">
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="font-mono text-[10px] tracking-widest uppercase text-[oklch(0.82_0.15_75)]">
              ROOM
            </div>
            <CardTitle className="text-base leading-none truncate">
              {room}
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className="font-mono text-[10px] tracking-wider shrink-0"
          >
            {devices.length} DEV · {onlineCount} LIVE
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-3 gap-3">
          {devices.map((d) => (
            <DeviceCard
              key={d.id}
              device={d}
              syncing={syncingSet.has(d.id)}
              onPatch={onPatch}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* Main panel                                                          */
/* ------------------------------------------------------------------ */

export function IoTPanel() {
  const devices = useAeon((s) => s.devices);
  const refresh = useAeon((s) => s.refresh);
  const { update, runScene, syncing, activeScene } = useDeviceControl();

  const rooms = React.useMemo(() => {
    const map = new Map<string, DeviceView[]>();
    for (const d of devices) {
      const r = d.room || "Unassigned";
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(d);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [devices]);

  const total = devices.length;
  const online = devices.filter((d) => d.online).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="flex flex-col gap-3 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-md"
              style={{
                color: "var(--a_core)",
                background: "color-mix(in oklch, var(--a_core) 16%, transparent)",
                boxShadow:
                  "0 0 0 1px color-mix(in oklch, var(--a_core) 35%, transparent), 0 0 18px -6px color-mix(in oklch, var(--a_core) 60%, transparent)",
              }}
            >
              <Activity className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold leading-tight">
                IoT Control Surface
              </h2>
              <div className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                Home Assistant Bridge · Tier 1 · Autonomous
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="font-mono text-[10px] tracking-wider gap-1.5"
            >
              <StatusDot status="online" /> {online}/{total} ONLINE
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refresh()}
              className="font-mono text-[10px] tracking-wider uppercase h-7 gap-1.5"
              aria-label="Refresh devices"
            >
              <RefreshCw className="h-3 w-3" />
              Sync
            </Button>
          </div>
        </div>

        {/* Scenes */}
        <div className="flex flex-col gap-1.5">
          <div className="font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
            Scenes
          </div>
          <div className="flex flex-wrap gap-2">
            {SCENES.map((scene) => {
              const Icon = scene.icon;
              const isActive = activeScene === scene.id;
              return (
                <Button
                  key={scene.id}
                  variant="outline"
                  size="sm"
                  onClick={() => runScene(scene)}
                  className="h-auto py-1.5 px-2.5 gap-2 font-mono text-[10px] tracking-wider uppercase transition-all"
                  style={{
                    color: isActive ? "var(--background)" : "var(--a_core)",
                    background: isActive
                      ? "var(--a_core)"
                      : "color-mix(in oklch, var(--a_core) 8%, transparent)",
                    borderColor:
                      "color-mix(in oklch, var(--a_core) 35%, transparent)",
                  }}
                  title={scene.description}
                  aria-label={`Activate ${scene.name} scene`}
                >
                  {isActive ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Icon className="h-3 w-3" />
                  )}
                  {scene.name}
                </Button>
              );
            })}
          </div>
        </div>

        <Separator />
      </div>

      {/* Rooms list */}
      <div className="flex-1 min-h-0 max-h-[78vh] overflow-y-auto aeon-scroll pr-1 -mr-1">
        {total === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <WifiOff className="h-8 w-8 text-muted-foreground mb-2" />
            <div className="text-sm text-muted-foreground">
              No devices provisioned.
            </div>
            <div className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground mt-1">
              POST /api/aeon/seed to bootstrap
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 2xl:grid-cols-2 gap-4 pb-4">
            {rooms.map(([room, ds]) => (
              <RoomCard
                key={room}
                room={room}
                devices={ds}
                syncingSet={syncing}
                onPatch={update}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default IoTPanel;
