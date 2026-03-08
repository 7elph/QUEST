import {
  AdminScope,
  Availability,
  BudgetRange,
  DeliverableFormat,
  EscrowStatus,
  FounderTier,
  MissionCategory,
  MissionStatus,
  MissionTemplateVisibility,
  RankName,
  RewardType,
  Role,
  SubmissionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { getCategoryDisplay, missionTypeCatalog, PIRACICABA_NEIGHBORHOODS } from "@/lib/mission-catalog";
import type { MissionTypePreset } from "@/lib/mission-catalog";
import { getLlmSimulatorIdentity } from "@/lib/simulation-agent";

const rankSeed = [
  { name: RankName.E, minXP: 0, maxXP: 99, perks: { bonus: "Acesso base" } },
  { name: RankName.D, minXP: 100, maxXP: 299, perks: { bonus: "Missoes D" } },
  { name: RankName.C, minXP: 300, maxXP: 699, perks: { bonus: "Missoes C" } },
  { name: RankName.B, minXP: 700, maxXP: 1299, perks: { bonus: "Prioridade no feed" } },
  { name: RankName.A, minXP: 1300, maxXP: 1999, perks: { bonus: "Selo de elite" } },
  { name: RankName.S, minXP: 2000, maxXP: 999999, perks: { bonus: "Lenda da guilda" } },
];

const localContexts = [
  "comercio local",
  "clinica",
  "restaurante",
  "prestador de servico",
  "loja",
  "operacao local",
];

const titlesByCategory: Record<MissionCategory, string[]> = {
  ATENDIMENTO_SUPORTE: [
    "Atendimento digital de leads inbound",
    "SAC remoto com registro em planilha",
    "Base FAQ para respostas padrao",
    "Tratativa de contatos pendentes",
  ],
  VENDAS_PROSPECCAO: [
    "Lista de prospects para outreach",
    "Sequencia curta de prospeccao",
    "Follow-up comercial digital",
    "Mapeamento de leads B2B local",
  ],
  OPERACOES_PLANILHAS: [
    "Higienizacao de base operacional",
    "Relatorio semanal de indicadores",
    "Padronizacao de rotina em planilha",
    "Consolidacao de dados de operacao",
  ],
  DESIGN_RAPIDO: [
    "Kit de cards para campanha local",
    "Pacote de stories para divulgacao",
    "Banner digital para oferta da semana",
    "Ajuste visual rapido de pecas",
  ],
  CONTEUDO_COPY: [
    "Copy para landing de captacao",
    "Roteiro curto para video social",
    "Sequencia de e-mails de nutricao",
    "Texto de anuncio para canal digital",
  ],
  SOCIAL_MEDIA_LOCAL: [
    "Calendario semanal de publicacoes",
    "Legendas para engajamento local",
    "Respostas padrao para comunidade",
    "Planejamento tatico de social local",
  ],
  AUTOMACAO_NO_CODE: [
    "Fluxo no-code para captura de leads",
    "Alertas operacionais automatizados",
    "Integracao de formulario com planilha",
    "Automacao de rotina administrativa",
  ],
};

const neighborhoodPlan: Array<(typeof PIRACICABA_NEIGHBORHOODS)[number]> = [
  "Centro",
  "Vila Rezende",
  "Pauliceia",
  "Santa Terezinha",
  "Nova Piracicaba",
  "Piracicamirim",
  "Dois Corregos",
  "Agua Branca",
  "Jaragua",
  "CECAP",
  "Centro",
  "Vila Rezende",
  "CECAP",
  "Santa Terezinha",
  "Nova Piracicaba",
  "Piracicamirim",
  "Dois Corregos",
  "Agua Branca",
  "Jaragua",
  "CECAP",
  "Pauliceia",
  "Centro",
  "Vila Rezende",
  "Santa Terezinha",
  "Nova Piracicaba",
  "Piracicamirim",
  "Dois Corregos",
  "CECAP",
];

function missionNarrative(title: string, scope: string, victoryConditions: string[]) {
  return `Tarefa: ${title}. Resultado final esperado: ${scope}. Checklist objetivo: ${victoryConditions.join("; ")}.`;
}

function missionRpgNarrative(category: MissionCategory, neighborhood: string, scope: string, victoryConditions: string[]) {
  return [
    `Em Piracicaba, no distrito de ${neighborhood}, a Guilda QUEST recebe um chamado de ${getCategoryDisplay(category)}.`,
    `Objetivo da missao: ${scope}`,
    `Condicoes de Vitoria: ${victoryConditions.map((item, idx) => `${idx + 1}. ${item}`).join(" ")}`,
  ].join(" ");
}

function deadlineByIndex(index: number) {
  const slots = [24, 48, 72, 7 * 24];
  return new Date(Date.now() + slots[index % slots.length] * 60 * 60 * 1000);
}

function normalizeBudget(range: BudgetRange) {
  return range === BudgetRange.PREMIUM ? BudgetRange.HIGH : range;
}

function pickDesiredFormat(index: number) {
  const values = ["Doc", "Sheets", "PDF", "Canva", "Link"];
  return values[index % values.length];
}

async function seedSystemTemplates() {
  for (const [category, presets] of Object.entries(missionTypeCatalog) as Array<[MissionCategory, MissionTypePreset[]]>) {
    const preset = presets[0];
    const item = {
      name: `${preset.label} (sistema)`,
      category,
      scopeTemplate: preset.scopeTemplate,
      victoryConditionsTemplate: preset.checklist,
      deliverableFormat: preset.deliverableFormat,
      budgetRange: normalizeBudget(preset.budgetRange),
      rewardType: normalizeBudget(preset.budgetRange) === BudgetRange.HIGH ? RewardType.MIXED : RewardType.TRAINING_XP,
      sponsoredDefault: normalizeBudget(preset.budgetRange) !== BudgetRange.LOW,
      narrativeTemplate: null,
    };

    const existing = await prisma.missionTemplate.findFirst({
      where: {
        visibility: MissionTemplateVisibility.SYSTEM,
        name: item.name,
      },
    });

    if (existing) {
      await prisma.missionTemplate.update({
        where: { id: existing.id },
        data: item,
      });
    } else {
      await prisma.missionTemplate.create({
        data: {
          ...item,
          visibility: MissionTemplateVisibility.SYSTEM,
        },
      });
    }
  }
}

export async function seedCoreData() {
  for (const rank of rankSeed) {
    await prisma.rank.upsert({
      where: { name: rank.name },
      update: { minXP: rank.minXP, maxXP: rank.maxXP, perks: rank.perks },
      create: rank,
    });
  }

  await seedSystemTemplates();

  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    throw new Error("ADMIN_EMAIL e ADMIN_PASSWORD sao obrigatorios para seed.");
  }

  const adminHash = await hashPassword(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail.toLowerCase() },
    update: {
      passwordHash: adminHash,
      role: Role.ADMIN,
      adminScope: AdminScope.SUPER_ADMIN,
      name: "Guild Master",
      nick: "Admin",
    },
    create: {
      email: adminEmail.toLowerCase(),
      passwordHash: adminHash,
      role: Role.ADMIN,
      adminScope: AdminScope.SUPER_ADMIN,
      name: "Guild Master",
      nick: "Admin",
      profile: {
        create: {
          skills: ["Governanca", "Arbitragem"],
          badges: ["Guild Master"],
          availability: Availability.FLEXIBLE,
        },
      },
    },
  });

  const simulatorIdentity = getLlmSimulatorIdentity();
  const simulatorHash = await hashPassword(simulatorIdentity.password);
  const simulatorUser = await prisma.user.upsert({
    where: { email: simulatorIdentity.email },
    update: {
      passwordHash: simulatorHash,
      role: Role.ADVENTURER,
      name: simulatorIdentity.name,
      nick: simulatorIdentity.nick,
      city: "Piracicaba",
      state: "SP",
      status: "ACTIVE",
    },
    create: {
      email: simulatorIdentity.email,
      passwordHash: simulatorHash,
      role: Role.ADVENTURER,
      name: simulatorIdentity.name,
      nick: simulatorIdentity.nick,
      city: "Piracicaba",
      state: "SP",
      profile: {
        create: {
          bio: "Agente de simulacao LLM para testes de jornada do app.",
          skills: ["Simulacao de fluxo", "Teste de UX", "Validacao de jornada"],
          badges: ["SIMULADOR_LLM"],
          availability: Availability.FLEXIBLE,
        },
      },
    },
  });

  await prisma.profile.upsert({
    where: { userId: simulatorUser.id },
    update: {
      bio: "Agente de simulacao LLM para testes de jornada do app.",
      skills: ["Simulacao de fluxo", "Teste de UX", "Validacao de jornada"],
      badges: ["SIMULADOR_LLM"],
      availability: Availability.FLEXIBLE,
    },
    create: {
      userId: simulatorUser.id,
      bio: "Agente de simulacao LLM para testes de jornada do app.",
      skills: ["Simulacao de fluxo", "Teste de UX", "Validacao de jornada"],
      badges: ["SIMULADOR_LLM"],
      availability: Availability.FLEXIBLE,
    },
  });

  return { adminId: admin.id };
}

