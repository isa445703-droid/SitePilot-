/**
 * Central, typed access to environment variables.
 * Nothing here is ever exposed to the browser (no NEXT_PUBLIC_ prefixes).
 */

const read = (key: string, fallback = ""): string => {
  const value = process.env[key];
  return value === undefined || value === "" ? fallback : value;
};

export const env = {
  get nodeEnv() {
    return read("NODE_ENV", "development");
  },
  get isProduction() {
    return this.nodeEnv === "production";
  },
  get isTest() {
    return this.nodeEnv === "test";
  },
  get databaseUrl() {
    return read("DATABASE_URL");
  },
  get appUrl() {
    return read("NEXT_PUBLIC_APP_URL", read("NEXTAUTH_URL", "http://localhost:3000"));
  },
  get authSecret() {
    return read("NEXTAUTH_SECRET", read("CRON_SECRET", ""));
  },
  get cronSecret() {
    return read("CRON_SECRET");
  },
  get stripeSecretKey() {
    return read("STRIPE_SECRET_KEY");
  },
  get stripeWebhookSecret() {
    return read("STRIPE_WEBHOOK_SECRET");
  },
};

/**
 * AI provider configuration. The model is fully env-driven so it can be changed
 * without touching application code.
 */
export const aiConfig = {
  get apiKey() {
    return read("MISTRAL_API_KEY");
  },
  get model() {
    return read("MISTRAL_MODEL", "mistral-small-latest");
  },
  /** Cheaper/faster model for simple, high-volume tasks. */
  get fastModel() {
    return read("MISTRAL_MODEL_FAST", read("MISTRAL_MODEL", "mistral-small-latest"));
  },
  get baseUrl() {
    return read("MISTRAL_BASE_URL", "https://api.mistral.ai/v1");
  },
  get configured() {
    return this.apiKey.length > 0;
  },
  /**
   * Demo output (clearly marked) is only allowed outside production.
   * In production a missing key must surface as an error, never as fake AI.
   */
  get allowDemoFallback() {
    return !this.isProduction;
  },
  get isProduction() {
    return read("NODE_ENV", "development") === "production";
  },
};
