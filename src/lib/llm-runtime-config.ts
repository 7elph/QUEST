import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

type LlmModelSlot = "default" | "mission" | "simulation" | "dispute" | "rpg";
type LlmTimeoutSlot = LlmModelSlot;

export type LlmRuntimeConfig = {
  enabled: boolean;
  baseUrl: string;
  models: Record<LlmModelSlot, string>;
  timeoutsMs: Record<LlmTimeoutSlot, number>;
  retries: {
    attempts: number;
    backoffMs: number;
  };
  warmup: {
    models: string[];
    prompt: string;
  };
};

export type LlmRuntimeOverrides = Partial<{
  enabled: boolean;
  baseUrl: string;
  models: Partial<Record<LlmModelSlot, string>>;
  timeoutsMs: Partial<Record<LlmTimeoutSlot, number>>;
  retries: Partial<{ attempts: number; backoffMs: number }>;
  warmup: Partial<{ models: string[]; prompt: string }>;
}>;

export type LlmCallRecord = {
  id: string;
  at: string;
  requestTag: string;
  model: string;
  success: boolean;
  attempts: number;
  durationMs: number;
  code?: string;
  status?: number;
  details?: string;
};

type LlmRuntimeState = {
  overrides: LlmRuntimeOverrides;
  loadedAt: number;
  calls: LlmCallRecord[];
  sequence: number;
};

const maxCallHistory = 100;
const runtimeSettingKey = "llm_runtime_overrides";
const overridesCacheTtlMs = 5000;

function toPositiveInt(value: string | number | undefined, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return Math.floor(parsed);
}

function toNonEmptyString(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return fallback;
  }
  return trimmed;
}

