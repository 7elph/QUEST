import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";
import { captureServerError } from "@/lib/observability";
import { assessmentPayloadSchema, assessmentQuestions, computeAssessment, skillLabels } from "@/lib/adventurer-assessment";

export async function GET(req: Request) {
  try {
    const session = await requireRole([Role.ADVENTURER]);
    const assessment = await prisma.adventurerAssessment.findUnique({
      where: { userId: session.user.id },
    });

    const questions = assessmentQuestions.map((question) => ({
      id: question.id,
      title: question.title,
      options: question.options.map((option) => ({ id: option.id, label: option.label })),
    }));

    return NextResponse.json({
      questions,
      assessment: assessment
        ? {
            id: assessment.id,
            resultProfile: assessment.resultProfile,
            dominantSkills: assessment.dominantSkills,
            skillScores: assessment.skillScores,
            completedAt: assessment.completedAt.toISOString(),
          }
        : null,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Apenas aventureiros podem acessar." }, { status: 403 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao carregar avaliacao." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await requireRole([Role.ADVENTURER]);
    const body = await req.json();
    const parsed = assessmentPayloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Payload invalido." }, { status: 400 });
    }

    const answers = parsed.data.answers;
    const uniqueQuestionIds = new Set(answers.map((item) => item.questionId));
    if (uniqueQuestionIds.size !== assessmentQuestions.length) {
      return NextResponse.json({ error: "Responda todas as perguntas uma unica vez." }, { status: 400 });
    }

    for (const question of assessmentQuestions) {
      const answer = answers.find((item) => item.questionId === question.id);
      if (!answer) {
        return NextResponse.json({ error: "Questionario incompleto." }, { status: 400 });
      }
      if (!question.options.some((option) => option.id === answer.optionId)) {
        return NextResponse.json({ error: "Opcao invalida no questionario." }, { status: 400 });
      }
    }

    const result = computeAssessment(answers);
    const skills = result.dominantSkills.map((key) => skillLabels[key]);

    const assessment = await prisma.adventurerAssessment.upsert({
      where: { userId: session.user.id },
      update: {
        resultProfile: result.profile,
        dominantSkills: result.dominantSkills,
        skillScores: result.scores,
        answers,
        completedAt: new Date(),
      },
      create: {
        userId: session.user.id,
        resultProfile: result.profile,
        dominantSkills: result.dominantSkills,
        skillScores: result.scores,
        answers,
      },
    });

    await prisma.profile.upsert({
      where: { userId: session.user.id },
      update: {
        skills,
        badges: {
          set: await (async () => {
            const current = await prisma.profile.findUnique({
              where: { userId: session.user.id },
              select: { badges: true },
            });
            const badge = "Perfil mapeado";
            const merged = new Set([...(current?.badges ?? []), badge]);
            return Array.from(merged);
          })(),
        },
      },
      create: {
        userId: session.user.id,
        skills,
        badges: ["Perfil mapeado"],
      },
    });

    await writeAuditLog({
      actorId: session.user.id,
      action: "ADVENTURER_ASSESSMENT_COMPLETED",
      targetType: "AdventurerAssessment",
      targetId: assessment.id,
      metadata: {
        profile: result.profile,
        dominantSkills: result.dominantSkills,
      },
    });

    return NextResponse.json({
      assessment: {
        id: assessment.id,
        resultProfile: assessment.resultProfile,
        dominantSkills: assessment.dominantSkills,
        skillScores: assessment.skillScores,
        completedAt: assessment.completedAt.toISOString(),
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Nao autenticado." }, { status: 401 });
    }
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Apenas aventureiros podem enviar avaliacao." }, { status: 403 });
    }
    await captureServerError({ error, req, statusCode: 500 });
    return NextResponse.json({ error: "Falha ao processar avaliacao." }, { status: 500 });
  }
}
