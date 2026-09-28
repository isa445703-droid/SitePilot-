import "server-only";
import { aiConfig } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { z } from "zod";

/**
 * Central Mistral AI service. Every model call in the application goes through
 * this module — components never talk to the provider directly.
 *
 * - The API key never leaves the server.
 * - The model is configurable via MISTRAL_MODEL / MISTRAL_MODEL_FAST.
 * - Failures are surfaced as typed errors with a user-safe message.
 */

export type AiUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type GenerateTextOptions = {
  system: string;
  prompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
};

export type GenerateTextResult = {
  text: string;
  model: string;
  usage: AiUsage;
};

export type StructuredResult<T> = {
  data: T;
  model: string;
  usage: AiUsage;
};

export class AiNotConfiguredError extends Error {
  readonly userMessage = "AI provider is not configured.";
  readonly code = "AI_NOT_CONFIGURED";
  constructor() {
    super("MISTRAL_API_KEY is not set");
    this.name = "AiNotConfiguredError";
  }
}

export class AiResponseError extends Error {
  readonly userMessage: string;
  /** HTTP-ish status for the API envelope: 429 for provider rate limits, else 502. */
  readonly status: number;
  readonly code: string;
  constructor(
    message: string,
    userMessage = "The AI returned an unexpected response. Please try again.",
    providerStatus?: number,
  ) {
    super(message);
    this.name = "AiResponseError";
    this.userMessage = userMessage;
    this.status = providerStatus === 429 ? 429 : 502;
    this.code = providerStatus === 429 ? "RATE_LIMITED" : "AI_RESPONSE_ERROR";
  }
}

export function isAiConfigured(): boolean {
  return aiConfig.configured;
}

const EMPTY_USAGE: AiUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

type ChatResponse = {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  model?: string;
};

async function chatCompletion(
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ json: ChatResponse; model: string }> {
  if (!aiConfig.configured) throw new AiNotConfiguredError();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${aiConfig.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 300);
      const retryable = response.status === 429 || response.status >= 500;
      throw new AiResponseError(
        `Mistral API ${response.status}: ${detail}`,
        retryable
          ? "The AI provider is rate limiting or unavailable. Please retry shortly."
          : "The AI provider rejected the request.",
        response.status,
      );
    }

    const json = (await response.json()) as ChatResponse;
    return { json, model: String(json.model ?? body.model ?? aiConfig.model) };
  } catch (error) {
    if (error instanceof AiResponseError || error instanceof AiNotConfiguredError) throw error;
    if ((error as Error)?.name === "AbortError") {
      throw new AiResponseError("Mistral API timeout", "The AI request timed out. Please retry.");
    }
    throw new AiResponseError(
      `Mistral request failed: ${String(error)}`,
      "Could not reach the AI provider. Check the server connection and retry.",
    );
  } finally {
    clearTimeout(timer);
  }
}

function readUsage(json: ChatResponse): AiUsage {
  return {
    promptTokens: json.usage?.prompt_tokens ?? 0,
    completionTokens: json.usage?.completion_tokens ?? 0,
    totalTokens: json.usage?.total_tokens ?? 0,
  };
}

/** Plain text generation. */
export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
  const model = options.model ?? aiConfig.model;
  const { json } = await chatCompletion(
    {
      model,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.prompt },
      ],
      temperature: options.temperature ?? 0.6,
      max_tokens: options.maxTokens ?? 2400,
    },
    options.timeoutMs ?? 60_000,
  );

  const text = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new AiResponseError("Empty completion", "The AI returned an empty response.");

  return { text, model, usage: readUsage(json) };
}

/**
 * Structured output generation: the model is asked for JSON, the JSON is
 * parsed and validated with Zod. One repair attempt is made when validation
 * fails. AI output is always treated as *data*, never as executable code.
 */
export async function generateStructuredOutput<S extends z.ZodTypeAny>(options: {
  system: string;
  prompt: string;
  schema: S;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<StructuredResult<z.infer<S>>> {
  const model = options.model ?? aiConfig.model;
  const jsonSystem = `${options.system}\n\nRespond with a single valid JSON object only. No markdown, no commentary.`;
  const base = {
    model,
    temperature: options.temperature ?? 0.5,
    max_tokens: options.maxTokens ?? 3000,
  };

  let lastError = "";
  let usage: AiUsage = EMPTY_USAGE;

  for (let attempt = 0; attempt < 2; attempt++) {
    const prompt = attempt === 0 ? options.prompt : `${options.prompt}\n\nYour previous answer was invalid: ${lastError}\nReturn corrected JSON only.`;
    const { json } = await chatCompletion(
      {
        ...base,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: jsonSystem },
          { role: "user", content: prompt },
        ],
      },
      options.timeoutMs ?? 60_000,
    );

    usage = readUsage(json);
    const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
    if (!raw) {
      lastError = "empty response";
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(stripFences(raw));
    } catch (error) {
      lastError = `not valid JSON (${String(error)})`.slice(0, 200);
      continue;
    }

    const result = options.schema.safeParse(parsed);
    if (result.success) {
      return { data: result.data, model: json.model ? String(json.model) : model, usage };
    }
    lastError = result.error.issues
      .slice(0, 5)
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ")
      .slice(0, 400);
    logger.warn("ai_structured_validation_failed", { model, attempt, lastError });
  }

  throw new AiResponseError(
    `Structured output validation failed: ${lastError}`,
    "The AI response did not match the expected structure. Please try again.",
  );
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/);
  return fenced ? fenced[1] : trimmed;
}
