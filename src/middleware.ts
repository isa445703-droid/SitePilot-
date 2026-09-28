import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { siteSlugFromHost } from "@/lib/site-url";

/**
 * Serves generated sites on their own subdomains. A request to
 * `<slug>.<root-domain>/any/path` is rewritten internally to
 * `/s/<slug>/any/path`, where the public site routes resolve the site by slug
 * and scope every query to it. The apex and www hosts are left untouched, so
 * the landing page and the app keep working as before.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  // Never rewrite the internal routes themselves (avoids double prefixing).
  if (pathname.startsWith("/s/")) return NextResponse.next();
  // The dashboard app under a site subdomain stays reachable.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  const slug = siteSlugFromHost(req.headers.get("host"));
  if (!slug) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `/s/${slug}${pathname === "/" ? "" : pathname}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // Only true internals are skipped; paths like /sitemap.xml must pass through
  // so a site subdomain can serve its own sitemap.
  matcher: ["/((?!_next/static|_next/image|_next/data|favicon.ico).*)"],
};
