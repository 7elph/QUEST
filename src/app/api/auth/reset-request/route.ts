import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { sendEmail } from "@/lib/email";
import { captureServerError } from "@/lib/observability";

const requestSchema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    const rate = await checkRateLimit(getClientKey(req, "reset-request"), 5, 15 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente mais tarde." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "E-mail inválido." }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const emailRate = await checkRateLimit(`reset-request:email:${email}`, 3, 15 * 60 * 1000);
    if (!emailRate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas para este e-mail. Tente mais tarde." }, { status: 429 });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return NextResponse.json({ success: true });
    }

    const rawToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const now = new Date();

    await prisma.$transaction([
      prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      }),
      prisma.passwordResetToken.create({
        data: {
          userId: user.id,
          tokenHash,
          expiresAt,
        },
      }),
    ]);

    await writeAuditLog({
      actorId: user.id,
      action: "PASSWORD_RESET_REQUESTED",
      targetType: "User",
      targetId: user.id,
    });

    await sendEmail({
      to: user.email,
      subject: "Recuperacao de senha QUEST",
      text: `Seu token de reset (Alpha): ${rawToken}. Valido por 1 hora.`,
    });

    const canExposeAlphaToken = process.env.ALPHA_MODE === "true" || process.env.NODE_ENV !== "production";
    return NextResponse.json({
      success: true,
      ...(canExposeAlphaToken ? { alphaToken: rawToken } : {}),
    });
  } catch (error) {
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao solicitar reset." }, { status: 500 });
  }
}
