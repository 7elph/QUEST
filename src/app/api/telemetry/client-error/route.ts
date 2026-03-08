import { NextResponse } from "next/server";
import { z } from "zod";
import { getServerAuthSession } from "@/lib/auth";
import { captureServerError } from "@/lib/observability";

const payloadSchema = z.object({
  message: z.string().min(2).max(1200),
  stack: z.string().max(8000).optional(),
  route: z.string().max(400).optional(),
  digest: z.string().max(100).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const parsed = payloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const session = await getServerAuthSession();
    const error = new Error(parsed.data.message);
    error.stack = parsed.data.stack;

    await captureServerError({
      error,
      req,
      statusCode: 500,
      source: "CLIENT",
      userId: session?.user?.id,
      metadata: {
        digest: parsed.data.digest ?? null,
      },
      route: parsed.data.route,
      method: "CLIENT",
    });

    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Falha ao registrar erro." }, { status: 500 });
  }
}