function parseModelList(value: string | undefined) {
  if (!value) {
    return [];
  }
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function readDefaultConfig(): LlmRuntimeConfig {
  return {
    enabled: (process.env.OLLAMA_ENABLED ?? "true").toLowerCase() === "true",
    baseUrl: toNonEmptyString(process.env.OLLAMA_BASE_URL, "http://127.0.0.1:11434"),
    models: {
      default: toNonEmptyString(process.env.OLLAMA_MODEL, "tinyllama"),
      mission: toNonEmptyString(process.env.OLLAMA_MISSION_MODEL, toNonEmptyString(process.env.OLLAMA_MODEL, "phi3:mini")),
      simulation: toNonEmptyString(process.env.OLLAMA_SIMULATION_MODEL, toNonEmptyString(process.env.OLLAMA_MODEL, "phi3:mini")),
      dispute: toNonEmptyString(process.env.OLLAMA_DISPUTE_MODEL, toNonEmptyString(process.env.OLLAMA_MODEL, "phi3:mini")),
      rpg: toNonEmptyString(process.env.OLLAMA_RPG_MODEL, toNonEmptyString(process.env.OLLAMA_MODEL, "phi3:mini")),
    },
    timeoutsMs: {
      default: toPositiveInt(process.env.OLLAMA_TIMEOUT_MS, 45000),
      mission: toPositiveInt(process.env.OLLAMA_MISSION_TIMEOUT_MS, 30000),
      simulation: toPositiveInt(process.env.OLLAMA_SIMULATION_TIMEOUT_MS, toPositiveInt(process.env.OLLAMA_TIMEOUT_MS, 45000)),
      dispute: toPositiveInt(process.env.OLLAMA_DISPUTE_TIMEOUT_MS, toPositiveInt(process.env.OLLAMA_TIMEOUT_MS, 45000)),
      rpg: toPositiveInt(process.env.OLLAMA_RPG_TIMEOUT_MS, 35000),
    },
    retries: {
      attempts: toPositiveInt(process.env.OLLAMA_RETRY_ATTEMPTS, 1),
      backoffMs: toPositiveInt(process.env.OLLAMA_RETRY_BACKOFF_MS, 700),
    },
    warmup: {
      models: parseModelList(process.env.OLLAMA_WARMUP_MODELS),
      prompt: toNonEmptyString(process.env.OLLAMA_WARMUP_PROMPT, "Responda apenas: OK"),
    },
  };
}

function normalizePatch(patch: LlmRuntimeOverrides): LlmRuntimeOverrides {
  const normalized: LlmRuntimeOverrides = {};
  const defaults = readDefaultConfig();

  if (patch.enabled !== undefined) {
    normalized.enabled = !!patch.enabled;
  }
  if (patch.baseUrl !== undefined) {
    normalized.baseUrl = toNonEmptyString(patch.baseUrl, "http://127.0.0.1:11434");
  }
  if (patch.models) {
    normalized.models = {};
    for (const key of Object.keys(patch.models) as LlmModelSlot[]) {
      const value = patch.models[key];
      if (value !== undefined) {
        normalized.models[key] = toNonEmptyString(value, defaults.models[key]);
      }
    }
  }
  if (patch.timeoutsMs) {
    normalized.timeoutsMs = {};
    for (const key of Object.keys(patch.timeoutsMs) as LlmTimeoutSlot[]) {
      const value = patch.timeoutsMs[key];
      if (value !== undefined) {
        normalized.timeoutsMs[key] = toPositiveInt(value, defaults.timeoutsMs[key]);
      }
    }
  }
  if (patch.retries) {
    normalized.retries = {};
    if (patch.retries.attempts !== undefined) {
      normalized.retries.attempts = toPositiveInt(patch.retries.attempts, defaults.retries.attempts);
    }
    if (patch.retries.backoffMs !== undefined) {
      normalized.retries.backoffMs = toPositiveInt(patch.retries.backoffMs, defaults.retries.backoffMs);
    }
  }
  if (patch.warmup) {
    normalized.warmup = {};
    if (patch.warmup.models !== undefined) {
      normalized.warmup.models = patch.warmup.models.map((item) => item.trim()).filter((item) => item.length > 0);
    }
    if (patch.warmup.prompt !== undefined) {
      normalized.warmup.prompt = toNonEmptyString(patch.warmup.prompt, defaults.warmup.prompt);
    }
  }

  return normalized;
}

function mergeConfig(defaultConfig: LlmRuntimeConfig, overrides: LlmRuntimeOverrides): LlmRuntimeConfig {
  return {
    enabled: overrides.enabled ?? defaultConfig.enabled,
    baseUrl: overrides.baseUrl ?? defaultConfig.baseUrl,
    models: {
      ...defaultConfig.models,
      ...(overrides.models ?? {}),
    },
    timeoutsMs: {
      ...defaultConfig.timeoutsMs,
      ...(overrides.timeoutsMs ?? {}),
    },
    retries: {
      ...defaultConfig.retries,
      ...(overrides.retries ?? {}),
    },
    warmup: {
      ...defaultConfig.warmup,
      ...(overrides.warmup ?? {}),
    },
  };
}

function mergeOverrides(current: LlmRuntimeOverrides, patch: LlmRuntimeOverrides): LlmRuntimeOverrides {
  return {
    ...current,
    ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    ...(patch.baseUrl !== undefined ? { baseUrl: patch.baseUrl } : {}),
    ...(patch.models ? { models: { ...(current.models ?? {}), ...patch.models } } : {}),
    ...(patch.timeoutsMs ? { timeoutsMs: { ...(current.timeoutsMs ?? {}), ...patch.timeoutsMs } } : {}),
    ...(patch.retries ? { retries: { ...(current.retries ?? {}), ...patch.retries } } : {}),
    ...(patch.warmup ? { warmup: { ...(current.warmup ?? {}), ...patch.warmup } } : {}),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toJsonValue(value: LlmRuntimeOverrides): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value || {})) as Prisma.InputJsonValue;
}

async function readOverridesFromDb(): Promise<LlmRuntimeOverrides> {
  try {
    const row = await prisma.runtimeSetting.findUnique({
      where: { key: runtimeSettingKey },
      select: { value: true },
    });
    if (!row || !isRecord(row.value)) {
      return {};
    }
    return normalizePatch(row.value as unknown as LlmRuntimeOverrides);
  } catch {
    return {};
  }
}

