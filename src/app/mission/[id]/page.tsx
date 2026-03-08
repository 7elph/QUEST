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
  const surfaceClass =
    "relative mx-auto w-full max-w-5xl overflow-hidden rounded-xl border border-[#6a4029]/35";
  const surfaceBackgroundClass =
    "absolute inset-0 bg-[url('/assets/fundo_missao.png')] bg-no-repeat bg-center [background-size:100%_100%]";

  return (
    <section className={surfaceClass}>
      <div className={surfaceBackgroundClass} />
      <div className="relative space-y-5 p-5 text-[#1b130f] md:p-7">
        <div>
          <p className="text-xs font-semibold text-[#5a3829]/85">
            {getCategoryDisplay(mission.category)} • {mission.status} • min rank {mission.minRank}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-[#1b130f]">
            {isAdventurer ? mission.rpgTitle ?? mission.title : mission.title}
          </h1>
          <p className="mt-2 text-sm text-[#2a1a13]">Patrono: {mission.patron.nick ?? mission.patron.email}</p>
          <p className="text-sm text-[#2a1a13]">Atribuida para: {mission.assignedUser?.nick ?? mission.assignedUser?.email ?? "-"}</p>
          <p className="text-sm text-[#2a1a13]">
            Local: {mission.city}/{mission.state} - {mission.neighborhood}
          </p>
          <p className="text-sm text-[#2a1a13]">Tipo: {mission.missionType}</p>
          <p className="text-sm text-[#2a1a13]">Formato desejado: {mission.desiredFormat ?? "-"}</p>
          <p className="text-sm text-[#2a1a13]">Max revisoes: {mission.maxRevisions}</p>
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2a1a13]">
            <Image src="/assets/Crystal.png" alt="" aria-hidden width={15} height={15} className="h-[15px] w-[15px] object-contain" />
            Pagamento previsto: +{rewardPreview.enchantiun} Enchantiun
          </p>
          {rewardPreview.drop && (
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#2a1a13]">
              <Image src={rewardPreview.drop.iconPath} alt="" aria-hidden width={15} height={15} className="h-[15px] w-[15px] object-contain" />
              Drop possivel: {rewardPreview.drop.name}
            </p>
          )}
          <div className="mt-2">
            <SlaCountdown deadlineAt={mission.deadlineAt} completed={mission.status === "COMPLETED"} />
          </div>
          {isAdventurer ? (
            <>
              <p className="mt-3 text-[#2a1a13]">{mission.rpgNarrative ?? mission.narrative}</p>
              {mission.rpgRewardFlavor && <p className="mt-2 text-sm font-semibold text-[#5a3829]">{mission.rpgRewardFlavor}</p>}
            </>
          ) : (
            <p className="mt-3 text-[#2a1a13]">{mission.scope}</p>
          )}
          <h2 className="mt-4 font-semibold text-[#1b130f]">Condicoes de Vitoria</h2>
          <ul className="ml-5 list-disc space-y-1 text-sm text-[#2a1a13]">
            {mission.victoryConditions.map((item, idx) => <li key={idx}>{item}</li>)}
          </ul>
        </div>

        {session?.user && (
          <div className="border-t border-[#5a3829]/20 pt-4">
            <MissionActions missionId={mission.id} canAccept={canAccept} canSubmit={canSubmit} canReview={canReview} />
          </div>
        )}

        <div className="border-t border-[#5a3829]/20 pt-4">
          <EscrowTimeline status={mission.escrowStatus} />
        </div>

        {mission.assignedTo && (
          <div className="border-t border-[#5a3829]/20 pt-4">
            <MissionChecklistProgress
              missionId={mission.id}
              conditions={mission.victoryConditions}
              canEdit={canEditChecklist}
              initialState={checklistState}
              completionPct={checklistPct}
              updatedAt={checklistProgress?.updatedAt.toISOString()}
            />
          </div>
        )}

        <div className="border-t border-[#5a3829]/20 pt-4">
          <h2 className="text-xl font-semibold">Provas enviadas</h2>
          <div className="mt-3 space-y-3">
            {visibleSubmissions.map((submission) => (
              <div key={submission.id} className="border-b border-[#5a3829]/20 pb-3 text-sm last:border-b-0">
                <p>Status: {submission.status} • Revisoes: {submission.revisionCount}</p>
                <p>Por: {submission.adventurer.nick ?? submission.adventurer.email}</p>
                <p>Notas atuais: {submission.notes ?? "-"}</p>
                {submission.proofLinks.length > 0 && (
                  <a href={submission.proofLinks[0]} target="_blank" className="font-semibold text-[#5a3829] underline" rel="noreferrer">Abrir prova</a>
                )}
                <div className="mt-2 border-l-2 border-[#5a3829]/30 pl-2">
                  <p className="text-xs font-semibold text-[#5a3829]">Historico de revisoes</p>
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
              <p className="text-sm text-[#3d271c]/80">Sem provas enviadas.</p>
            )}
            {!canSeeAllEvidence && !canSeeOwnEvidence && (
              <p className="text-sm text-[#3d271c]/80">
                As provas ficam visiveis apos atribuicao da missao ou para o patrono responsavel.
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
