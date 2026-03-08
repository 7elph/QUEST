import { NextResponse } from "next/server";
import { AdminScope } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/rbac";
import { sanitizeText } from "@/lib/sanitize";
import { writeAuditLog } from "@/lib/audit";

const announcementSchema = z.object({
  title: z.string().min(3).max(120),
  content: z.string().min(3).max(3000),
});

export async function GET() {
  const items = await prisma.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 20 });
  return NextResponse.json({ announcements: items });
}

export async function POST(req: Request) {
  try {
    const session = await requireAdminScope([AdminScope.OPS]);
    const body = await req.json();
    const parsed = announcementSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const announcement = await prisma.announcement.create({
      data: {
        title: sanitizeText(parsed.data.title),
        content: sanitizeText(parsed.data.content),
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "ANNOUNCEMENT_CREATED",
      targetType: "Announcement",
      targetId: announcement.id,
    });

    return NextResponse.json({ announcement }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    return NextResponse.json({ error: "Falha ao criar anuncio." }, { status: 500 });
  }
}
