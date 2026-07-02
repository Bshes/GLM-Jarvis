/**
 * A.E.O.N. seed route — idempotent bootstrap of agents, devices, graph nodes,
 * edges, memories, and anticipatory triggers. POST to (re)seed safely.
 */
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { embed, serialize } from "@/lib/embed";

export const dynamic = "force-dynamic";

const AGENTS = [
  { name: "Coder", role: "Writes, tests & deploys code", description: "Generates and refactors code, runs it in a sandboxed container, and proposes merges. Tier-2 by default — destructive ops require confirmation.", color: "var(--a_act)", icon: "Code2", tier: 2, model: "cloud" },
  { name: "Researcher", role: "Web research & synthesis", description: "Scrapes and synthesizes the web, citing sources. Autonomous recall; confirmative publication.", color: "var(--a_active)", icon: "Globe", tier: 1, model: "cloud" },
  { name: "IoT", role: "Smart-home control", description: "Controls lights, locks, climate and sensors via the Home Assistant bridge. Fully autonomous tier-1.", color: "var(--a_core)", icon: "House", tier: 1, model: "local" },
  { name: "Financial", role: "Bills, budget & forecasting", description: "Tracks spending, pays bills under threshold, and advises on investments. Advisory on large sums.", color: "var(--a_danger)", icon: "Wallet", tier: 3, model: "cloud" },
];

const DEVICES = [
  { name: "Living Room Lights", room: "Living Room", type: "light", state: { on: false, brightness: 80, color: "warm" } },
  { name: "Desk Lamp", room: "Office", type: "light", state: { on: true, brightness: 65, color: "cool" } },
  { name: "Bedroom Thermostat", room: "Bedroom", type: "thermostat", state: { on: true, temp: 21, mode: "heat" } },
  { name: "Front Door Lock", room: "Entrance", type: "lock", state: { locked: true } },
  { name: "Garage Door", room: "Garage", type: "lock", state: { locked: false } },
  { name: "Porch Camera", room: "Exterior", type: "camera", state: { recording: true, motion: false } },
  { name: "Kitchen Speaker", room: "Kitchen", type: "speaker", state: { on: false, volume: 35 } },
  { name: "Office Blinds", room: "Office", type: "blinds", state: { open: 40 } },
];

const NODES = [
  { label: "User", kind: "person", summary: "The primary operator. Preferences: focused work 09–17, low light evenings." },
  { label: "Home", kind: "place", summary: "Primary residence. 4 rooms instrumented." },
  { label: "Living Room", kind: "place", summary: "Relaxation zone." },
  { label: "Office", kind: "place", summary: "Deep-work zone." },
  { label: "Coder", kind: "agent", summary: "Code generation sub-agent." },
  { label: "Researcher", kind: "agent", summary: "Web research sub-agent." },
  { label: "IoT", kind: "agent", summary: "Smart-home sub-agent." },
  { label: "Financial", kind: "agent", summary: "Budget & billing sub-agent." },
  { label: "Sleep", kind: "concept", summary: "Recovery state. Target 7.5h." },
  { label: "Focus", kind: "concept", summary: "Cognitive flow state." },
  { label: "Energy Bill", kind: "event", summary: "Monthly utility cost." },
  { label: "Standup", kind: "event", summary: "Daily 09:15 team sync." },
];

const EDGES = [
  ["User", "Home", "lives_in"],
  ["Home", "Living Room", "contains"],
  ["Home", "Office", "contains"],
  ["User", "Sleep", "tracks"],
  ["User", "Focus", "seeks"],
  ["IoT", "Living Room", "controls"],
  ["IoT", "Office", "controls"],
  ["Coder", "Focus", "supports"],
  ["Researcher", "Focus", "supports"],
  ["Financial", "Energy Bill", "monitors"],
  ["User", "Standup", "attends"],
];

