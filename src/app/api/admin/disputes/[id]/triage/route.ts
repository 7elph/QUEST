import { NextResponse } from "next/server";
import { AdminScope } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdminScope } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { OllamaError } from "@/lib/ollama";
import { runDisputeTriage } from "@/lib/dispute-triage";
import { captureServerError } from "@/lib/observability";
import { checkRateLimit, getClientKey } from "@/lib/rate-limit";

const triageSchema = z.object({
  model: z.string().min(1).max(80).optional(),
});

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await requireAdminScope([AdminScope.OPS, AdminScope.MODERATOR]);
    const rate = await checkRateLimit(getClientKey(req, `admin-dispute-triage:${params.id}:${session.user.id}`), 60, 10 * 60 * 1000);
    if (!rate.allowed) {
      return NextResponse.json({ error: "Muitas tentativas. Tente novamente em instantes." }, { status: 429 });
    }

    const body = await req.json().catch(() => ({}));
    const parsedBody = triageSchema.safeParse(body);

    if (!parsedBody.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const dispute = await prisma.dispute.findUnique({
      where: { id: params.id },
      include: {
        openedByUser: { select: { email: true, nick: true } },
        mission: {
          include: {
            patron: { select: { email: true, nick: true } },
            assignedUser: { select: { email: true, nick: true } },
            submissions: {
              orderBy: { submittedAt: "desc" },
              take: 6,
              include: {
                adventurer: { select: { email: true, nick: true } },
                revisions: { orderBy: { version: "desc" }, take: 5 },
              },
            },
            reviews: {
              orderBy: { createdAt: "desc" },
              take: 10,
            },
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Disputa nao encontrada." }, { status: 404 });
    }

    const result = await runDisputeTriage({
      model: parsedBody.data.model,
      context: {
        dispute: {
          id: dispute.id,
          reason: dispute.reason,
          evidenceNotes: dispute.evidenceNotes,
          createdAt: dispute.createdAt.toISOString(),
          openedBy: dispute.openedByUser.nick ?? dispute.openedByUser.email,
        },
        mission: {
          id: dispute.mission.id,
          title: dispute.mission.title,
          scope: dispute.mission.scope,
          status: dispute.mission.status,
          victoryConditions: dispute.mission.victoryConditions,
          deadlineAt: dispute.mission.deadlineAt.toISOString(),
          createdAt: dispute.mission.createdAt.toISOString(),
          patron: dispute.mission.patron.nick ?? dispute.mission.patron.email,
          assignedTo: dispute.mission.assignedUser
            ? (dispute.mission.assignedUser.nick ?? dispute.mission.assignedUser.email)
            : null,
        },
        submissions: dispute.mission.submissions.map((submission) => ({
          id: submission.id,
          by: submission.adventurer.nick ?? submission.adventurer.email,
          submittedAt: submission.submittedAt.toISOString(),
          status: submission.status,
          revisionCount: submission.revisionCount,
          notes: submission.notes,
          proofLinks: submission.proofLinks,
          proofFiles: submission.proofFiles,
          revisions: submission.revisions.map((revision) => ({
            version: revision.version,
            notes: revision.notes,
            proofLinks: revision.proofLinks,
            proofFiles: revision.proofFiles,
            createdAt: revision.createdAt.toISOString(),
          })),
        })),
        reviews: dispute.mission.reviews.map((review) => ({
          decision: review.decision,
          comment: review.comment,
          createdAt: review.createdAt.toISOString(),
        })),
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "DISPUTE_TRIAGE_AI",
      targetType: "Dispute",
      targetId: dispute.id,
      metadata: {
        model: result.model,
        recommendation: result.triage.recommendation,
        finalRecommendation: result.gate.finalRecommendation,
        recommendationOverridden: result.gate.wasOverridden,
        gateReasons: result.gate.reasons,
        confidence: result.triage.confidence,
        inconsistencies: result.triage.inconsistencies.length,
      },
    });

    return NextResponse.json({
      triage: result.triage,
      gate: result.gate,
      model: result.model,
      stats: {
        durationNs: result.durationNs,
        evalCount: result.evalCount,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Sem permissao." }, { status: 403 });
    }
    if (error instanceof OllamaError) {
      if (error.message === "OLLAMA_DISABLED") {
        return NextResponse.json({ error: "Ollama desativado no ambiente." }, { status: 503 });
      }
      if (error.message === "OLLAMA_TIMEOUT") {
        return NextResponse.json({ error: "Timeout no Ollama. Tente modelo menor." }, { status: 504 });
      }
      if (error.message === "OLLAMA_EMPTY_RESPONSE") {
        return NextResponse.json({ error: "Modelo retornou vazio. Tente novamente." }, { status: 502 });
      }
      return NextResponse.json({ error: "Falha ao chamar Ollama local." }, { status: 502 });
    }
    if (error instanceof Error && error.message === "TRIAGE_PARSE_FAILED") {
      return NextResponse.json({ error: "Modelo retornou formato invalido. Tente outro modelo." }, { status: 422 });
    }

    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao gerar triagem." }, { status: 500 });
  }
}
