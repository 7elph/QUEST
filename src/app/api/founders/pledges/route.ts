import { NextResponse } from "next/server";
import { FounderTier } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/rbac";
import { sanitizeText } from "@/lib/sanitize";
import { writeAuditLog } from "@/lib/audit";
import { pushNotification } from "@/lib/notifications";

const founderSchema = z.object({
  tier: z.nativeEnum(FounderTier),
  proofUrl: z.string().max(400).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await requireSession();
    const body = await req.json();
    const parsed = founderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const pledge = await prisma.founderPledge.create({
      data: {
        userId: session.user.id,
        tier: parsed.data.tier,
        proofUrl: parsed.data.proofUrl ? sanitizeText(parsed.data.proofUrl) : null,
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "FOUNDER_PLEDGE_CREATED",
      targetType: "FounderPledge",
      targetId: pledge.id,
      metadata: { tier: pledge.tier },
    });

    const admins = await prisma.user.findMany({
      where: {
        role: "ADMIN",
        OR: [{ adminScope: "FINANCE" }, { adminScope: "SUPER_ADMIN" }],
      },
      select: { id: true },
    });

    await Promise.all(
      admins.map((admin) =>
        pushNotification({
          userId: admin.id,
          type: "FOUNDER",
          title: "Novo apoio founder",
          message: `Novo pledge ${pledge.tier} aguardando confirmacao manual.`,
          metadata: { pledgeId: pledge.id },
        }),
      ),
    );

    return NextResponse.json({ pledge }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    return NextResponse.json({ error: "Falha ao criar pledge." }, { status: 500 });
  }
}

export async function GET() {
  const pledges = await prisma.founderPledge.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, email: true, nick: true } },
    },
  });

  return NextResponse.json({ pledges });
}
