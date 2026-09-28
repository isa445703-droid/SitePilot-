/**
 * Public addressing for generated sites. Every site is served on a subdomain
 * derived from its slug:
 *
 *   NEXT_PUBLIC_APP_URL=http://localhost:3000  →  http://<slug>.localhost:3000
 *   NEXT_PUBLIC_APP_URL=https://sitepilot.app  →  https://<slug>.sitepilot.app
 *
 * The same helpers run in middleware (edge), in server components and in the
 * API, so the derivation lives in exactly one place.
 */

function rootHost(appUrl?: string): string {
  const raw = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  let hostname = "localhost";
  try {
    hostname = new URL(raw).hostname || "localhost";
  } catch {
    // keep the fallback
  }
  if (hostname === "127.0.0.1" || hostname === "0.0.0.0") hostname = "localhost";
  if (hostname.startsWith("www.")) hostname = hostname.slice(4);
  return hostname;
}

/** Absolute origin on which the given site is publicly served. */
export function siteOrigin(slug: string, appUrl?: string): string {
  const raw = (appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  let protocol = "http:";
  let port = "";
  try {
    const url = new URL(raw);
    protocol = url.protocol || "http:";
    port = url.port ? `:${url.port}` : "";
  } catch {
    // fall back to http without port
  }
  return `${protocol}//${slug}.${rootHost(appUrl)}${port}`;
}

/** Absolute public URL for a path on the given site ("" or "/" = home). */
export function siteHref(slug: string, path = "/"): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${siteOrigin(slug)}${suffix === "/" ? "/" : suffix}`;
}

const SUBDOMAIN_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Returns the site slug when the request host is a site subdomain of the
 * configured root, otherwise null (apex, www, localhost itself, foreign host).
 */
export function siteSlugFromHost(hostHeader: string | null, appUrl?: string): string | null {
  if (!hostHeader) return null;
  const hostname = hostHeader.split(":")[0].trim().toLowerCase();
  if (!hostname) return null;
  const root = rootHost(appUrl);
  if (hostname === root || hostname === `www.${root}`) return null;
  if (!hostname.endsWith(`.${root}`)) return null;
  const sub = hostname.slice(0, hostname.length - root.length - 1);
  if (!SUBDOMAIN_RE.test(sub)) return null;
  return sub;
}
