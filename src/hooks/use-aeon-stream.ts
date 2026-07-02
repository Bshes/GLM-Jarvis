"use client";
/**
 * useAeonStream — connects to the A.E.O.N. socket.io stream service and feeds
 * live events into the global store. Browser uses the gateway via
 * ?XTransformPort=3003 (never a direct port URL).
 */
import { useEffect } from "react";
import { io } from "socket.io-client";
import { useAeon } from "@/lib/store";
import type { AeonEvent } from "@/lib/aeon";

export function useAeonStream() {
  const pushEvent = useAeon((s) => s.pushEvent);
  const pushEvents = useAeon((s) => s.pushEvents);
  const setConnected = useAeon((s) => s.setConnected);
  const bootstrap = useAeon((s) => s.bootstrap);
  const bootstrapped = useAeon((s) => s.bootstrapped);

  useEffect(() => {
    if (!bootstrapped) void bootstrap();

    const socket = io("/?XTransformPort=3003", {
      transports: ["websocket", "polling"],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1500,
      timeout: 12000,
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("reconnect", () => setConnected(true));

    socket.on("aeon:hello", () => setConnected(true));

    socket.on("aeon:replay", (events: AeonEvent[]) => {
      if (Array.isArray(events) && events.length) pushEvents(events);
    });

    socket.on("aeon:event", (event: AeonEvent) => {
      if (!event?.ts) event = { ...event, ts: Date.now() };
      if (!event.id) event = { ...event, id: Math.random().toString(36).slice(2) };
      pushEvent(event);
    });

    return () => {
      socket.disconnect();
    };
  }, []);
}
