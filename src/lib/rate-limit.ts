import { prisma } from "@/lib/prisma";

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const memoryStore = new Map<string, RateLimitEntry>();

export async function checkRateLimit(key: string, maxAttempts = 5, windowMs = 15 * 60 * 1000) {
  if (process.env.RATE_LIMIT_STORE === "db") {
    const now = new Date();
    const reset = new Date(now.getTime() + windowMs);
    const current = await prisma.rateLimitBucket.findUnique({ where: { key } });

    if (!current || current.resetAt <= now) {
      await prisma.rateLimitBucket.upsert({
        where: { key },
        update: { count: 1, resetAt: reset },
        create: { key, count: 1, resetAt: reset },
      });
      return { allowed: true, remaining: maxAttempts - 1, resetAt: reset.getTime() };
    }

    if (current.count >= maxAttempts) {
      return { allowed: false, remaining: 0, resetAt: current.resetAt.getTime() };
    }

    const updated = await prisma.rateLimitBucket.update({
      where: { key },
      data: { count: { increment: 1 } },
    });

    return { allowed: true, remaining: maxAttempts - updated.count, resetAt: updated.resetAt.getTime() };
  }

  const now = Date.now();
  const current = memoryStore.get(key);

  if (!current || current.resetAt <= now) {
    memoryStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxAttempts - 1, resetAt: now + windowMs };
  }

  if (current.count >= maxAttempts) {
    return { allowed: false, remaining: 0, resetAt: current.resetAt };
  }

  current.count += 1;
  memoryStore.set(key, current);

  return { allowed: true, remaining: maxAttempts - current.count, resetAt: current.resetAt };
}

export function getClientKey(req: Request, seed: string): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() ?? "unknown";
  return `${seed}:${ip}`;
}
