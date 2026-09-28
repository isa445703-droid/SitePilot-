import "server-only";
import { cookies, headers } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db/prisma";
import { logger } from "@/lib/logger";

export const SESSION_COOKIE = "sitepilot_session";
const SESSION_TTL_DAYS = 30;

/**
 * Only the hash of a session token is stored. A leaked database dump then
 * cannot be replayed as a login: the cookie carries the raw token, the DB
 * carries `sha256(token)`.
 */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type SessionUser = {
  id: string;
  email: string;
  name: string | null;
  locale: string;
  theme: string;
};

export async function createSession(user: SessionUser): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const headerStore = await headers();
  const userAgent = headerStore.get("user-agent")?.slice(0, 255) ?? null;
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await db.session.create({
    data: { token: hashSessionToken(token), userId: user.id, userAgent, expiresAt },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session
      .deleteMany({ where: { token: hashSessionToken(token) } })
      .catch(() => undefined);
  }
  cookieStore.delete(SESSION_COOKIE);
}

/** Removes expired rows so the session table cannot grow without bound. */
export async function purgeExpiredSessions(now: Date = new Date()): Promise<number> {
  const result = await db.session.deleteMany({ where: { expiresAt: { lt: now } } });
  return result.count;
}

export async function getSession(): Promise<{ user: SessionUser } | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const session = await db.session.findUnique({
      where: { token: hashSessionToken(token) },
      include: { user: true },
    });
    if (!session) return null;
    if (session.expiresAt < new Date()) {
      // Lazy cleanup for the row we already touched.
      await db.session.deleteMany({ where: { id: session.id } }).catch(() => undefined);
      return null;
    }
    return {
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        locale: session.user.locale,
        theme: session.user.theme,
      },
    };
  } catch (error) {
    logger.error("session_lookup_failed", { error: String(error) });
    return null;
  }
}

/** Returns the current user or `null`. Never redirects. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await getSession();
  return session?.user ?? null;
}
