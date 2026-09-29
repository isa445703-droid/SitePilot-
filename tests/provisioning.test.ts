import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// Hermetic: no database. The transaction client is a stub so the test can see
// whether writes go through `tx` (atomic) or the global client (not atomic).
vi.mock("@/lib/db/prisma", () => ({ db: { $transaction: vi.fn() } }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { provisionSiteFromBlueprint } from "@/lib/agents/orchestrator";
import { PermanentTaskError } from "@/lib/agents/task-policy";
import { db } from "@/lib/db/prisma";
import type { Blueprint } from "@/lib/ai/schemas";

const transaction = db.$transaction as unknown as Mock;

/** Only the fields provisioning reads; cast keeps the fixture honest. */
const blueprint = {
  siteName: "Nordic Explorer",
  description: "Guides to travelling in the Nordic countries",
  language: "en",
  tone: "warm",
  primaryGoal: "newsletter",
  targetAudience: "first-time planners",
  publishingFrequency: "3x_week",
  categories: [
    { name: "Guides", description: "Destination guides" },
    { name: "Gear", description: "Kit reviews" },
  ],
  pages: [
    { slug: "", title: "Home", purpose: "Start here" },
    { slug: "about", title: "About", purpose: "Who we are" },
    { slug: "contact", title: "Contact", purpose: "Say hello" },
  ],
  seoStrategy: { keywords: ["nordic travel", "norway in winter"] },
  design: {
    primaryColor: "#111827",
    secondaryColor: "#1f2937",
    surfaceColor: "#ffffff",
    backgroundColor: "#f9fafb",
    textColor: "#111827",
    mutedColor: "#6b7280",
    fontStyle: "sans",
    layoutStyle: "centered",
    cardStyle: "flat",
    borderRadius: "8px",
    headerStyle: "sticky",
    heroStyle: "split",
    cardDensity: "comfortable",
  },
} as unknown as Blueprint;

type Stub = Record<string, Mock>;

function makeTx(overrides: Partial<Record<string, Stub>> = {}) {
  const taskCounter = { value: 0 };
  const tx = {
    site: {
      findUnique: vi.fn(async () => ({ id: "site_1", timezone: "Europe/Kyiv", publishHour: 9 })),
      update: vi.fn(async () => ({})),
      ...overrides.site,
    },
    category: { create: vi.fn(async (args: any) => ({ id: `cat_${args.data.slug}` })), ...overrides.category },
    page: { create: vi.fn(async (args: any) => ({ id: `page_${args.data.slug || "home" }` })), ...overrides.page },
    siteBrand: { upsert: vi.fn(async () => ({})), ...overrides.siteBrand },
    siteDesign: { upsert: vi.fn(async () => ({})), ...overrides.siteDesign },
    siteSettings: { upsert: vi.fn(async () => ({})), ...overrides.siteSettings },
    publishingSchedule: { upsert: vi.fn(async () => ({})), ...overrides.publishingSchedule },
    agentTask: {
      create: vi.fn(async () => ({ id: `task_${++taskCounter.value}` })),
      ...overrides.agentTask,
    },
  };
  return tx;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("provisionSiteFromBlueprint", () => {
  it("writes everything through one transaction client with a generous budget", async () => {
    const tx = makeTx();
    transaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => fn(tx));

    const result = await provisionSiteFromBlueprint("site_1", blueprint);

    // A single atomic unit — a half-provisioned site must be impossible.
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0][1]).toEqual({ maxWait: 10_000, timeout: 60_000 });

    // The mock db exposes only `$transaction`: reaching for `db.category` and
    // friends would throw, so passing here proves every write used `tx`.
    expect(tx.category.create).toHaveBeenCalledTimes(2);
    expect(tx.page.create).toHaveBeenCalledTimes(3);
    expect(tx.siteBrand.upsert).toHaveBeenCalledTimes(1);
    expect(tx.siteDesign.upsert).toHaveBeenCalledTimes(1);
    expect(tx.siteSettings.upsert).toHaveBeenCalledTimes(1);
    expect(tx.publishingSchedule.upsert).toHaveBeenCalledTimes(1);
    expect(tx.agentTask.create).toHaveBeenCalledTimes(2);
    expect(tx.site.update).toHaveBeenCalledTimes(1);

    expect(result).toEqual({
      categories: 2,
      pages: 3,
      taskIds: ["task_1", "task_2"],
    });
  });

  it("fails with a 404 before writing anything when the site is gone", async () => {
    const tx = makeTx({ site: { findUnique: vi.fn(async () => null) } } as any);
    transaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => fn(tx));

    const error = await provisionSiteFromBlueprint("site_404", blueprint).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(PermanentTaskError);
    expect((error as PermanentTaskError).status).toBe(404);
    expect(tx.category.create).not.toHaveBeenCalled();
    expect(tx.agentTask.create).not.toHaveBeenCalled();
  });

  it("lets a mid-way failure escape so the database rolls the whole run back", async () => {
    const tx = makeTx();
    tx.page.create.mockRejectedValueOnce(new Error("deadlock detected"));
    transaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => fn(tx));

    await expect(provisionSiteFromBlueprint("site_1", blueprint)).rejects.toThrow(
      "deadlock detected",
    );

    // Nothing after the failed insert runs: the caller retries on a clean slate
    // instead of finding categories without pages or queued tasks.
    expect(tx.siteBrand.upsert).not.toHaveBeenCalled();
    expect(tx.siteSettings.upsert).not.toHaveBeenCalled();
    expect(tx.agentTask.create).not.toHaveBeenCalled();
    expect(tx.site.update).not.toHaveBeenCalled();
  });

  it("carries the site timezone and publish hour into the schedule", async () => {
    const tx = makeTx();
    transaction.mockImplementation(async (fn: (client: unknown) => Promise<unknown>) => fn(tx));

    await provisionSiteFromBlueprint("site_1", blueprint);

    expect(tx.publishingSchedule.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ timezone: "Europe/Kyiv", publishHour: 9 }),
      }),
    );
    // The first page is always the home page (empty slug).
    expect(tx.page.create.mock.calls[0][0].data).toMatchObject({ type: "HOME", status: "PUBLISHED" });
  });
});
