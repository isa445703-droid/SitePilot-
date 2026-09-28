/**
 * Next.js instrumentation entry point.
 *
 * Next resolves exactly one file — `instrumentation.<ext>` (see
 * `INSTRUMENTATION_HOOK_FILENAME` in next/dist/lib/constants) — so `register()`
 * in `instrumentation.node.ts` alone is never called by the framework: this
 * wrapper is the entry the framework actually loads, and it must *invoke* the
 * node-side register, not merely import it.
 *
 * The framework runs `register()` for every runtime, hence the explicit
 * NEXT_RUNTIME guard: node-only code (Prisma, the scheduler loop) must never
 * be pulled into the edge bundle. The guard is a build-time literal per
 * runtime, so the edge bundle drops this import entirely.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const node = await import("./instrumentation.node");
    await node.register();
  }
}
