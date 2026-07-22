#!/usr/bin/env node
import http from "node:http";
import https from "node:https";
import { appendFileSync, renameSync, writeFileSync } from "node:fs";

function arg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
}

const upstream = new URL(arg("--api-url"));
const portFile = arg("--port-file");
const logFile = arg("--log-file");
const parentPid = Number(arg("--parent-pid"));
let token = "";

const log = (event, detail = {}) => {
  if (!logFile) return;
  appendFileSync(logFile, `${JSON.stringify({ timestamp: new Date().toISOString(), event, ...detail })}\n`, { mode: 0o600 });
};

const hopByHopHeaders = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  token += chunk;
});
process.stdin.on("end", () => {
  if (!token || !portFile) process.exit(2);

  const transport = upstream.protocol === "https:" ? https : http;
  const upstreamBasePath = upstream.pathname.replace(/\/$/, "");
  const sockets = new Set();
  const forwardedRequests = new Set();
  let shuttingDown = false;
  const server = http.createServer((request, response) => {
    const requestTarget = request.url ?? "";
    if (!requestTarget.startsWith("/") || requestTarget.startsWith("//")) {
      log("request_rejected", { reason: "non_origin_form" });
      response.writeHead(400).end("invalid request target");
      return;
    }
    const target = new URL(requestTarget, upstream.origin);
    const hasExpectedBasePath = !upstreamBasePath
      || target.pathname === upstreamBasePath
      || target.pathname.startsWith(`${upstreamBasePath}/`);
    if (target.origin !== upstream.origin || !hasExpectedBasePath) {
      log("request_rejected", { reason: "upstream_boundary" });
      response.writeHead(400).end("invalid upstream target");
      return;
    }
    const headers = Object.fromEntries(
      Object.entries(request.headers).filter(([name]) => !hopByHopHeaders.has(name.toLowerCase())),
    );
    headers.host = target.host;
    headers.authorization = `Bearer ${token}`;
    headers["x-api-key"] = token;
    const forwarded = transport.request(target, { method: request.method, headers }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    forwardedRequests.add(forwarded);
    forwarded.once("close", () => forwardedRequests.delete(forwarded));
    forwarded.setTimeout(20 * 60 * 1000, () => forwarded.destroy(new Error("upstream request timed out")));
    forwarded.on("error", () => {
      log("upstream_error");
      if (!response.headersSent) response.writeHead(502);
      response.end("upstream request failed");
    });
    request.pipe(forwarded);
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });

  server.listen(0, "127.0.0.1", () => {
    const address = server.address();
    const pendingPortFile = `${portFile}.tmp`;
    writeFileSync(pendingPortFile, JSON.stringify({ port: address.port }), { mode: 0o600 });
    renameSync(pendingPortFile, portFile);
    log("ready", { port: address.port, upstream_origin: upstream.origin, upstream_base_path: upstreamBasePath });
  });

  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    token = "";
    log("shutdown");
    for (const forwarded of forwardedRequests) forwarded.destroy();
    if (typeof server.closeAllConnections === "function") server.closeAllConnections();
    for (const socket of sockets) socket.destroy();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 250).unref();
  };

  if (Number.isInteger(parentPid) && parentPid > 1) {
    setInterval(() => {
      try {
        process.kill(parentPid, 0);
      } catch {
        shutdown();
      }
    }, 1000).unref();
  }

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
});
