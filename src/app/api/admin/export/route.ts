import { NextResponse } from "next/server";
import { AdminScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/rbac";

function toCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const lines = [headers.join(",")];
  rows.forEach((row) => {
    lines.push(headers.map((header) => escape(row[header])).join(","));
  });
  return lines.join("\n");
}

export async function GET(req: Request) {
  try {
    await requireAdminScope([AdminScope.OPS, AdminScope.FINANCE, AdminScope.MODERATOR]);
    const { searchParams } = new URL(req.url);
    const entity = searchParams.get("entity") ?? "missions";

    if (entity === "missions") {
      const missions = await prisma.mission.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          patron: { select: { email: true } },
          assignedUser: { select: { email: true } },
        },
      });

      const csv = toCsv(
        missions.map((item) => ({
          id: item.id,
          title: item.title,
          status: item.status,
          category: item.category,
          minRank: item.minRank,
          deadlineAt: item.deadlineAt.toISOString(),
          city: item.city,
          state: item.state,
          neighborhood: item.neighborhood,
          patron: item.patron.email,
          assignedTo: item.assignedUser?.email ?? "",
          sponsored: item.sponsored,
          escrowStatus: item.escrowStatus,
        })),
      );

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=missions-export.csv",
        },
      });
    }

    if (entity === "users") {
      const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" } });
      const csv = toCsv(
        users.map((item) => ({
          id: item.id,
          email: item.email,
          role: item.role,
          adminScope: item.adminScope ?? "",
          status: item.status,
          city: item.city ?? "",
          state: item.state ?? "",
          createdAt: item.createdAt.toISOString(),
        })),
      );

      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": "attachment; filename=users-export.csv",
        },
      });
    }

    return NextResponse.json({ error: "Entity nao suportada." }, { status: 400 });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    return NextResponse.json({ error: "Falha ao exportar CSV." }, { status: 500 });
  }
}