async function writeOverridesToDb(overrides: LlmRuntimeOverrides) {
  try {
    await prisma.runtimeSetting.upsert({
      where: { key: runtimeSettingKey },
      create: {
        key: runtimeSettingKey,
        value: toJsonValue(overrides),
      },
      update: {
        value: toJsonValue(overrides),
      },
    });
  } catch {
    // Intencional: falha de persistencia nao deve derrubar runtime.
  }
}

async function clearOverridesInDb() {
  try {
    await prisma.runtimeSetting.delete({ where: { key: runtimeSettingKey } });
  } catch {
    // Intencional: item pode nao existir.
  }
}

declare global {
  // eslint-disable-next-line no-var
  var __QUEST_LLM_RUNTIME_STATE__: LlmRuntimeState | undefined;
}

function getState(): LlmRuntimeState {
  if (!globalThis.__QUEST_LLM_RUNTIME_STATE__) {
    globalThis.__QUEST_LLM_RUNTIME_STATE__ = {
      overrides: {},
      loadedAt: 0,
      calls: [],
      sequence: 1,
    };
  }
  return globalThis.__QUEST_LLM_RUNTIME_STATE__;
}

async function ensureOverridesLoaded(state: LlmRuntimeState, force = false) {
  const now = Date.now();
  if (!force && state.loadedAt > 0 && now - state.loadedAt < overridesCacheTtlMs) {
    return;
  }
  state.overrides = await readOverridesFromDb();
  state.loadedAt = now;
}

export async function getResolvedLlmRuntimeConfig() {
  const state = getState();
  await ensureOverridesLoaded(state);
  return mergeConfig(readDefaultConfig(), state.overrides);
}

export async function getLlmRuntimeOverrides() {
  const state = getState();
  await ensureOverridesLoaded(state);
  return state.overrides;
}

export async function refreshLlmRuntimeOverrides() {
  const state = getState();
  await ensureOverridesLoaded(state, true);
  return state.overrides;
}

export async function updateLlmRuntimeOverrides(patch: LlmRuntimeOverrides) {
  const state = getState();
  await ensureOverridesLoaded(state);
  const normalized = normalizePatch(patch);
  state.overrides = mergeOverrides(state.overrides, normalized);
  await writeOverridesToDb(state.overrides);
  state.loadedAt = Date.now();
  return mergeConfig(readDefaultConfig(), state.overrides);
}

export async function resetLlmRuntimeOverrides() {
  const state = getState();
  state.overrides = {};
  state.loadedAt = Date.now();
  await clearOverridesInDb();
  return mergeConfig(readDefaultConfig(), state.overrides);
}

export function recordLlmCall(entry: Omit<LlmCallRecord, "id" | "at"> & { at?: string }) {
  const state = getState();
  const id = `llm-call-${Date.now()}-${state.sequence++}`;
  const call: LlmCallRecord = {
    id,
    at: entry.at ?? new Date().toISOString(),
    requestTag: entry.requestTag,
    model: entry.model,
    success: entry.success,
    attempts: entry.attempts,
    durationMs: entry.durationMs,
    code: entry.code,
    status: entry.status,
    details: entry.details,
  };
  state.calls = [call, ...state.calls].slice(0, maxCallHistory);
  return call;
}

export function getLlmCallHistory(limit = 60) {
  return getState().calls.slice(0, Math.max(1, limit));
}

export function getLlmCallSummary() {
  const calls = getState().calls;
  const total = calls.length;
  const success = calls.filter((call) => call.success).length;
  const failed = total - success;
  const lastSuccessAt = calls.find((call) => call.success)?.at ?? null;
  const lastFailureAt = calls.find((call) => !call.success)?.at ?? null;
  const byTag = calls.reduce<Record<string, { total: number; success: number; failed: number }>>((acc, call) => {
    if (!acc[call.requestTag]) {
      acc[call.requestTag] = { total: 0, success: 0, failed: 0 };
    }
    acc[call.requestTag].total += 1;
    if (call.success) {
      acc[call.requestTag].success += 1;
    } else {
      acc[call.requestTag].failed += 1;
    }
    return acc;
  }, {});

  return {
    total,
    success,
    failed,
    lastSuccessAt,
    lastFailureAt,
    byTag,
  };
}
