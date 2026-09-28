/**
 * Node-runtime instrumentation — boots the in-process scheduler loop so queued
 * agent tasks (article generation, SEO audits, publishing) actually run
 * without an external cron. The `.node` suffix keeps this out of the edge
 * bundle, where the scheduler's Node APIs are unavailable.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  if (process.env.DISABLE_SCHEDULER === "1") return;

  const { startSchedulerLoop } = await import("./lib/scheduler");
  startSchedulerLoop();
}
