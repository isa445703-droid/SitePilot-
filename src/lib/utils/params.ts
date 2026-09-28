/**
 * Route parameter decoding.
 *
 * Slugs deliberately keep Unicode letters (see `slugify`), so a site named
 * "Дом" is served at `/s/Дом` and the router hands the segment over
 * percent-encoded (`%D0%94%D0%BE%D0%BC`). Looking that up in the database
 * without decoding returns nothing and the visitor gets a 404 — which is why
 * every public route decodes its params through this helper.
 *
 * Next.js decodes some segments and not others depending on how the request
 * arrived, so decoding must be idempotent: `decodeURIComponent` on an already
 * decoded value returns it unchanged unless it contains a stray `%`, in which
 * case the raw value is kept.
 */

export function decodeRouteParam(value: string | undefined): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
