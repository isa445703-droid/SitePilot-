// Minute ticker for the deployed app. Vercel Hobby only allows one cron a day,
// so the per-minute scheduler ticks come from here instead: it POSTs /api/cron
// with CRON_SECRET, exactly like the Vercel cron job would.
import fs from "node:fs";

const read = (file) =>
  Object.fromEntries(
    fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .filter((line) => line.includes("="))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i).trim(), line.slice(i + 1).trim().replace(/^"|"$/g, "")];
      }),
  );

const env = { ...read(".env"), ...read(".env.local") };

const secret = env.CRON_SECRET;
// Ticks the deployed app, not the local dev origin in .env.
const base = process.env.TICKER_URL || "https://sitepilot-omega-eight.vercel.app";
if (!secret) {
  console.error("CRON_SECRET missing in .env / .env.local");
  process.exit(1);
}

const tick = async () => {
  try {
    const response = await fetch(`${base}/api/cron`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    const body = await response.text();
    console.log(`${new Date().toISOString()} ${response.status} ${body.slice(0, 200)}`);
  } catch (error) {
    console.log(`${new Date().toISOString()} error ${error instanceof Error ? error.message : error}`);
  }
};

await tick();
setInterval(tick, 60_000);
console.log(`ticker running against ${base} every 60s`);
