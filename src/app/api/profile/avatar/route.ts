import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getProfileAvatarById } from "@/lib/profile-avatars";
import { writeAuditLog } from "@/lib/audit";
import { captureServerError } from "@/lib/observability";

export async function POST(req: Request) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    const avatarId = typeof body?.avatarId === "string" ? body.avatarId : "";
    const avatar = getProfileAvatarById(avatarId);

    if (!avatar) {
      return NextResponse.json({ error: "Avatar invalido." }, { status: 400 });
    }

    await prisma.profile.upsert({
      where: { userId: session.user.id },
      update: {
        avatarUrl: avatar.previewSrc,
      },
      create: {
        userId: session.user.id,
        avatarUrl: avatar.previewSrc,
        skills: [],
        badges: [],
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "PROFILE_AVATAR_UPDATED",
      targetType: "Profile",
      targetId: session.user.id,
      metadata: {
        avatarId: avatar.id,
        avatarUrl: avatar.previewSrc,
      },
    });

    return NextResponse.json({ avatarUrl: avatar.previewSrc });
  } catch (error) {
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao atualizar avatar." }, { status: 500 });
  }
}
