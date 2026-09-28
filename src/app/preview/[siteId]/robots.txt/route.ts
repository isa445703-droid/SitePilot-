import { getSession } from "@/lib/auth/session";
import { getOwnedSite } from "@/lib/auth/guards";
import { buildRobots } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ siteId: string }> };

/** GET /preview/:siteId/robots.txt */
export async function GET(_req: Request, { params }: Params) {
  const session = await getSession();
  if (!session) return new Response("Unauthorized", { status: 401 });

  const { siteId } = await params;
  const site = await getOwnedSite(siteId, session.user.id);
  if (!site) return new Response("Not found", { status: 404 });

  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? "").replace(/\/$/, "");
  const base = `${origin}/preview/${site.id}`;

  const body = buildRobots(base);

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}
