/**
 * Local PostgreSQL bootstrap for development and CI.
 *
 * What it does:
 *   1. If a server already answers on the configured port, it only verifies connectivity.
 *   2. Otherwise it stages the embedded PostgreSQL binaries to an ASCII path
 *      (PostgreSQL's initdb/postgres mishandle non-ASCII installation paths on Windows,
 *      and this project may live in a non-ASCII folder), runs initdb with UTF-8,
 *      starts the cluster and creates the application database.
 *
 * The cluster is stored in ~/.sitepilot/postgres (override with PGDATA_DIR).
 *
 * Usage: npm run db:start
 */
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const ROOT = process.cwd();
const HOME = os.homedir();
const DATA_DIR = process.env.PGDATA_DIR || path.join(HOME, ".sitepilot", "postgres");
const BIN_DIR = process.env.PGBIN_DIR || path.join(HOME, ".sitepilot", "pgbin");
const PLATFORM = `${process.platform}-${os.arch()}`;
const PACKAGE_MAP = {
  "win32-x64": "@embedded-postgres/windows-x64",
  "linux-x64": "@embedded-postgres/linux-x64",
  "linux-arm64": "@embedded-postgres/linux-arm64",
  "linux-arm": "@embedded-postgres/linux-arm",
  "linux-ia32": "@embedded-postgres/linux-ia32",
  "linux-ppc64": "@embedded-postgres/linux-ppc64",
  "darwin-x64": "@embedded-postgres/darwin-x64",
  "darwin-arm64": "@embedded-postgres/darwin-arm64",
};

function readEnvFile(file) {
  const p = path.join(ROOT, file);
  if (!fs.existsSync(p)) return {};
  const out = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*("?)(.*)\2\s*$/);
    if (m) out[m[1]] = m[3];
  }
  return out;
}

const env = { ...readEnvFile(".env.example"), ...readEnvFile(".env") };
const url = new URL(
  env.DATABASE_URL || "postgresql://postgres:password@127.0.0.1:5432/sitepilot",
);
const port = Number(url.port || 5432);
const user = decodeURIComponent(url.username || "postgres");
const password = decodeURIComponent(url.password || "password");
const database = (url.pathname || "/sitepilot").slice(1) || "sitepilot";

function log(msg) {
  console.log(`[db] ${new Date().toISOString().slice(11, 19)} ${msg}`);
}

