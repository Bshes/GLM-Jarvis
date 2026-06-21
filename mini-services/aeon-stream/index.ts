/**
 * A.E.O.N. stream service — real-time event bus.
 *
 * Two listeners in one process:
 *  - :3003  socket.io server, path "/"  (Caddy forwards browser traffic here
 *           via ?XTransformPort=3003). path MUST stay "/" per gateway rules.
 *  - :3004  plain HTTP, internal-only  (Next.js API routes POST /emit here,
 *           server-to-server; never exposed through Caddy).
 *
 * Both are localhost-only. Newly connected browsers receive a warm replay of
 * the last 200 events.
 */
import { createServer } from "node:http";
import { Server } from "socket.io";

const IO_PORT = 3003;
const EMIT_PORT = 3004;
const RING_SIZE = 200;

const ring: unknown[] = [];

// ---- socket.io (browser-facing) ----
const httpServer = createServer((_req, res) => {
  // socket.io with path "/" claims these requests; this handler is a fallback.
  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  if (ring.length) socket.emit("aeon:replay", ring);
  socket.emit("aeon:hello", { ts: Date.now(), clients: io.engine.clientsCount });
  socket.on("aeon:ping", () => socket.emit("aeon:pong", { ts: Date.now() }));
});

function broadcast(payload: unknown) {
  ring.push(payload);
  if (ring.length > RING_SIZE) ring.shift();
  io.emit("aeon:event", payload);
}

// ---- internal emit receiver (server-to-server) ----
const emitServer = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, GET, OPTIONS",
      "access-control-allow-headers": "content-type",
    });
    return res.end();
  }

  if (req.method === "POST" && req.url === "/emit") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        broadcast(payload);
      } catch (e) {
        console.error("[aeon-stream] bad emit payload:", (e as Error).message);
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, clients: io.engine.clientsCount }));
    });
    return;
  }

  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(
      JSON.stringify({ ok: true, clients: io.engine.clientsCount, buffered: ring.length }),
    );
    return;
  }

  res.writeHead(404, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: "not found" }));
});

httpServer.listen(IO_PORT, () => {
  console.log(`[aeon-stream] socket.io on :${IO_PORT} (path "/")`);
});
emitServer.listen(EMIT_PORT, "127.0.0.1", () => {
  console.log(`[aeon-stream] emit receiver on :${EMIT_PORT} (internal)`);
});

process.on("SIGTERM", () => {
  httpServer.close();
  emitServer.close(() => process.exit(0));
});
process.on("SIGINT", () => {
  httpServer.close();
  emitServer.close(() => process.exit(0));
});