const MEMORIES = [
  { content: "User prefers warm light (2700K) in the evening to protect circadian rhythm.", kind: "procedural", tags: "lighting,preference,circadian", source: "user", importance: 0.8 },
  { content: "Standup meeting happens daily at 09:15; A.E.O.N. mutes notifications 09:10–09:25.", kind: "episodic", tags: "schedule,meeting", source: "orchestrator", importance: 0.7 },
  { content: "When user's heart rate exceeds 110 bpm during focus hours, suggest a 5-minute break.", kind: "procedural", tags: "biometric,health,focus", source: "orchestrator", importance: 0.85 },
  { content: "Energy bill is due on the 14th of each month; auto-pay under $200 is approved.", kind: "episodic", tags: "finance,bills", source: "user", importance: 0.75 },
  { content: "Coder agent uses a sandboxed Docker container; never executes untrusted code on host.", kind: "procedural", tags: "safety,code,sandbox", source: "orchestrator", importance: 0.9 },
  { content: "Researcher cites sources with host_name and publish date; rejects results older than 2 years for tech queries.", kind: "procedural", tags: "research,citations", source: "orchestrator", importance: 0.6 },
  { content: "Front door locks automatically at 22:30 and unlocks via the user's biometric.", kind: "procedural", tags: "security,iot,night", source: "user", importance: 0.8 },
];

const TRIGGERS = [
  { name: "Focus-break reminder", channel: "biometric", metric: "heart_rate", operator: "gt", threshold: "110", agentName: "IoT", action: "Dim lights to 40% and suggest a 5-minute break.", tier: 1 },
  { name: "Poor-sleep recovery", channel: "biometric", metric: "sleep_hours", operator: "lt", threshold: "6", agentName: "IoT", action: "Delay 09:15 standup reminder and brew coffee at 08:30.", tier: 2 },
  { name: "Evening wind-down", channel: "time", metric: "hour", operator: "eq", threshold: "21", agentName: "IoT", action: "Switch lights to warm 2700K at 40% brightness.", tier: 1 },
  { name: "High monthly spend", channel: "system", metric: "spend_delta", operator: "gt", threshold: "0.25", agentName: "Financial", action: "Compile spending advisory and flag top 3 categories.", tier: 3 },
];

export async function POST() {
  const report: string[] = [];

  let agents = 0;
  for (const a of AGENTS) {
    await db.agent.upsert({
      where: { name: a.name },
      create: { ...a, status: "idle" },
      update: { role: a.role, description: a.description, color: a.color, icon: a.icon, tier: a.tier, model: a.model },
    });
    agents++;
  }
  report.push(`agents: ${agents}`);

  await db.device.deleteMany({});
  let devices = 0;
  for (const d of DEVICES) {
    await db.device.create({ data: { name: d.name, room: d.room, type: d.type, state: JSON.stringify(d.state), online: true } });
    devices++;
  }
  report.push(`devices: ${devices}`);

  await db.edge.deleteMany({});
  await db.graphNode.deleteMany({});
  const labelToId = new Map<string, string>();
  let nodes = 0;
  for (const n of NODES) {
    const created = await db.graphNode.create({ data: { label: n.label, kind: n.kind, summary: n.summary } });
    labelToId.set(n.label, created.id);
    nodes++;
  }
  let edges = 0;
  for (const [from, to, rel] of EDGES) {
    const fromId = labelToId.get(from);
    const toId = labelToId.get(to);
    if (fromId && toId) {
      await db.edge.create({ data: { fromId, toId, relation: rel, weight: 1 } });
      edges++;
    }
  }
  report.push(`graph nodes: ${nodes}, edges: ${edges}`);

  await db.memory.deleteMany({});
  let mems = 0;
  for (const m of MEMORIES) {
    await db.memory.create({ data: { ...m, embedding: serialize(embed(m.content)) } });
    mems++;
  }
  report.push(`memories: ${mems}`);

  let trigs = 0;
  for (const t of TRIGGERS) {
    const existing = await db.trigger.findFirst({ where: { name: t.name } });
    if (existing) {
      await db.trigger.update({ where: { id: existing.id }, data: { ...t, threshold: t.threshold } });
    } else {
      await db.trigger.create({ data: { ...t, threshold: t.threshold, enabled: true } });
    }
    trigs++;
  }
  report.push(`triggers: ${trigs}`);

  await db.logEntry.create({ data: { level: "INFO", source: "system", message: `A.E.O.N. seed complete — ${report.join(", ")}` } });

  return NextResponse.json({ ok: true, seeded: report });
}
