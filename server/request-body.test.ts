import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { connect, createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let api: ChildProcess;
let directory: string;
let port: number;

const request = (route: string, options?: RequestInit): Promise<Response> =>
  fetch(`http://127.0.0.1:${port}${route}`, {
    ...options,
    signal: AbortSignal.timeout(5_000),
  });

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "mjscore-request-body-"));
  const reservation = createServer();
  reservation.listen(0, "127.0.0.1");
  await once(reservation, "listening");
  const address = reservation.address();
  if (!address || typeof address === "string") throw new Error("No fixture port");
  port = address.port;
  await new Promise<void>((resolve, reject) => {
    reservation.close((error) => (error ? reject(error) : resolve()));
  });

  api = spawn(process.execPath, ["--import", "tsx", "server/index.ts"], {
    env: {
      ...process.env,
      NODE_ENV: "test",
      DATA_DIR: directory,
      PORT: String(port),
      CORS_ORIGIN: "",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  api.stderr?.resume();
  await new Promise<void>((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("API fixture startup timed out")), 10_000);
    timer.unref();
    api.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    api.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`API fixture exited: ${code}`));
    });
    api.stdout?.on("data", (chunk: Buffer) => {
      output += chunk.toString();
      if (output.includes(`session-api listening on ${port}`)) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}, 15_000);

afterAll(async () => {
  if (api && api.exitCode === null && api.signalCode === null) {
    const exited = once(api, "exit");
    api.kill();
    await exited;
  }
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe("API request bodies", () => {
  it("survives trailing bytes delivered after a compressed response", async () => {
    // Deliver the invalid tail after the decoder has finished the valid frame.
    // GHSA-27r3-jxmh-p828 killed the API at this point with body-parser 2.3.0.
    const frame = Buffer.concat([gzipSync(Buffer.from("{}")), Buffer.from([0])]);
    const tail = Buffer.alloc(100 * 1024, 0x58);
    const response = await new Promise<string>((resolve, reject) => {
      const socket = connect(port, "127.0.0.1");
      let received = "";
      let tailSent = false;
      socket.setTimeout(3_000, () => socket.destroy(new Error("Request timed out")));
      socket.on("error", reject);
      socket.on("end", () => resolve(received));
      socket.on("data", (chunk: Buffer) => {
        received += chunk.toString();
        if (!tailSent && received.includes("\r\n\r\n")) {
          tailSent = true;
          socket.write(tail);
          socket.write("GET /health HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n");
        }
      });
      socket.on("connect", () => {
        socket.write(
          "GET /health HTTP/1.1\r\nHost: localhost\r\n" +
            "Content-Type: application/json\r\nContent-Encoding: gzip\r\n" +
            `Content-Length: ${frame.length + tail.length}\r\n\r\n`,
        );
        socket.write(frame);
      });
    });
    expect(response.match(/HTTP\/1\.1 200/g)).toHaveLength(2);
    expect(api.exitCode).toBeNull();
    expect((await request("/health")).status).toBe(200);
  });

  it("accepts compressed session writes and rejects stale versions", async () => {
    const session = {
      id: "request-body-session",
      createdAt: "2026-10-25T00:00:00.000Z",
      day: "2026-10-25",
      label: "Request body fixture",
      players: ["a", "b", "c", "d"].map((id) => ({ id, name: id.toUpperCase() })),
      hands: [],
    };
    const body = JSON.stringify({ baseVersion: 0, session });
    const saved = await request("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" },
      body: new Uint8Array(gzipSync(body)),
    });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ version: 1, session });
    const stale = await request("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    expect(stale.status).toBe(409);
    expect(await (await request("/session")).json()).toMatchObject({ version: 1, session });
  });

  it("rejects malformed compression and oversized JSON without stopping the API", async () => {
    const invalid = await request("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Content-Encoding": "gzip" },
      body: "invalid compressed data",
    });
    expect(invalid.status).toBe(400);
    const oversized = await request("/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ padding: "x".repeat(1024 * 1024) }),
    });
    expect(oversized.status).toBe(413);
    expect((await request("/health")).status).toBe(200);
  });
});
