import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

// Hermetic setup: no database, no session cookies, no real Stripe, no email.
// Every external effect is a stub; the routes themselves run for real.
const stripeSessionsCreate = vi.hoisted(() =>
  vi.fn(async (_session: unknown) => ({ url: "https://checkout.stripe.com/cs_test_123" })),
);

vi.mock("stripe", () => ({
  default: class StripeStub {
    checkout = { sessions: { create: stripeSessionsCreate } };
    constructor(_key: string, _options?: unknown) {}
  },
}));

vi.mock("@/lib/db/prisma", () => ({
  db: {
    user: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    orgMember: { findFirst: vi.fn() },
    subscription: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/auth/session", () => ({
  getCurrentUser: vi.fn(async () => null),
  createSession: vi.fn(async () => undefined),
}));

vi.mock("@/lib/email", () => ({ sendConfirmationEmail: vi.fn(async () => undefined) }));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import * as confirmRoute from "@/app/api/auth/confirm/email/route";
import * as signupRoute from "@/app/api/auth/signup/route";
import * as checkoutRoute from "@/app/api/stripe/checkout/route";
import { db } from "@/lib/db/prisma";
import { createSession, getCurrentUser } from "@/lib/auth/session";
import { sendConfirmationEmail } from "@/lib/email";

const user = db.user as unknown as { findFirst: Mock; findUnique: Mock; create: Mock; update: Mock };
const orgMember = db.orgMember as unknown as { findFirst: Mock };
const subscription = db.subscription as unknown as { findFirst: Mock };
const currentUser = getCurrentUser as unknown as Mock;
const session = createSession as unknown as Mock;
const confirmationEmail = sendConfirmationEmail as unknown as Mock;

type Init = { method?: "GET" | "POST"; ip?: string; body?: unknown };

function req(url: string, init: Init = {}): NextRequest {
  const headers = new Headers({ "x-forwarded-for": init.ip ?? "10.0.0.1" });
  const method = init.method ?? "GET";
  if (method === "POST") headers.set("content-type", "application/json");
  return new NextRequest(url, {
    method,
    headers,
    ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
}

async function json(res: Response): Promise<Record<string, any>> {
  return (await res.json()) as Record<string, any>;
}

const signedIn = { id: "user_1", email: "owner@example.com", name: "Owner" };

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.STRIPE_SECRET_KEY;
  currentUser.mockResolvedValue(null);
  user.findFirst.mockResolvedValue(null);
  user.findUnique.mockResolvedValue(null);
  orgMember.findFirst.mockResolvedValue(null);
  subscription.findFirst.mockResolvedValue(null);
});

/* -------------------------------------------------------------------------- */
/* GET /api/auth/confirm/email                                                */
/* -------------------------------------------------------------------------- */

const confirmUrl = "http://localhost/api/auth/confirm/email";

describe("GET /api/auth/confirm/email", () => {
  it("rejects a request without a token", async () => {
    const res = await confirmRoute.GET(req(confirmUrl));

    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("MISSING_TOKEN");
    expect(user.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a token that matches no user", async () => {
    user.findFirst.mockResolvedValue(null);

    const res = await confirmRoute.GET(req(`${confirmUrl}?token=not-a-token`));

    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("INVALID_TOKEN");
    expect(user.findFirst).toHaveBeenCalledWith({ where: { emailToken: "not-a-token" } });
  });

  it("confirms the address and leaves the token in place so the link stays idempotent", async () => {
    user.findFirst.mockResolvedValue({
      id: "user_1",
      emailVerified: false,
      emailTokenExpiry: new Date(Date.now() + 3_600_000),
    });
    user.update.mockResolvedValue({});

    const res = await confirmRoute.GET(req(`${confirmUrl}?token=good-token`));

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true, data: { confirmed: true } });
    // Only emailVerified flips: blanking the token here would make a reload of
    // the same link answer INVALID_TOKEN instead of success.
    expect(user.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { emailVerified: true },
    });
  });

  it("answers alreadyVerified on a second click without writing anything", async () => {
    user.findFirst.mockResolvedValue({ id: "user_1", emailVerified: true });

    const res = await confirmRoute.GET(req(`${confirmUrl}?token=good-token`));

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true, data: { alreadyVerified: true } });
    expect(user.update).not.toHaveBeenCalled();
  });

  it("rejects a token past its 24h window", async () => {
    user.findFirst.mockResolvedValue({
      id: "user_1",
      emailVerified: false,
      emailTokenExpiry: new Date(Date.now() - 1_000),
    });

    const res = await confirmRoute.GET(req(`${confirmUrl}?token=stale-token`));

    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("TOKEN_EXPIRED");
    expect(user.update).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------------------------------------- */
/* POST /api/stripe/checkout                                                  */
/* -------------------------------------------------------------------------- */

describe("POST /api/stripe/checkout", () => {
  const checkoutUrl = "http://localhost/api/stripe/checkout";

  function post(body: unknown, ip: string): Promise<Response> {
    return checkoutRoute.POST(req(`${checkoutUrl}?plan=starter`, { method: "POST", ip, body }));
  }

  it("never exports a GET handler (the old one was an unauthenticated money route)", () => {
    expect(Object.keys(checkoutRoute)).not.toContain("GET");
    expect(Object.keys(checkoutRoute)).toContain("POST");
  });

  it("answers 401 to anonymous callers before touching anything", async () => {
    const res = await post({ plan: "starter" }, "10.1.0.1");

    expect(res.status).toBe(401);
    expect((await json(res)).error.code).toBe("UNAUTHORIZED");
    expect(orgMember.findFirst).not.toHaveBeenCalled();
    expect(stripeSessionsCreate).not.toHaveBeenCalled();
  });

  it("rejects an unknown plan", async () => {
    currentUser.mockResolvedValue(signedIn);

    const res = await post({ plan: "enterprise" }, "10.1.0.2");

    expect(res.status).toBe(400);
    expect((await json(res)).error.code).toBe("VALIDATION");
    expect(orgMember.findFirst).not.toHaveBeenCalled();
  });

  it("answers 404 when the account belongs to no organization", async () => {
    currentUser.mockResolvedValue(signedIn);
    orgMember.findFirst.mockResolvedValue(null);

    const res = await post({ plan: "starter" }, "10.1.0.3");

    expect(res.status).toBe(404);
    expect((await json(res)).error.code).toBe("NOT_FOUND");
    expect(stripeSessionsCreate).not.toHaveBeenCalled();
  });

  it("answers 503 BILLING_NOT_CONFIGURED while Stripe has no key", async () => {
    currentUser.mockResolvedValue(signedIn);
    orgMember.findFirst.mockResolvedValue({ organization: { id: "org_1" } });

    const res = await post({ plan: "starter" }, "10.1.0.4");

    expect(res.status).toBe(503);
    expect((await json(res)).error.code).toBe("BILLING_NOT_CONFIGURED");
    expect(stripeSessionsCreate).not.toHaveBeenCalled();
  });

  it("returns the plan the org already has instead of opening a new session", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_stub";
    currentUser.mockResolvedValue(signedIn);
    orgMember.findFirst.mockResolvedValue({ organization: { id: "org_1" } });
    subscription.findFirst.mockResolvedValue({ plan: "STARTER", status: "ACTIVE" });

    const res = await post({ plan: "starter" }, "10.1.0.5");

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({
      ok: true,
      data: { url: "/dashboard?plan=starter&already=true" },
    });
    expect(stripeSessionsCreate).not.toHaveBeenCalled();
  });

  it("buys for the session's user, never for an id sent by the client", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_stub";
    currentUser.mockResolvedValue(signedIn);
    orgMember.findFirst.mockResolvedValue({ organization: { id: "org_1" } });
    subscription.findFirst.mockResolvedValue(null);

    const res = await post({ plan: "starter", userId: "attacker" }, "10.1.0.6");

    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true, data: { url: "https://checkout.stripe.com/cs_test_123" } });
    expect(stripeSessionsCreate).toHaveBeenCalledTimes(1);
    const sessionArg = stripeSessionsCreate.mock.calls[0][0] as {
      mode: string;
      metadata: { userId: string; organizationId: string; plan: string };
      line_items: Array<{ price: string; quantity: number }>;
    };
    expect(sessionArg.mode).toBe("subscription");
    expect(sessionArg.metadata).toEqual({
      userId: "user_1",
      organizationId: "org_1",
      plan: "starter",
    });
    expect(sessionArg.line_items).toHaveLength(1);
    expect(sessionArg.line_items[0].quantity).toBe(1);
  });

  it("rate-limits repeated attempts from the same address", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_stub";
    currentUser.mockResolvedValue(signedIn);
    orgMember.findFirst.mockResolvedValue({ organization: { id: "org_1" } });

    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await post({ plan: "starter" }, "10.1.0.7")).status);
    }

    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});

