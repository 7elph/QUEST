import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { z } from "zod";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";
import { captureServerError } from "@/lib/observability";
import { sanitizeText } from "@/lib/sanitize";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, validatePasswordPolicy } from "@/lib/password-policy";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH).max(PASSWORD_MAX_LENGTH),
  role: z.enum([Role.ADVENTURER, Role.PATRON]),
  name: z.string().trim().min(2).max(80),
  nick: z.string().trim().min(2).max(40).optional(),
  city: z.string().trim().max(80).optional(),
  state: z.string().trim().max(80).optional(),
  phone: z.string().trim().max(30).optional(),
});

export async function POST(req: Request) {
  try {
    const rate = await checkRateLimit(getClientKey(req, "register"), 8, 15 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente mais tarde." }, { status: 429 });
    }

    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Dados de cadastro inválidos." }, { status: 400 });
    }

    const passwordValidation = validatePasswordPolicy(parsed.data.password);
    if (!passwordValidation.valid) {
      return NextResponse.json({ error: passwordValidation.errors[0] ?? "Senha fraca." }, { status: 400 });
    }

    const email = parsed.data.email.trim().toLowerCase();
    const emailRate = await checkRateLimit(`register:email:${email}`, 4, 15 * 60 * 1000);
    if (!emailRate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas para este e-mail. Tente mais tarde." }, { status: 429 });
    }

    const name = sanitizeText(parsed.data.name);
    const nick = parsed.data.nick ? sanitizeText(parsed.data.nick) : undefined;
    const city = parsed.data.city ? sanitizeText(parsed.data.city) : undefined;
    const state = parsed.data.state ? sanitizeText(parsed.data.state) : undefined;
    const phone = parsed.data.phone ? sanitizeText(parsed.data.phone) : undefined;

    if (name.length < 2) {
      return NextResponse.json({ error: "Nome inválido." }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return NextResponse.json({ error: "E-mail já cadastrado." }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: parsed.data.role,
        name,
        nick,
        city,
        state,
        phone,
        profile: {
          create: {
            skills: [],
            badges: [],
          },
        },
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    await writeAuditLog({
      actorId: user.id,
      action: "USER_REGISTERED",
      targetType: "User",
      targetId: user.id,
      metadata: { role: user.role },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao registrar usuario." }, { status: 500 });
  }
}
