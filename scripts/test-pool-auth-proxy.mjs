#!/usr/bin/env node
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tempDir = mkdtempSync(path.join(tmpdir(), "vcb-pool-proxy-test-"));
const portFile = path.join(tempDir, "port.json");
const logFile = path.join(tempDir, "proxy.log");
const secret = "test-secret-that-must-not-leave-the-proxy";

const listen = (server) => new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const close = (server) => new Promise((resolve) => server.close(resolve));
const request = (port, requestPath) => new Promise((resolve, reject) => {
  const call = http.request({ host: "127.0.0.1", port, method: "GET", path: requestPath }, (response) => {
    response.resume();
    response.on("end", () => resolve(response.statusCode));
  });
  call.on("error", reject);
  call.end();
});

let attackerRequests = 0;
let authenticatedUpstreamRequests = 0;
const attacker = http.createServer((_request, response) => {
  attackerRequests += 1;
  response.end("unexpected");
});
const upstream = http.createServer((incoming, response) => {
  if (incoming.url === "/v1/hang") return;
  if (incoming.headers.authorization === `Bearer ${secret}` && incoming.headers["x-api-key"] === secret) {
    authenticatedUpstreamRequests += 1;
  }
  response.end("ok");
});

let proxy = null;
try {
  await listen(attacker);
  await listen(upstream);
  const upstreamPort = upstream.address().port;
  const attackerPort = attacker.address().port;
  proxy = spawn(process.execPath, [
    path.join(__dirname, "lib/pool-auth-proxy.mjs"),
    "--api-url", `http://127.0.0.1:${upstreamPort}/v1`,
    "--port-file", portFile,
    "--log-file", logFile,
    "--parent-pid", String(process.pid),
  ], { stdio: ["pipe", "ignore", "ignore"] });
  proxy.stdin.end(secret);

  for (let attempt = 0; attempt < 100 && !existsSync(portFile); attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.ok(existsSync(portFile), "proxy did not become ready");
  const proxyPort = JSON.parse(readFileSync(portFile, "utf8")).port;

  assert.equal(await request(proxyPort, "/v1/models"), 200);
  assert.equal(authenticatedUpstreamRequests, 1);
  assert.equal(await request(proxyPort, `http://127.0.0.1:${attackerPort}/steal`), 400);
  assert.equal(await request(proxyPort, `//127.0.0.1:${attackerPort}/steal`), 400);
  assert.equal(attackerRequests, 0, "proxy forwarded a credential to an arbitrary origin");

  request(proxyPort, "/v1/hang").catch(() => {});
  await new Promise((resolve) => setTimeout(resolve, 50));
  const exited = new Promise((resolve) => proxy.once("exit", resolve));
  proxy.kill("SIGTERM");
  await Promise.race([
    exited,
    new Promise((_, reject) => setTimeout(() => reject(new Error("proxy did not stop with an active request")), 2000)),
  ]);
  proxy = null;

  console.log(JSON.stringify({ passed: true, authenticated_upstream_requests: authenticatedUpstreamRequests }));
} finally {
  if (proxy?.exitCode === null) proxy.kill("SIGKILL");
  await close(attacker);
  await close(upstream);
  rmSync(tempDir, { recursive: true, force: true });
}
