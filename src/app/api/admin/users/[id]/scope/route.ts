import { NextResponse } from "next/server";
import { AdminScope } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/rbac";
import { captureServerError } from "@/lib/observability";

const scopeSchema = z.object({
  adminScope: z.nativeEnum(AdminScope),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    await requireAdminScope([AdminScope.SUPER_ADMIN]);
    const body = await req.json();
    const parsed = scopeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data: { adminScope: parsed.data.adminScope },
      select: { id: true, email: true, adminScope: true },
    });

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao atualizar scope." }, { status: 500 });
  }
}