function canConnect(hostPort, timeout = 700) {
  return new Promise((resolve) => {
    const socket = net.connect({ port: hostPort, host: "127.0.0.1" });
    const done = (v) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(v);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

function run(cmd, args, extra = {}) {
  // `capture: false` is required for pg_ctl: PostgreSQL inherits the pipes of
  // its parent on Windows, which would otherwise keep spawnSync waiting forever.
  const { capture = true, ...options } = extra;
  const res = spawnSync(cmd, args, {
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "ignore",
    ...options,
  });
  if (res.error) throw res.error;
  if (res.status !== 0) {
    const tail = `${res.stdout || ""}\n${res.stderr || ""}`.trim().split(/\r?\n/).slice(-8);
    const logTail = readServerLogTail();
    throw new Error(
      `${path.basename(cmd)} failed (code ${res.status}):\n${[...tail, logTail].filter(Boolean).join("\n")}`,
    );
  }
  return res;
}

function readServerLogTail() {
  const file = path.join(DATA_DIR, "server.log");
  try {
    if (!fs.existsSync(file)) return "";
    return `server.log:\n${fs
      .readFileSync(file, "utf8")
      .trim()
      .split(/\r?\n/)
      .slice(-6)
      .join("\n")}`;
  } catch {
    return "";
  }
}

function resolveBinaries() {
  const pkg = PACKAGE_MAP[PLATFORM];
  if (!pkg) {
    throw new Error(`Unsupported platform "${PLATFORM}". Set DATABASE_URL to an existing PostgreSQL instead.`);
  }
  const entry = require.resolve(pkg);
  const base = path.dirname(entry);
  const candidates = [path.join(base, "native"), path.join(path.dirname(base), "native"), base];
  const source = candidates.find((c) => fs.existsSync(path.join(c, "bin")));
  if (!source) {
    throw new Error(`Could not locate PostgreSQL binaries for ${pkg} (resolved ${entry}).`);
  }
  return { source, pkg };
}

function stageBinaries(source, pkg) {
  // Copy once into an ASCII-only location so initdb/postgres never see a
  // non-ASCII installation path (they break on Windows in that case).
  const marker = path.join(BIN_DIR, ".sitepilot-source");
  const alreadyStaged = fs.existsSync(path.join(BIN_DIR, "bin")) && fs.existsSync(marker);
  if (alreadyStaged && fs.readFileSync(marker, "utf8") === pkg) return;
  log(`Staging PostgreSQL binaries from ${pkg} to ${BIN_DIR} …`);
  fs.rmSync(BIN_DIR, { recursive: true, force: true });
  fs.mkdirSync(BIN_DIR, { recursive: true });
  fs.cpSync(source, BIN_DIR, { recursive: true });
  fs.writeFileSync(marker, pkg);
}

async function main() {
  log(`Target: postgresql://${user}:***@127.0.0.1:${port}/${database}`);

  const alreadyUp = await canConnect(port);
  if (alreadyUp) {
    log(`PostgreSQL already listening on 127.0.0.1:${port} — verifying connection …`);
  } else {
    const { source, pkg } = resolveBinaries();
    stageBinaries(source, pkg);

    const bin = path.join(BIN_DIR, "bin");
    const exe = (name) => path.join(bin, process.platform === "win32" ? `${name}.exe` : name);

    if (!fs.existsSync(path.join(DATA_DIR, "PG_VERSION"))) {
      if (fs.existsSync(DATA_DIR)) fs.rmSync(DATA_DIR, { recursive: true, force: true });
      fs.mkdirSync(DATA_DIR, { recursive: true });
      log("Running initdb (UTF-8, C locale) …");
      const pwFile = path.join(os.tmpdir(), `sitepilot-pg-pw-${process.pid}`);
      fs.writeFileSync(pwFile, `${password}\n`);
      try {
        run(exe("initdb"), [
          "-D",
          DATA_DIR,
          "-U",
          user,
          "--encoding=UTF8",
          "--locale=C",
          "--auth-local=trust",
          "--auth-host=scram-sha-256",
          `--pwfile=${pwFile}`,
        ]);
      } finally {
        fs.rmSync(pwFile, { force: true });
      }
    } else {
      log(`Reusing existing cluster at ${DATA_DIR}`);
    }

    log("Starting server …");
    run(exe("pg_ctl"), [
      "-D",
      DATA_DIR,
      "-l",
      path.join(DATA_DIR, "server.log"),
      "-w",
      "-t",
      "180",
      "start",
    ], { capture: false });

    // Wait until the port answers.
    for (let i = 0; i < 60; i++) {
      if (await canConnect(port, 500)) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    if (!(await canConnect(port, 500))) {
      throw new Error(`Server did not accept connections. See ${path.join(DATA_DIR, "server.log")}`);
    }
  }

  // Create the application database (always UTF-8, independent of cluster defaults).
  const { Client } = await import("pg");
  const client = new Client({
    host: "127.0.0.1",
    port,
    user,
    password,
    database: "postgres",
    connectionTimeoutMillis: 8000,
  });
  await client.connect();
  try {
    const res = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [database]);
    if (res.rowCount === 0) {
      log(`Creating database "${database}" with UTF-8 encoding …`);
      await client.query(`CREATE DATABASE "${database.replace(/"/g, '""')}" TEMPLATE template0 ENCODING 'UTF8'`);
    } else {
      const enc = await client.query("SELECT pg_encoding_to_char(encoding) AS enc FROM pg_database WHERE datname = $1", [database]);
      const encoding = enc.rows[0]?.enc;
      if (encoding !== "UTF8") {
        throw new Error(
          `Database "${database}" is ${encoding}, not UTF8. Drop it (or wipe ${DATA_DIR}) and re-run npm run db:start.`,
        );
      }
      log(`Database "${database}" already exists (encoding ${encoding}).`);
    }
  } finally {
    await client.end();
  }

  log(`Ready: postgresql://${user}:***@127.0.0.1:${port}/${database}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[db] Failed to prepare PostgreSQL.");
    console.error(err instanceof Error ? err.message : err);
    console.error(
      "[db] Alternative: install PostgreSQL yourself, set DATABASE_URL in .env and run `npx prisma migrate dev`.",
    );
    process.exit(1);
  });
