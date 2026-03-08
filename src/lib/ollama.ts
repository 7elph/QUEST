import { logger } from "./logger";
import { getResolvedLlmRuntimeConfig, recordLlmCall } from "./llm-runtime-config";

type OllamaGenerateInput = {
  prompt: string;
  model?: string;
  format?: "json";
  temperature?: number;
  timeoutMs?: number;
  requestTag?: string;
  retries?: number;
  retryBackoffMs?: number;
};

type OllamaGenerateResponse = {
  response: string;
  model: string;
  done: boolean;
  total_duration?: number;
  eval_count?: number;
};

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    model?: string;
    size?: number;
    modified_at?: string;
  }>;
};

export type OllamaModelTag = {
  name: string;
  size: number | null;
  modifiedAt: string | null;
};

type OllamaErrorCode =
  | "OLLAMA_DISABLED"
  | "OLLAMA_HTTP_ERROR"
  | "OLLAMA_TIMEOUT"
  | "OLLAMA_UNAVAILABLE"
  | "OLLAMA_EMPTY_RESPONSE";

export class OllamaError extends Error {
  code: OllamaErrorCode;
  status?: number;
  details?: string;

  constructor(code: OllamaErrorCode, status?: number, details?: string) {
    super(code);
    this.name = "OllamaError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

function isRetryable(error: OllamaError) {
  if (error.code === "OLLAMA_TIMEOUT" || error.code === "OLLAMA_UNAVAILABLE" || error.code === "OLLAMA_EMPTY_RESPONSE") {
    return true;
  }
  if (error.code === "OLLAMA_HTTP_ERROR") {
    return error.status === 429 || (error.status !== undefined && error.status >= 500);
  }
  return false;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOllamaJson<T>(path: string, timeoutMs: number) {
  const runtime = await getResolvedLlmRuntimeConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${runtime.baseUrl}${path}`, {
      method: "GET",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
    });
    if (!response.ok) {
      const errorText = (await response.text().catch(() => "")).slice(0, 600);
      throw new OllamaError("OLLAMA_HTTP_ERROR", response.status, errorText);
    }
    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof OllamaError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new OllamaError("OLLAMA_TIMEOUT");
    }
    throw new OllamaError("OLLAMA_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}

async function runOnce(input: OllamaGenerateInput) {
  const runtime = await getResolvedLlmRuntimeConfig();
  const timeoutMs = input.timeoutMs ?? runtime.timeoutsMs.default;
  const resolvedModel = input.model ?? runtime.models.default;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${runtime.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        model: resolvedModel,
        prompt: input.prompt,
        stream: false,
        format: input.format,
        options: {
          temperature: input.temperature ?? 0.1,
        },
      }),
    });

    if (!response.ok) {
      const errorText = (await response.text().catch(() => "")).slice(0, 600);
      throw new OllamaError("OLLAMA_HTTP_ERROR", response.status, errorText);
    }

    const data = (await response.json()) as OllamaGenerateResponse;
    const text = data.response ?? "";
    if (!text.trim()) {
      throw new OllamaError("OLLAMA_EMPTY_RESPONSE");
    }

    return {
      text,
      model: data.model || resolvedModel,
      done: data.done,
      durationNs: data.total_duration ?? null,
      evalCount: data.eval_count ?? null,
    };
  } catch (error) {
    if (error instanceof OllamaError) {
      throw error;
    }
    if (error instanceof Error && error.name === "AbortError") {
      throw new OllamaError("OLLAMA_TIMEOUT");
    }
    throw new OllamaError("OLLAMA_UNAVAILABLE");
  } finally {
    clearTimeout(timer);
  }
}

export async function ollamaGenerate(input: OllamaGenerateInput) {
  const runtime = await getResolvedLlmRuntimeConfig();
  if (!runtime.enabled) {
    throw new OllamaError("OLLAMA_DISABLED");
  }

  const maxRetries = input.retries ?? runtime.retries.attempts;
  const retryBackoffMs = input.retryBackoffMs ?? runtime.retries.backoffMs;
  const attempts = Math.max(1, maxRetries + 1);
  const requestTag = input.requestTag ?? "generic";
  const requestedModel = input.model ?? runtime.models.default;
  const requestStartedAt = Date.now();

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const attemptStartedAt = Date.now();
      const output = await runOnce(input);
      logger.debug(
        {
          requestTag,
          model: output.model,
          attempt,
          durationMs: Date.now() - attemptStartedAt,
          promptChars: input.prompt.length,
          responseChars: output.text.length,
          evalCount: output.evalCount,
        },
        "OLLAMA_GENERATE_OK",
      );
      recordLlmCall({
        requestTag,
        model: output.model,
        success: true,
        attempts: attempt,
        durationMs: Date.now() - requestStartedAt,
      });
      return output;
    } catch (error) {
      const llmError =
        error instanceof OllamaError ? error : new OllamaError("OLLAMA_UNAVAILABLE", undefined, String(error));

      const shouldRetry = attempt < attempts && isRetryable(llmError);
      if (shouldRetry) {
        logger.warn(
          {
            requestTag,
            attempt,
            attempts,
            code: llmError.code,
            status: llmError.status,
            retryInMs: retryBackoffMs * attempt,
          },
          "OLLAMA_GENERATE_RETRY",
        );
        await sleep(retryBackoffMs * attempt);
        continue;
      }

      recordLlmCall({
        requestTag,
        model: requestedModel,
        success: false,
        attempts: attempt,
        durationMs: Date.now() - requestStartedAt,
        code: llmError.code,
        status: llmError.status,
        details: llmError.details,
      });
      logger.error(
        {
          requestTag,
          attempt,
          attempts,
          code: llmError.code,
          status: llmError.status,
          details: llmError.details,
          model: requestedModel,
        },
        "OLLAMA_GENERATE_FAILED",
      );
      throw llmError;
    }
  }

  throw new OllamaError("OLLAMA_UNAVAILABLE");
}

export async function ollamaListModels(timeoutMs = 5000): Promise<OllamaModelTag[]> {
  const runtime = await getResolvedLlmRuntimeConfig();
  if (!runtime.enabled) {
    throw new OllamaError("OLLAMA_DISABLED");
  }

  const data = await fetchOllamaJson<OllamaTagsResponse>("/api/tags", timeoutMs);
  return (data.models ?? [])
    .map((item) => ({
      name: item.name ?? item.model ?? "",
      size: typeof item.size === "number" ? item.size : null,
      modifiedAt: typeof item.modified_at === "string" ? item.modified_at : null,
    }))
    .filter((item) => item.name.length > 0);
}

export async function ollamaServerStatus(timeoutMs = 5000) {
  const runtime = await getResolvedLlmRuntimeConfig();
  if (!runtime.enabled) {
    return {
      enabled: false,
      reachable: false,
      baseUrl: runtime.baseUrl,
      models: [] as OllamaModelTag[],
      error: "OLLAMA_DISABLED",
    };
  }

  try {
    const models = await ollamaListModels(timeoutMs);
    return {
      enabled: true,
      reachable: true,
      baseUrl: runtime.baseUrl,
      models,
      error: null as string | null,
    };
  } catch (error) {
    if (error instanceof OllamaError) {
      return {
        enabled: true,
        reachable: false,
        baseUrl: runtime.baseUrl,
        models: [] as OllamaModelTag[],
        error: error.code,
      };
    }
    return {
      enabled: true,
      reachable: false,
      baseUrl: runtime.baseUrl,
      models: [] as OllamaModelTag[],
      error: "OLLAMA_UNAVAILABLE",
    };
  }
}

export async function ollamaWarmup(input?: { models?: string[]; prompt?: string }) {
  const runtime = await getResolvedLlmRuntimeConfig();
  const models = (input?.models ?? runtime.warmup.models)
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
  const prompt = input?.prompt?.trim() || runtime.warmup.prompt;

  const results: Array<{ model: string; ok: boolean; code?: string }> = [];

  for (const model of models) {
    try {
      await ollamaGenerate({
        model,
        prompt,
        temperature: 0,
        retries: 0,
        requestTag: "OLLAMA_WARMUP",
      });
      results.push({ model, ok: true });
    } catch (error) {
      if (error instanceof OllamaError) {
        results.push({ model, ok: false, code: error.code });
      } else {
        results.push({ model, ok: false, code: "OLLAMA_UNAVAILABLE" });
      }
    }
  }

  return {
    count: models.length,
    prompt,
    results,
  };
}
