/**
 * core/router.ts — A.E.O.N. model router.
 *
 * Mirrors the spec's LiteLLM hot-swap logic: evaluate task complexity, then
 * route to a "local" (fast, no thinking) or "cloud" (powerful, thinking) model.
 * In this runtime there is a single backing LLM, so routing controls whether
 * chain-of-thought reasoning is enabled and how verbose the system prompt is —
 * a faithful, observable approximation of the hot-swap contract.
 */
import type { RoutingDecision, ModelRoute } from "@/lib/aeon";

const LOCAL_KEYWORDS = [
  "light", "lights", "lamp", "lock", "thermostat", "temperature", "fan",
  "schedule", "remind", "reminder", "timer", "alarm", "weather", "time",
  "play", "pause", "volume", "tv", "music",
];

const CLOUD_KEYWORDS = [
  "refactor", "architecture", "database", "schema", "design", "analyze",
  "research", "synthesis", "summarize", "draft", "strategy", "optimize",
  "debug", "implement", "algorithm", "compare", "evaluate", "plan",
  "investment", "budget", "forecast", "legal", "contract",
];

const CLOUD_PATTERNS = [
  /\b(refactor|redesign|architect)\b/i,
  /\b(why|how come|explain|analyze|compare)\b/i,
  /\b(schema|database|migration|api|endpoint)\b/i,
  /\b(plan|strategy|roadmap|proposal)\b/i,
  /.*\?.*lengthy|detailed|comprehensive/i,
];

export function estimateTokens(text: string): number {
  // Rough heuristic: ~4 chars per token.
  return Math.max(1, Math.ceil(text.length / 4));
}

/**
 * Classify complexity on a 0..1 scale.
 * Considers keyword signals, length, question depth, and code presence.
 */
export function classifyComplexity(prompt: string): { complexity: number; reason: string } {
  const lower = prompt.toLowerCase();
  let score = 0.18; // baseline
  const reasons: string[] = [];

  const localHits = LOCAL_KEYWORDS.filter((k) => lower.includes(k)).length;
  const cloudHits = CLOUD_KEYWORDS.filter((k) => lower.includes(k)).length;
  const patternHits = CLOUD_PATTERNS.filter((p) => p.test(prompt)).length;

  if (localHits > 0) {
    score -= 0.12 * localHits;
    reasons.push(`local-intent keywords ×${localHits}`);
  }
  if (cloudHits > 0) {
    score += 0.16 * cloudHits;
    reasons.push(`complex-intent keywords ×${cloudHits}`);
  }
  if (patternHits > 0) {
    score += 0.12 * patternHits;
    reasons.push(`reasoning patterns ×${patternHits}`);
  }

  const tokens = estimateTokens(prompt);
  if (tokens > 60) {
    score += 0.12;
    reasons.push("long prompt");
  }
  if (tokens > 160) {
    score += 0.14;
    reasons.push("very long prompt");
  }
  if (/\b(code|function|class|bug|error|stack ?trace)\b/i.test(prompt)) {
    score += 0.15;
    reasons.push("engineering context");
  }
  if (/\$\s?\d|\bbudget\b|\binvest|\bbill\b/i.test(prompt)) {
    score += 0.12;
    reasons.push("financial context");
  }
  if (prompt.includes("\n") && tokens > 40) {
    score += 0.08;
    reasons.push("multiline input");
  }

  const complexity = Math.max(0.04, Math.min(1, score));
  return { complexity, reason: reasons.length ? reasons.join("; ") : "baseline heuristic" };
}

/**
 * Decide the route. Threshold tuned so simple home/scheduling tasks stay local
 * while design/research/financial tasks escalate to the cloud model.
 */
export function route(prompt: string): RoutingDecision {
  const { complexity, reason } = classifyComplexity(prompt);
  const estTokens = estimateTokens(prompt);
  const route: ModelRoute = complexity >= 0.5 ? "cloud" : "local";
  const thinking = complexity >= 0.66;

  return {
    route,
    complexity,
    reason,
    estTokens,
    model: route === "local" ? "llama-3.1-local" : "claude-3.5-sonnet-cloud",
    thinking,
  };
}

/** Map a safety tier to a human execution policy line, for logs/UI. */
export function tierPolicy(tier: 1 | 2 | 3): string {
  if (tier === 1) return "execute immediately";
  if (tier === 2) return "await human confirmation";
  return "advisory only — no side effects";
}
