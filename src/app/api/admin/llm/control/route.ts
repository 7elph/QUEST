import { NextResponse } from "next/server";
import { AdminScope } from "@prisma/client";
import { z } from "zod";
import { requireAdminScope } from "@/lib/rbac";
import { captureServerError } from "@/lib/observability";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { writeAuditLog } from "@/lib/audit";
import {
  getLlmCallHistory,
  getLlmCallSummary,
  getLlmRuntimeOverrides,
  getResolvedLlmRuntimeConfig,
  resetLlmRuntimeOverrides,
  updateLlmRuntimeOverrides,
} from "@/lib/llm-runtime-config";
import { ollamaGenerate, ollamaServerStatus, ollamaWarmup, OllamaError } from "@/lib/ollama";

const configSchema = z.object({
  enabled: z.boolean().optional(),
  baseUrl: z.string().min(1).max(300).optional(),
  models: z
    .object({
      default: z.string().min(1).max(120).optional(),
      mission: z.string().min(1).max(120).optional(),
      simulation: z.string().min(1).max(120).optional(),
      dispute: z.string().min(1).max(120).optional(),
      rpg: z.string().min(1).max(120).optional(),
    })
    .optional(),
  timeoutsMs: z
    .object({
      default: z.number().int().min(1000).max(300000).optional(),
      mission: z.number().int().min(1000).max(300000).optional(),
      simulation: z.number().int().min(1000).max(300000).optional(),
      dispute: z.number().int().min(1000).max(300000).optional(),
      rpg: z.number().int().min(1000).max(300000).optional(),
    })
    .optional(),
  retries: z
    .object({
      attempts: z.number().int().min(0).max(6).optional(),
      backoffMs: z.number().int().min(100).max(10000).optional(),
    })
    .optional(),
  warmup: z
    .object({
      models: z.array(z.string().min(1).max(120)).max(16).optional(),
      prompt: z.string().min(1).max(3000).optional(),
    })
    .optional(),
});

const requestSchema = z.object({
  action: z.enum(["update", "reset", "test", "warmup"]).default("update"),
  config: configSchema.optional(),
  prompt: z.string().min(1).max(3000).optional(),
  model: z.string().min(1).max(120).optional(),
  warmupModels: z.array(z.string().min(1).max(120)).max(16).optional(),
  warmupPrompt: z.string().min(1).max(3000).optional(),
});

async function buildSnapshot() {
  const [runtime, overrides, server] = await Promise.all([
    getResolvedLlmRuntimeConfig(),
    getLlmRuntimeOverrides(),
    ollamaServerStatus(5000),
  ]);
  return {
    runtime,
    overrides,
    server,
    telemetry: {
      summary: getLlmCallSummary(),
      calls: getLlmCallHistory(60),
    },
  };
}

function mapOllamaError(error: OllamaError) {
  if (error.code === "OLLAMA_DISABLED") {
    return { status: 503, message: "Ollama esta desativado no runtime atual." };
  }
  if (error.code === "OLLAMA_TIMEOUT") {
    return { status: 504, message: "Timeout ao chamar Ollama." };
  }
  if (error.code === "OLLAMA_EMPTY_RESPONSE") {
    return { status: 502, message: "Modelo respondeu vazio." };
  }
  if (error.code === "OLLAMA_HTTP_ERROR") {
    return { status: 502, message: "Erro HTTP do servidor Ollama." };
  }
  return { status: 502, message: "Falha de conectividade com Ollama." };
}

export async function GET(req: Request) {
  try {
    const session = await requireAdminScope([AdminScope.OPS, AdminScope.MODERATOR, AdminScope.FINANCE]);
    const rate = await checkRateLimit(getClientKey(req, `admin-llm-control:get:${session.user.id}`), 120, 10 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas consultas. Aguarde alguns segundos." }, { status: 429 });
    }

    return NextResponse.json(await buildSnapshot());
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao carregar controle de LLM." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireAdminScope([AdminScope.OPS, AdminScope.MODERATOR, AdminScope.FINANCE]);
    const rate = await checkRateLimit(getClientKey(req, `admin-llm-control:post:${session.user.id}`), 80, 10 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas acoes. Tente novamente em instantes." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    if (parsed.data.action === "update") {
      const runtime = await updateLlmRuntimeOverrides(parsed.data.config ?? {});
      await writeAuditLog({
        actorId: session.user.id,
        action: "LLM_RUNTIME_UPDATED",
        targetType: "System",
        targetId: "llm-runtime",
        metadata: {
          enabled: runtime.enabled,
          baseUrl: runtime.baseUrl,
        },
      });
      return NextResponse.json({
        message: "Configuracao runtime da LLM atualizada.",
        ...(await buildSnapshot()),
      });
    }

    if (parsed.data.action === "reset") {
      await resetLlmRuntimeOverrides();
      await writeAuditLog({
        actorId: session.user.id,
        action: "LLM_RUNTIME_RESET",
        targetType: "System",
        targetId: "llm-runtime",
        metadata: {},
      });
      return NextResponse.json({
        message: "Configuracao runtime da LLM resetada para os valores do .env.",
        ...(await buildSnapshot()),
      });
    }

    if (parsed.data.action === "warmup") {
      const warmup = await ollamaWarmup({
        models: parsed.data.warmupModels,
        prompt: parsed.data.warmupPrompt,
      });
      await writeAuditLog({
        actorId: session.user.id,
        action: "LLM_RUNTIME_WARMUP",
        targetType: "System",
        targetId: "llm-runtime",
        metadata: {
          count: warmup.count,
          failed: warmup.results.filter((item) => !item.ok).length,
        },
      });
      return NextResponse.json({
        message: warmup.count > 0 ? "Warmup executado." : "Nenhum modelo para warmup.",
        warmup,
        ...(await buildSnapshot()),
      });
    }

    const runtime = await getResolvedLlmRuntimeConfig();
    const prompt = parsed.data.prompt ?? runtime.warmup.prompt;
    const model = parsed.data.model ?? runtime.models.default;
    const output = await ollamaGenerate({
      model,
      prompt,
      temperature: 0,
      timeoutMs: runtime.timeoutsMs.default,
      retries: 0,
      requestTag: "ADMIN_PIPELINE_TEST",
    });
    await writeAuditLog({
      actorId: session.user.id,
      action: "LLM_RUNTIME_TEST",
      targetType: "System",
      targetId: "llm-runtime",
      metadata: {
        model: output.model,
        chars: output.text.length,
      },
    });
    return NextResponse.json({
      message: "Teste de modelo executado.",
      test: {
        model: output.model,
        response: output.text.slice(0, 1800),
        durationNs: output.durationNs,
        evalCount: output.evalCount,
      },
      ...(await buildSnapshot()),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    if (error instanceof OllamaError) {
      const mapped = mapOllamaError(error);
      return NextResponse.json({ error: mapped.message, code: error.code }, { status: mapped.status });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao executar acao de controle LLM." }, { status: 500 });
  }
}
