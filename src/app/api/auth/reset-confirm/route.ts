import crypto from "crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { captureServerError } from "@/lib/observability";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validatePasswordPolicy } from "@/lib/password-policy";

const confirmSchema = z.object({
  token: z.string().min(20).max(256),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
});

export async function POST(req: Request) {
  try {
    const rate = await checkRateLimit(getClientKey(req, "reset-confirm"), 8, 15 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente mais tarde." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = confirmSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const passwordValidation = validatePasswordPolicy(parsed.data.password);
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.errors[0] ?? "Senha fraca." }, { status: 400 });
    }

    const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return NextResponse.json({ error: "Token inválido ou expirado." }, { status: 400 });
    }

    const currentUser = await prisma.user.findUnique({
      where: { id: resetToken.userId },
      select: { passwordHash: true },
    });

    if (!currentUser) {
      return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
    }

    const isSamePassword = await verifyPassword(parsed.data.password, currentUser.passwordHash);
    if (isSamePassword) {
      return NextResponse.json({ error: "A nova senha deve ser diferente da anterior." }, { status: 400 });
    }

    const now = new Date();
    const nextPasswordHash = await hashPassword(parsed.data.password);

    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: nextPasswordHash },
      }),
      prisma.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null },
        data: { usedAt: now },
      }),
    ]);

    await writeAuditLog({
      actorId: resetToken.userId,
      action: "PASSWORD_RESET_COMPLETED",
      targetType: "User",
      targetId: resetToken.userId,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao confirmar reset." }, { status: 500 });
  }
}
