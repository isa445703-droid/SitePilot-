import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Regression guard for a real bug: the scheduler loop lived only in
 * `instrumentation.node.ts`, but Next resolves the file named
 * `instrumentation.<ext>` — so `register()` never ran and the in-process
 * autopilot silently never started (queued tasks piled up forever).
 * The entry must also *call* the node register, not just import it.
 */
const mocks = vi.hoisted(() => ({
  nodeRegister: vi.fn(async () => undefined),
}));

vi.mock("@/instrumentation.node", () => ({ register: mocks.nodeRegister }));

import { register } from "@/instrumentation";

const srcDir = path.resolve(__dirname, "../src");
const ORIGINAL_RUNTIME = process.env.NEXT_RUNTIME;

afterEach(() => {
  mocks.nodeRegister.mockClear();
  if (ORIGINAL_RUNTIME === undefined) delete process.env.NEXT_RUNTIME;
  else process.env.NEXT_RUNTIME = ORIGINAL_RUNTIME;
});

describe("scheduler boot wiring", () => {
  it("has the instrumentation entry point Next.js actually resolves", () => {
    const candidates = ["instrumentation.ts", "instrumentation.js", "instrumentation.mjs"];
    const found = candidates.filter((f) => fs.existsSync(path.join(srcDir, f)));
    expect(found).toHaveLength(1);
  });

  it("starts the scheduler loop on the nodejs runtime", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    await register();
    expect(mocks.nodeRegister).toHaveBeenCalledTimes(1);
  });

  it("never imports node-only code on other runtimes", async () => {
    process.env.NEXT_RUNTIME = "edge";
    await register();
    expect(mocks.nodeRegister).not.toHaveBeenCalled();
  });

  it("node module exports register and boots the loop", () => {
    const source = fs.readFileSync(path.join(srcDir, "instrumentation.node.ts"), "utf8");
    expect(source).toMatch(/export async function register\s*\(/);
    expect(source).toContain("startSchedulerLoop");
    expect(source).toContain('NEXT_RUNTIME !== "nodejs"');
  });
});
