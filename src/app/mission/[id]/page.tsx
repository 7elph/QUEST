export const dynamic = "force-dynamic";

import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { Role } from "@prisma/client";
import { getServerAuthSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MissionActions } from "@/components/app/mission-actions";
import { SlaCountdown } from "@/components/app/sla-countdown";
import { EscrowTimeline } from "@/components/app/escrow-timeline";
import { MissionChecklistProgress } from "@/components/app/mission-checklist-progress";
import { getCategoryDisplay } from "@/lib/mission-catalog";
import { getMissionRewardPreview } from "@/lib/mission-rewards";
import { canViewMissionDetails } from "@/lib/mission-visibility";

export default async function MissionDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerAuthSession();
  const mission = await prisma.mission.findUnique({
    where: { id: params.id },
    include: {
      submissions: {
        include: {
          adventurer: { select: { email: true, nick: true } },
          revisions: { orderBy: { version: "desc" } },
        },
        orderBy: { submittedAt: "desc" },
      },
      reviews: { orderBy: { createdAt: "desc" } },
      dispute: true,
      patron: { select: { id: true, email: true, nick: true } },
      assignedUser: { select: { id: true, email: true, nick: true } },
      progressRecords: {
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!mission) notFound();

  const role = session?.user?.role;
  if (!role || !canViewMissionDetails({
    role: role as Role,
    userId: session.user.id,
    patronId: mission.patronId,
    assignedTo: mission.assignedTo,
    status: mission.status,
  })) {
    redirect("/home");
  }

  const canAccept = !!session?.user && session.user.role === "ADVENTURER" && mission.status === "OPEN";
  const canSubmit =
    !!session?.user &&
    session.user.role === "ADVENTURER" &&
    mission.assignedTo === session.user.id &&
    ["ASSIGNED", "REVISION_REQUESTED"].includes(mission.status);
  const canReview =
    !!session?.user &&
    session.user.role === "PATRON" &&
    mission.patronId === session.user.id &&
    mission.status === "IN_REVIEW";
  const canSeeAllEvidence = !!session?.user && (session.user.role === "ADMIN" || canReview);
  const canSeeOwnEvidence = !!session?.user && canSubmit;
  const isAdventurer = session?.user?.role === "ADVENTURER";
  const canEditChecklist =
    !!session?.user &&
    session.user.role === "ADVENTURER" &&
    mission.assignedTo === session.user.id &&
    ["ASSIGNED", "IN_REVIEW", "REVISION_REQUESTED"].includes(mission.status);
  const checklistProgress = mission.progressRecords[0];
  const checklistState = checklistProgress?.checklistState ?? [];
  const checklistPct = checklistProgress?.completionPct ?? 0;
  const rewardPreview = getMissionRewardPreview(mission.id, mission.minRank);
  const visibleSubmissions = canSeeAllEvidence
    ? mission.submissions
    : canSeeOwnEvidence
      ? mission.submissions.filter((submission) => submission.adventurerId === session?.user?.id)
      : [];

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-amber-200/20 bg-black/20 p-5">
        <p className="text-xs text-amber-300/80">
          {getCategoryDisplay(mission.category)} • {mission.status} • min rank {mission.minRank}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-amber-200">
          {isAdventurer ? mission.rpgTitle ?? mission.title : mission.title}
        </h1>
        <p className="mt-2 text-sm text-amber-100/80">Patrono: {mission.patron.nick ?? mission.patron.email}</p>
        <p className="text-sm text-amber-100/80">Atribuida para: {mission.assignedUser?.nick ?? mission.assignedUser?.email ?? "-"}</p>
        <p className="text-sm text-amber-100/80">
          Local: {mission.city}/{mission.state} - {mission.neighborhood}
        </p>
        <p className="text-sm text-amber-100/80">Tipo: {mission.missionType}</p>
        <p className="text-sm text-amber-100/80">Formato desejado: {mission.desiredFormat ?? "-"}</p>
        <p className="text-sm text-amber-100/80">Max revisoes: {mission.maxRevisions}</p>
        <p className="inline-flex items-center gap-1.5 text-sm text-amber-100/90">
          <Image src="/assets/Crystal.png" alt="" aria-hidden width={15} height={15} className="h-[15px] w-[15px] object-contain" />
          Pagamento previsto: +{rewardPreview.enchantiun} Enchantiun
        </p>
        {rewardPreview.drop && (
          <p className="inline-flex items-center gap-1.5 text-sm text-amber-100/90">
            <Image src={rewardPreview.drop.iconPath} alt="" aria-hidden width={15} height={15} className="h-[15px] w-[15px] object-contain" />
            Drop possivel: {rewardPreview.drop.name}
          </p>
        )}
        <div className="mt-2">
          <SlaCountdown deadlineAt={mission.deadlineAt} completed={mission.status === "COMPLETED"} />
        </div>
        {isAdventurer ? (
          <>
            <p className="mt-3 text-amber-100/90">{mission.rpgNarrative ?? mission.narrative}</p>
            {mission.rpgRewardFlavor && <p className="mt-2 text-sm text-amber-200/90">{mission.rpgRewardFlavor}</p>}
          </>
        ) : (
          <p className="mt-3 text-amber-100/90">{mission.scope}</p>
        )}
        <h2 className="mt-4 font-semibold">Condicoes de Vitoria</h2>
        <ul className="ml-5 list-disc space-y-1 text-sm">
          {mission.victoryConditions.map((item, idx) => <li key={idx}>{item}</li>)}
        </ul>
      </section>

      {session?.user && <MissionActions missionId={mission.id} canAccept={canAccept} canSubmit={canSubmit} canReview={canReview} />}

      <EscrowTimeline status={mission.escrowStatus} />

      {mission.assignedTo && (
        <MissionChecklistProgress
          missionId={mission.id}
          conditions={mission.victoryConditions}
          canEdit={canEditChecklist}
          initialState={checklistState}
          completionPct={checklistPct}
          updatedAt={checklistProgress?.updatedAt.toISOString()}
        />
      )}

      <section className="rounded-xl border border-amber-200/20 bg-black/20 p-5">
        <h2 className="text-xl font-semibold">Provas enviadas</h2>
        <div className="mt-3 space-y-3">
          {visibleSubmissions.map((submission) => (
            <div key={submission.id} className="rounded-md border border-amber-100/15 p-3 text-sm">
              <p>Status: {submission.status} • Revisoes: {submission.revisionCount}</p>
              <p>Por: {submission.adventurer.nick ?? submission.adventurer.email}</p>
              <p>Notas atuais: {submission.notes ?? "-"}</p>
              {submission.proofLinks.length > 0 && (
                <a href={submission.proofLinks[0]} target="_blank" className="text-amber-300" rel="noreferrer">Abrir prova</a>
              )}
              <div className="mt-2 rounded-md border border-amber-100/10 bg-black/20 p-2">
                <p className="text-xs font-semibold text-amber-200">Historico de revisoes</p>
                <div className="mt-1 space-y-1 text-xs">
                  {submission.revisions.map((revision) => (
                    <p key={revision.id}>v{revision.version} • {new Date(revision.createdAt).toLocaleString("pt-BR")} • {revision.notes ?? "sem notas"}</p>
                  ))}
                  {submission.revisions.length === 0 && <p>Sem historico.</p>}
                </div>
              </div>
            </div>
          ))}
          {visibleSubmissions.length === 0 && (canSeeAllEvidence || canSeeOwnEvidence) && (
            <p className="text-sm text-amber-100/75">Sem provas enviadas.</p>
          )}
          {!canSeeAllEvidence && !canSeeOwnEvidence && (
            <p className="text-sm text-amber-100/75">
              As provas ficam visiveis apos atribuicao da missao ou para o patrono responsavel.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
