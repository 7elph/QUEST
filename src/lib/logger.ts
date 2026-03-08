type LogLevel = "debug" | "info" | "warn" | "error";

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function normalizeLevel(value: string | undefined): LogLevel {
  if (!value) return "info";
  const lower = value.toLowerCase();
  if (lower === "debug" || lower === "info" || lower === "warn" || lower === "error") {
    return lower;
  }
  return "info";
}

function shouldLog(level: LogLevel) {
  const minLevel = normalizeLevel(process.env.LOG_LEVEL);
  return levelRank[level] >= levelRank[minLevel];
}

function log(level: LogLevel, payload?: unknown, message?: string) {
  if (!shouldLog(level)) return;

  const msg = typeof payload === "string" && !message ? payload : message ?? "";
  const meta = typeof payload === "string" ? undefined : payload;
  const entry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...(meta !== undefined ? { meta } : {}),
  };

  const line = JSON.stringify(entry);
  if (level === "error") {
    console.error(line);
    return;
  }
  if (level === "warn") {
    console.warn(line);
    return;
  }
  if (level === "info") {
    console.info(line);
    return;
  }
  console.debug(line);
}

export const logger = {
  debug(payload?: unknown, message?: string) {
    log("debug", payload, message);
  },
  info(payload?: unknown, message?: string) {
    log("info", payload, message);
  },
  warn(payload?: unknown, message?: string) {
    log("warn", payload, message);
  },
  error(payload?: unknown, message?: string) {
    log("error", payload, message);
  },
};