export async function resetDemoData() {
  await prisma.$transaction([
    prisma.notificationDigest.deleteMany(),
    prisma.notification.deleteMany(),
    prisma.missionProgress.deleteMany(),
    prisma.adventurerAssessment.deleteMany(),
    prisma.missionScreening.deleteMany(),
    prisma.errorEvent.deleteMany(),
    prisma.auditLog.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.submissionRevision.deleteMany(),
    prisma.dispute.deleteMany(),
    prisma.review.deleteMany(),
    prisma.submission.deleteMany(),
    prisma.xPLog.deleteMany(),
    prisma.founderPledge.deleteMany(),
    prisma.mission.deleteMany(),
    prisma.missionDraft.deleteMany(),
    prisma.missionTemplate.deleteMany({ where: { visibility: MissionTemplateVisibility.PATRON } }),
    prisma.announcement.deleteMany(),
    prisma.rateLimitBucket.deleteMany(),
    prisma.profile.deleteMany({ where: { user: { role: { not: Role.ADMIN } } } }),
    prisma.user.deleteMany({ where: { role: { not: Role.ADMIN } } }),
  ]);

  const { adminId } = await seedCoreData();
  const commonHash = await hashPassword("Quest1234!");
  const enterpriseEmail = (process.env.DEMO_ENTERPRISE_EMAIL ?? "enterprise@quest.local").toLowerCase();
  const enterprisePassword = process.env.DEMO_ENTERPRISE_PASSWORD ?? "QuestEnterprise123!";
  const demoAdventurerEmail = (process.env.DEMO_ADVENTURER_EMAIL ?? "aventureiro.demo@quest.local").toLowerCase();
  const demoAdventurerPassword = process.env.DEMO_ADVENTURER_PASSWORD ?? "QuestAventura123!";
  const enterpriseHash = await hashPassword(enterprisePassword);
  const demoAdventurerHash = await hashPassword(demoAdventurerPassword);
  const rankE = await prisma.rank.findUniqueOrThrow({ where: { name: RankName.E } });

  const enterprisePatron = await prisma.user.create({
    data: {
      email: enterpriseEmail,
      passwordHash: enterpriseHash,
      role: Role.PATRON,
      name: "Enterprise Demo",
      nick: "EnterprisePiracicaba",
      city: "Piracicaba",
      state: "SP",
      profile: {
        create: {
          skills: ["Gestao", "Operacoes", "Planejamento"],
          badges: ["Enterprise Alpha"],
          availability: Availability.FLEXIBLE,
          rankId: rankE.id,
        },
      },
    },
  });

  if (enterpriseEmail !== "patrono@quest.local") {
    // Conta legada para compatibilidade com testes anteriores.
    await prisma.user.create({
      data: {
        email: "patrono@quest.local",
        passwordHash: commonHash,
        role: Role.PATRON,
        name: "Patrono Demo",
        nick: "PatronoPiracicaba",
        city: "Piracicaba",
        state: "SP",
        profile: {
          create: {
            skills: ["Gestao", "Operacoes"],
            badges: ["Patrono Alpha"],
            availability: Availability.FLEXIBLE,
            rankId: rankE.id,
          },
        },
      },
    });
  }

  const adventurer = await prisma.user.create({
    data: {
      email: demoAdventurerEmail,
      passwordHash: demoAdventurerHash,
      role: Role.ADVENTURER,
      name: "Aventureiro Demo",
      nick: "AventureiroPiracicaba",
      city: "Piracicaba",
      state: "SP",
      profile: {
        create: {
          skills: ["Operacoes & Planilhas", "Atendimento & Suporte"],
          badges: ["Alpha Pioneer"],
          availability: Availability.PART_TIME,
          rankId: rankE.id,
        },
      },
    },
  });

  if (demoAdventurerEmail !== "aventureiro@quest.local") {
    // Conta legada para compatibilidade com testes anteriores.
    await prisma.user.create({
      data: {
        email: "aventureiro@quest.local",
        passwordHash: commonHash,
        role: Role.ADVENTURER,
        name: "Aventureiro Demo",
        nick: "AventureiroPiracicaba",
        city: "Piracicaba",
        state: "SP",
        profile: {
          create: {
            skills: ["Operacoes & Planilhas", "Atendimento & Suporte"],
            badges: ["Alpha Pioneer"],
            availability: Availability.PART_TIME,
            rankId: rankE.id,
          },
        },
      },
    });
  }

  const missionsData: Array<{
    category: MissionCategory;
    title: string;
    missionType: string;
    scope: string;
    victoryConditions: string[];
    deliverableFormat: DeliverableFormat;
    budgetRange: BudgetRange;
    desiredFormat: string;
    neighborhood: (typeof PIRACICABA_NEIGHBORHOODS)[number];
  }> = [];

  let missionCounter = 0;
  for (const [category, titles] of Object.entries(titlesByCategory) as [MissionCategory, string[]][]) {
    const presets = missionTypeCatalog[category];
    for (let idx = 0; idx < 4; idx += 1) {
      const preset = presets[idx % presets.length];
      const context = localContexts[(missionCounter + idx) % localContexts.length];
      const neighborhood = neighborhoodPlan[missionCounter];
      missionsData.push({
        category,
        title: titles[idx],
        missionType: preset.label,
        scope: `${preset.scopeTemplate} Contexto: ${context} de Piracicaba (${neighborhood}).`,
        victoryConditions: preset.checklist.slice(0, Math.min(7, Math.max(3, preset.checklist.length))),
        deliverableFormat: preset.deliverableFormat,
        budgetRange: normalizeBudget(preset.budgetRange),
        desiredFormat: pickDesiredFormat(missionCounter),
        neighborhood,
      });
      missionCounter += 1;
    }
  }

  const assignedIndexes = new Set([4, 9, 14, 19, 24]);
  const missions = [];

  for (let i = 0; i < missionsData.length; i += 1) {
    const item = missionsData[i];
    const sponsored = item.budgetRange !== BudgetRange.LOW;
    const status = assignedIndexes.has(i) ? MissionStatus.ASSIGNED : MissionStatus.OPEN;
    const rewardType =
      item.budgetRange === BudgetRange.HIGH
        ? RewardType.MIXED
        : sponsored
          ? RewardType.SPONSORED_CASH
          : RewardType.TRAINING_XP;

    const mission = await prisma.mission.create({
      data: {
        patronId: enterprisePatron.id,
        title: item.title,
        narrative: missionNarrative(item.title, item.scope, item.victoryConditions),
        rpgTitle: `${item.title} - Contrato da Guilda`,
        rpgNarrative: missionRpgNarrative(item.category, item.neighborhood, item.scope, item.victoryConditions),
        rpgRewardFlavor: sponsored ? "Moedas do cofre + prestigio da guilda." : "XP de treino e reputacao local.",
        category: item.category,
        missionType: item.missionType,
        scope: item.scope,
        desiredFormat: item.desiredFormat,
        victoryConditions: item.victoryConditions,
        maxRevisions: 1,
        deliverableFormat: item.deliverableFormat,
        deadlineAt: deadlineByIndex(i),
        city: "Piracicaba",
        state: "SP",
        neighborhood: item.neighborhood,
        budgetRange: item.budgetRange,
        rewardType,
        sponsored,
        escrowStatus: sponsored ? EscrowStatus.PENDING : EscrowStatus.NONE,
        minRank: i < 8 ? RankName.E : i < 16 ? RankName.D : RankName.C,
        status,
        assignedTo: status === MissionStatus.ASSIGNED ? adventurer.id : null,
        assignedAt: status === MissionStatus.ASSIGNED ? new Date() : null,
      },
    });
    missions.push(mission);
  }

  const assignedMissions = missions.filter((_, idx) => assignedIndexes.has(idx)).slice(0, 5);
  const submissionStatuses: SubmissionStatus[] = [
    SubmissionStatus.SUBMITTED,
    SubmissionStatus.REVISION_REQUESTED,
    SubmissionStatus.ACCEPTED,
    SubmissionStatus.SUBMITTED,
    SubmissionStatus.ACCEPTED,
  ];

  for (let i = 0; i < assignedMissions.length; i += 1) {
    const mission = assignedMissions[i];
    const status = submissionStatuses[i] ?? SubmissionStatus.SUBMITTED;
    const revisionCount = status === SubmissionStatus.REVISION_REQUESTED ? 1 : 0;
    const submission = await prisma.submission.create({
      data: {
        missionId: mission.id,
        adventurerId: adventurer.id,
        proofLinks: [`https://example.com/prova/${i + 1}`],
        proofFiles: [],
        notes: `Entrega digital da missao ${mission.title}`,
        status,
        revisionCount,
      },
    });

    await prisma.submissionRevision.create({
      data: {
        submissionId: submission.id,
        version: 1,
        proofLinks: [`https://example.com/prova/${i + 1}`],
        proofFiles: [],
        notes: `Versao inicial - ${mission.title}`,
      },
    });

    if (status === SubmissionStatus.REVISION_REQUESTED) {
      await prisma.submissionRevision.create({
        data: {
          submissionId: submission.id,
          version: 2,
          proofLinks: [`https://example.com/prova/${i + 1}/revisao`],
          proofFiles: [],
          notes: `Versao revisada - ${mission.title}`,
        },
      });
    }
  }

  await prisma.missionProgress.create({
    data: {
      missionId: assignedMissions[0].id,
      adventurerId: adventurer.id,
      checklistState: [true, true, false],
      completionPct: 67,
    },
  });

  await prisma.adventurerAssessment.create({
    data: {
      userId: adventurer.id,
      resultProfile: "Executor de Operacoes Locais",
      dominantSkills: ["OPERACOES_PLANILHAS", "ATENDIMENTO_SUPORTE", "CONTEUDO_COPY"],
      skillScores: {
        ATENDIMENTO_SUPORTE: 8,
        VENDAS_PROSPECCAO: 6,
        OPERACOES_PLANILHAS: 11,
        DESIGN_RAPIDO: 4,
        CONTEUDO_COPY: 7,
        SOCIAL_MEDIA_LOCAL: 5,
        AUTOMACAO_NO_CODE: 6,
      },
      answers: [
        { questionId: "q1", optionId: "q1_b" },
        { questionId: "q2", optionId: "q2_a" },
      ],
    },
  });

  await prisma.xPLog.createMany({
    data: [
      { userId: adventurer.id, xpChange: 45, reason: "Entrega aceita no Alpha local", missionId: assignedMissions[2]?.id },
      { userId: adventurer.id, xpChange: 35, reason: "Qualidade e pontualidade", missionId: assignedMissions[4]?.id },
      { userId: enterprisePatron.id, xpChange: 20, reason: "Briefings consistentes no Alpha local" },
    ],
  });

  await prisma.missionScreening.create({
    data: {
      missionId: missions[0].id,
      model: "phi3:mini",
      decision: "PASS",
      confidence: 0.83,
      summary: "Missao clara, checklist objetivo e localizacao definida.",
      flags: [],
    },
  });

  await prisma.founderPledge.create({
    data: {
      userId: enterprisePatron.id,
      tier: FounderTier.FUNDADOR,
      status: "CONFIRMED",
      proofUrl: "manual://pix-confirmed",
    },
  });

  await prisma.announcement.createMany({
    data: [
      {
        title: "Drop Piracicaba Alpha",
        content: "28 missoes digitais ativas com foco local por bairro.",
      },
      {
        title: "Ranking semanal",
        content: "AventureiroPiracicaba lidera por consistencia de entrega.",
      },
    ],
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: enterprisePatron.id,
        type: "MISSION",
        title: "Demo local pronto",
        message: "Seu painel agora inclui 28 missoes digitais em Piracicaba/SP.",
      },
      {
        userId: adventurer.id,
        type: "MISSION",
        title: "Demo local pronto",
        message: "Feed atualizado com missoes por categoria e bairro.",
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      actorId: adminId,
      action: "DEMO_RESET",
      targetType: "System",
      metadata: { seededAt: new Date().toISOString(), missions: missions.length, city: "Piracicaba", state: "SP" },
    },
  });
}
