import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { resetDemoData } from "@/lib/seed";
import { AdminScope } from "@prisma/client";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  const scope = session?.user?.adminScope;
  const allowedScope = scope === AdminScope.SUPER_ADMIN || scope === null || scope === undefined;

  if (!session?.user || session.user.role !== "ADMIN" || !allowedScope) {
    return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
  }

  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Disponível apenas fora de produção." }, { status: 400 });
  }

  const rate = await checkRateLimit(
    getClientKey(req, `admin-reset-demo:${session.user.id}`),
    5,
    60 * 60 * 1000,
  );
  if (!rate.allowed) {
    return NextResponse.json({ error: "Muitas tentativas. Tente novamente mais tarde." }, { status: 429 });
  }

  await resetDemoData();
  return NextResponse.json({ success: true });
}
