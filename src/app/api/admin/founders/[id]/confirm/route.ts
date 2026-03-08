import { NextResponse } from "next/server";
import { AdminScope, FounderPledgeStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { pushNotification } from "@/lib/notifications";

export async function POST(_: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdminScope([AdminScope.FINANCE, AdminScope.OPS]);

    const pledge = await prisma.founderPledge.update({
      where: { id: params.id },
      data: { status: FounderPledgeStatus.CONFIRMED },
    });

    const tierBadge =
      pledge.tier === "PATRONO_INICIAL"
        ? "Patrono Inicial"
        : pledge.tier === "FUNDADOR"
          ? "Fundador"
          : "Iniciado";

    const profile = await prisma.profile.findUnique({ where: { userId: pledge.userId } });

    if (profile) {
      const badges = [...(profile.badges ?? [])];
      if (!badges.includes(tierBadge)) {
        badges.push(tierBadge);
      }

      await prisma.profile.update({
        where: { id: profile.id },
        data: {
          badges,
        },
      });
    }

    await writeAuditLog({
      actorId: session.user.id,
      action: "FOUNDER_PLEDGE_CONFIRMED",
      targetType: "FounderPledge",
      targetId: pledge.id,
    });

    const founderUser = await prisma.user.findUnique({
      where: { id: pledge.userId },
      select: { email: true },
    });

    await pushNotification({
      userId: pledge.userId,
      type: "FOUNDER",
      title: "Apoio founder confirmado",
      message: `Seu apoio no tier ${pledge.tier} foi confirmado.`,
      sendEmailTo: founderUser?.email,
    });

    return NextResponse.json({ pledge });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    return NextResponse.json({ error: "Falha ao confirmar founder." }, { status: 500 });
  }
}
