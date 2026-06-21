/**
 * lib/logger.ts — A.E.O.N. observability.
 * Writes structured logs to the DB and optionally emits to the stream service.
 * Every module logs through this for full observability, per the spec.
 */
import { db } from "@/lib/db";

export type LogLevel = "DEBUG" | "INFO" | "WARN" | "ERROR";

export interface LogInput {
  level?: LogLevel;
  source: string;
  phase?: "PERCEIVE" | "THINK" | "ACT" | "REFLECT";
  message: string;
}

let streamUrl: string | null = null;

/** The orchestrator sets this so logs can also be pushed to the live socket feed. */
export function configureStream(url: string | null) {
  streamUrl = url;
}

export async function log(input: LogInput): Promise<void> {
  const level = input.level ?? "INFO";
  try {
    await db.logEntry.create({
      data: {
        level,
        source: input.source,
        phase: input.phase ?? null,
        message: input.message,
      },
    });
  } catch {
    // logging must never throw into the caller
  }

  // Fire-and-forget emit to the socket stream service (server-to-server).
  if (streamUrl) {
    try {
      void fetch(streamUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "log",
          level,
          source: input.source,
          phase: input.phase,
          message: input.message,
          ts: Date.now(),
        }),
      }).catch(() => {});
    } catch {
      /* ignore */
    }
  }
}

export const logger = {
  debug: (source: string, message: string, phase?: LogInput["phase"]) =>
    log({ level: "DEBUG", source, message, phase }),
  info: (source: string, message: string, phase?: LogInput["phase"]) =>
    log({ level: "INFO", source, message, phase }),
  warn: (source: string, message: string, phase?: LogInput["phase"]) =>
    log({ level: "WARN", source, message, phase }),
  error: (source: string, message: string, phase?: LogInput["phase"]) =>
    log({ level: "ERROR", source, message, phase }),
};

/** Emit an arbitrary structured event (not just a log line) to the stream. */
export async function emitEvent(payload: Record<string, unknown>): Promise<void> {
  if (!streamUrl) return;
  try {
    void fetch(streamUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ts: Date.now(), ...payload }),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