/* -------------------------------------------------------------------------- */
/* POST /api/auth/signup                                                      */
/* -------------------------------------------------------------------------- */

describe("POST /api/auth/signup", () => {
  const signupUrl = "http://localhost/api/auth/signup";

  it("no longer exports a GET handler", () => {
    expect(Object.keys(signupRoute)).not.toContain("GET");
    expect(Object.keys(signupRoute)).toContain("POST");
  });

  it("rejects an address that is already registered", async () => {
    user.findUnique.mockResolvedValue({ id: "existing" });

    const res = await signupRoute.POST(
      req(signupUrl, {
        method: "POST",
        ip: "10.2.0.1",
        body: { email: "taken@example.com", password: "long-enough", name: "Ann" },
      }),
    );

    expect(res.status).toBe(409);
    expect((await json(res)).error.code).toBe("EMAIL_TAKEN");
    expect(user.create).not.toHaveBeenCalled();
  });

  it("validates the payload", async () => {
    const res = await signupRoute.POST(
      req(signupUrl, {
        method: "POST",
        ip: "10.2.0.2",
        body: { email: "not-an-email", password: "short", name: "" },
      }),
    );

    expect(res.status).toBe(400);
    const body = await json(res);
    expect(body.error.code).toBe("VALIDATION");
    expect(body.error.issues.map((issue: { path: string }) => issue.path)).toEqual(
      expect.arrayContaining(["email", "password", "name"]),
    );
    expect(user.create).not.toHaveBeenCalled();
  });

  it("creates the account unverified, emails that very token and opens a session", async () => {
    user.create.mockResolvedValue({
      id: "user_2",
      email: "new@example.com",
      name: "Ann",
      locale: "en",
      theme: "system",
      memberships: [{ role: "OWNER" }],
    });

    const res = await signupRoute.POST(
      req(signupUrl, {
        method: "POST",
        ip: "10.2.0.3",
        body: { email: "NEW@example.com", password: "long-enough", name: "Ann", locale: "en" },
      }),
    );

    expect(res.status).toBe(200);
    expect(await json(res)).toMatchObject({ ok: true, data: { userId: "user_2" } });

    const created = user.create.mock.calls[0][0].data as {
      email: string;
      emailVerified: boolean;
      emailToken: string;
      emailTokenExpiry: Date;
      passwordHash: string;
    };
    expect(created.email).toBe("new@example.com"); // normalised on the way in
    expect(created.emailVerified).toBe(false);
    expect(created.passwordHash).not.toContain("long-enough");
    expect(created.emailTokenExpiry.getTime()).toBeGreaterThan(Date.now());

    // The link must carry the token that was persisted, not a fresh one.
    expect(confirmationEmail).toHaveBeenCalledTimes(1);
    expect(confirmationEmail.mock.calls[0][0]).toBe("new@example.com");
    expect(confirmationEmail.mock.calls[0][2]).toBe(created.emailToken);

    expect(session).toHaveBeenCalledTimes(1);
    expect(session.mock.calls[0][0]).toMatchObject({ id: "user_2", email: "new@example.com" });
  });
});
