import type { ErrorSource, Prisma } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { writeAuditLog } from "@/lib/audit";
import { readRequestIdFromRequest } from "@/lib/request-id";

type CaptureErrorInput = {
  error: unknown;
  req?: Request;
  route?: string;
  method?: string;
  statusCode?: number;
  userId?: string;
  source?: ErrorSource;
  metadata?: Prisma.InputJsonValue;
};

function normalizeError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }
  return new Error(typeof error === "string" ? error : "Unknown error");
}

function truncate(value: string | undefined, max: number) {
  if (!value) return undefined;
  return value.length > max ? value.slice(0, max) : value;
}

function resolveRoute(input: { req?: Request; route?: string }) {
  if (input.route) return input.route;
  if (!input.req) return undefined;
  try {
    return new URL(input.req.url).pathname;
  } catch {
    return undefined;
  }
}

export async function captureServerError(input: CaptureErrorInput) {
  const err = normalizeError(input.error);
  const route = resolveRoute(input);
  const method = input.method ?? input.req?.method;
  const requestId = input.req ? readRequestIdFromRequest(input.req) : null;
  const source = input.source ?? "SERVER";

  logger.error(
    {
      requestId,
      route,
      method,
      statusCode: input.statusCode ?? 500,
      message: err.message,
    },
    "SERVER_ERROR",
  );

  if ((process.env.SENTRY_ENABLED ?? "false").toLowerCase() === "true") {
    Sentry.withScope((scope) => {
      scope.setTag("source", source);
      if (requestId) scope.setTag("request_id", requestId);
      if (route) scope.setTag("route", route);
      if (method) scope.setTag("method", method);
      if (input.statusCode) scope.setTag("status_code", String(input.statusCode));
      if (input.userId) scope.setUser({ id: input.userId });
      if (input.metadata) {
        scope.setContext("metadata", { payload: input.metadata });
      }
      Sentry.captureException(err);
    });
  }

  try {
    const event = await prisma.errorEvent.create({
      data: {
        requestId: requestId ?? undefined,
        route,
        method,
        statusCode: input.statusCode ?? 500,
        source,
        message: truncate(err.message, 1200) ?? "Unknown error",
        stack: truncate(err.stack, 8000),
        userId: input.userId,
        metadata: input.metadata,
      },
    });

    await writeAuditLog({
      actorId: input.userId,
      action: "ERROR_CAPTURED",
      targetType: "ErrorEvent",
      targetId: event.id,
      metadata: {
        source,
        route,
        method,
        statusCode: input.statusCode ?? 500,
        requestId,
      },
    });
  } catch (persistError) {
    logger.error({ error: persistError instanceof Error ? persistError.message : String(persistError) }, "ERROR_EVENT_PERSIST_FAILED");
  }
}

