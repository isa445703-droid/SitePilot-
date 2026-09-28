import { describe, expect, it, vi, beforeEach } from "vitest";

// Keep the test hermetic: no Next runtime, no database.
vi.mock("next/navigation", () => ({ redirect: vi.fn(() => undefined) }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUser: vi.fn(async () => null) }));
vi.mock("@/lib/db/prisma", () => ({ db: {} }));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { AccessError, getOwnedSite } from "@/lib/auth/guards";

type StubSite = {
  id: string;
  organization: { members: Array<{ userId: string }> };
};

function stubClient(site: StubSite | null) {
  return {
    site: {
      findUnique: vi.fn(async () => site),
    },
  };
}

describe("site ownership", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const site: StubSite = {
    id: "site_1",
    organization: { members: [{ userId: "user_owner" }, { userId: "user_teammate" }] },
  };

  it("returns the site for an organization member", async () => {
    const client = stubClient(site);
    const result = await getOwnedSite("site_1", "user_owner", client as never);
    expect(result).not.toBeNull();
    expect(result?.id).toBe("site_1");
    expect(client.site.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "site_1" } }),
    );
  });

  it("returns null for a user outside the owning organization", async () => {
    const client = stubClient(site);
    const result = await getOwnedSite("site_1", "user_stranger", client as never);
    expect(result).toBeNull();
  });

  it("returns null when the site does not exist", async () => {
    const client = stubClient(null);
    expect(await getOwnedSite("missing", "user_owner", client as never)).toBeNull();
    expect(client.site.findUnique).toHaveBeenCalledTimes(1);
  });

  it("never returns another site's data for a foreign id", async () => {
    const client = stubClient(site);
    const result = await getOwnedSite("site_other", "user_outsider", client as never);
    expect(result).toBeNull();
  });

  it("uses AccessError as the 403 signal", () => {
    const error = new AccessError("nope");
    expect(error.status).toBe(403);
    expect(error.name).toBe("AccessError");
  });
});
