import { z } from "zod";

export type SkillKey =
  | "ATENDIMENTO_SUPORTE"
  | "VENDAS_PROSPECCAO"
  | "OPERACOES_PLANILHAS"
  | "DESIGN_RAPIDO"
  | "CONTEUDO_COPY"
  | "SOCIAL_MEDIA_LOCAL"
  | "AUTOMACAO_NO_CODE";

export const skillLabels: Record<SkillKey, string> = {
  ATENDIMENTO_SUPORTE: "Atendimento & Suporte",
  VENDAS_PROSPECCAO: "Vendas & Prospeccao",
  OPERACOES_PLANILHAS: "Operacoes & Planilhas",
  DESIGN_RAPIDO: "Design Rapido",
  CONTEUDO_COPY: "Conteudo & Copy",
  SOCIAL_MEDIA_LOCAL: "Social Media Local",
  AUTOMACAO_NO_CODE: "Automacao No-Code",
};

type AssessmentOption = {
  id: string;
  label: string;
  scores: Record<SkillKey, number>;
};

type AssessmentQuestion = {
  id: string;
  title: string;
  options: AssessmentOption[];
};

export const assessmentQuestions: AssessmentQuestion[] = [
  {
    id: "q1",
    title: "Em qual tipo de entrega voce se sente mais forte?",
    options: [
      {
        id: "q1_a",
        label: "Atender pessoas e resolver duvidas com clareza",
        scores: {
          ATENDIMENTO_SUPORTE: 3,
          VENDAS_PROSPECCAO: 1,
          OPERACOES_PLANILHAS: 0,
          DESIGN_RAPIDO: 0,
          CONTEUDO_COPY: 1,
          SOCIAL_MEDIA_LOCAL: 1,
          AUTOMACAO_NO_CODE: 0,
        },
      },
      {
        id: "q1_b",
        label: "Organizar dados e rotina com checklist",
        scores: {
          ATENDIMENTO_SUPORTE: 0,
          VENDAS_PROSPECCAO: 0,
          OPERACOES_PLANILHAS: 3,
          DESIGN_RAPIDO: 0,
          CONTEUDO_COPY: 0,
          SOCIAL_MEDIA_LOCAL: 0,
          AUTOMACAO_NO_CODE: 1,
        },
      },
      {
        id: "q1_c",
        label: "Criar texto, design e post para canais digitais",
        scores: {
          ATENDIMENTO_SUPORTE: 0,
          VENDAS_PROSPECCAO: 1,
          OPERACOES_PLANILHAS: 0,
          DESIGN_RAPIDO: 2,
          CONTEUDO_COPY: 3,
          SOCIAL_MEDIA_LOCAL: 2,
          AUTOMACAO_NO_CODE: 0,
        },
      },
    ],
  },
  {
    id: "q2",
    title: "Quando recebe uma missao nova, qual seu primeiro passo?",
    options: [
      {
        id: "q2_a",
        label: "Quebrar em tarefas e medir progresso",
        scores: {
          ATENDIMENTO_SUPORTE: 0,
          VENDAS_PROSPECCAO: 0,
          OPERACOES_PLANILHAS: 3,
          DESIGN_RAPIDO: 0,
          CONTEUDO_COPY: 0,
          SOCIAL_MEDIA_LOCAL: 0,
          AUTOMACAO_NO_CODE: 2,
        },
      },
      {
        id: "q2_b",
        label: "Montar abordagem comercial e contato",
        scores: {
          ATENDIMENTO_SUPORTE: 1,
          VENDAS_PROSPECCAO: 3,
          OPERACOES_PLANILHAS: 0,
          DESIGN_RAPIDO: 0,
          CONTEUDO_COPY: 1,
          SOCIAL_MEDIA_LOCAL: 1,
          AUTOMACAO_NO_CODE: 0,
        },
      },
      {
        id: "q2_c",
        label: "Esboçar mensagem, narrativa e visual",
        scores: {
          ATENDIMENTO_SUPORTE: 0,
          VENDAS_PROSPECCAO: 0,
          OPERACOES_PLANILHAS: 0,
          DESIGN_RAPIDO: 2,
          CONTEUDO_COPY: 3,
          SOCIAL_MEDIA_LOCAL: 2,
          AUTOMACAO_NO_CODE: 0,
        },
      },
    ],
  },
  {
    id: "q3",
    title: "Qual resultado voce valoriza mais?",
    options: [
      {
        id: "q3_a",
        label: "Cliente atendido com qualidade e rapidez",
        scores: {
          ATENDIMENTO_SUPORTE: 3,
          VENDAS_PROSPECCAO: 1,
          OPERACOES_PLANILHAS: 0,
          DESIGN_RAPIDO: 0,
          CONTEUDO_COPY: 0,
          SOCIAL_MEDIA_LOCAL: 1,
          AUTOMACAO_NO_CODE: 0,
        },
      },
      {
        id: "q3_b",
        label: "Mais oportunidades comerciais no funil",
        scores: {
          ATENDIMENTO_SUPORTE: 0,
          VENDAS_PROSPECCAO: 3,
          OPERACOES_PLANILHAS: 0,
          DESIGN_RAPIDO: 0,
          CONTEUDO_COPY: 1,
          SOCIAL_MEDIA_LOCAL: 1,
          AUTOMACAO_NO_CODE: 0,
        },
      },
      {
        id: "q3_c",
        label: "Processo digital rodando com menos trabalho manual",
        scores: {
          ATENDIMENTO_SUPORTE: 0,
          VENDAS_PROSPECCAO: 0,
          OPERACOES_PLANILHAS: 2,
          DESIGN_RAPIDO: 0,
          CONTEUDO_COPY: 0,
          SOCIAL_MEDIA_LOCAL: 0,
          AUTOMACAO_NO_CODE: 3,
        },
      },
    ],
  },
  {
    id: "q4",
    title: "Em revisao de entrega, onde voce geralmente se destaca?",
    options: [
      {
        id: "q4_a",
        label: "Padrao visual, clareza e acabamento",
        scores: {
          ATENDIMENTO_SUPORTE: 0,
          VENDAS_PROSPECCAO: 0,
          OPERACOES_PLANILHAS: 0,
          DESIGN_RAPIDO: 3,
          CONTEUDO_COPY: 1,
          SOCIAL_MEDIA_LOCAL: 1,
          AUTOMACAO_NO_CODE: 0,
        },
      },
      {
        id: "q4_b",
        label: "Precisao de dados e consistencia operacional",
        scores: {
          ATENDIMENTO_SUPORTE: 0,
          VENDAS_PROSPECCAO: 0,
          OPERACOES_PLANILHAS: 3,
          DESIGN_RAPIDO: 0,
          CONTEUDO_COPY: 0,
          SOCIAL_MEDIA_LOCAL: 0,
          AUTOMACAO_NO_CODE: 1,
        },
      },
      {
        id: "q4_c",
        label: "Texto objetivo e CTA convincente",
        scores: {
          ATENDIMENTO_SUPORTE: 1,
          VENDAS_PROSPECCAO: 1,
          OPERACOES_PLANILHAS: 0,
          DESIGN_RAPIDO: 0,
          CONTEUDO_COPY: 3,
          SOCIAL_MEDIA_LOCAL: 1,
          AUTOMACAO_NO_CODE: 0,
        },
      },
    ],
  },
  {
    id: "q5",
    title: "No tempo de estudo, voce tende a aprofundar em:",
    options: [
      {
        id: "q5_a",
        label: "Atendimento, relacionamento e experiencia do cliente",
        scores: {
          ATENDIMENTO_SUPORTE: 3,
          VENDAS_PROSPECCAO: 1,
          OPERACOES_PLANILHAS: 0,
          DESIGN_RAPIDO: 0,
          CONTEUDO_COPY: 0,
          SOCIAL_MEDIA_LOCAL: 1,
          AUTOMACAO_NO_CODE: 0,
        },
      },
      {
        id: "q5_b",
        label: "Ferramentas no-code e automacoes",
        scores: {
          ATENDIMENTO_SUPORTE: 0,
          VENDAS_PROSPECCAO: 0,
          OPERACOES_PLANILHAS: 1,
          DESIGN_RAPIDO: 0,
          CONTEUDO_COPY: 0,
          SOCIAL_MEDIA_LOCAL: 0,
          AUTOMACAO_NO_CODE: 3,
        },
      },
      {
        id: "q5_c",
        label: "Conteudo, copy e social media local",
        scores: {
          ATENDIMENTO_SUPORTE: 0,
          VENDAS_PROSPECCAO: 1,
          OPERACOES_PLANILHAS: 0,
          DESIGN_RAPIDO: 1,
          CONTEUDO_COPY: 2,
          SOCIAL_MEDIA_LOCAL: 3,
          AUTOMACAO_NO_CODE: 0,
        },
      },
    ],
  },
  {
    id: "q6",
    title: "Quando o prazo aperta, voce costuma:",
    options: [
      {
        id: "q6_a",
        label: "Executar por blocos e checklist",
        scores: {
          ATENDIMENTO_SUPORTE: 0,
          VENDAS_PROSPECCAO: 0,
          OPERACOES_PLANILHAS: 3,
          DESIGN_RAPIDO: 0,
          CONTEUDO_COPY: 0,
          SOCIAL_MEDIA_LOCAL: 0,
          AUTOMACAO_NO_CODE: 1,
        },
      },
      {
        id: "q6_b",
        label: "Priorizar contato, persuasao e fechamento",
        scores: {
          ATENDIMENTO_SUPORTE: 1,
          VENDAS_PROSPECCAO: 3,
          OPERACOES_PLANILHAS: 0,
          DESIGN_RAPIDO: 0,
          CONTEUDO_COPY: 1,
          SOCIAL_MEDIA_LOCAL: 1,
          AUTOMACAO_NO_CODE: 0,
        },
      },
      {
        id: "q6_c",
        label: "Ajustar conteudo visual/textual para ganho rapido",
        scores: {
          ATENDIMENTO_SUPORTE: 0,
          VENDAS_PROSPECCAO: 0,
          OPERACOES_PLANILHAS: 0,
          DESIGN_RAPIDO: 2,
          CONTEUDO_COPY: 2,
          SOCIAL_MEDIA_LOCAL: 2,
          AUTOMACAO_NO_CODE: 0,
        },
      },
    ],
  },
];

const answerSchema = z.object({
  questionId: z.string(),
  optionId: z.string(),
});

export const assessmentPayloadSchema = z.object({
  answers: z.array(answerSchema).min(assessmentQuestions.length).max(assessmentQuestions.length),
});

export function computeAssessment(answers: Array<{ questionId: string; optionId: string }>) {
  const scores: Record<SkillKey, number> = {
    ATENDIMENTO_SUPORTE: 0,
    VENDAS_PROSPECCAO: 0,
    OPERACOES_PLANILHAS: 0,
    DESIGN_RAPIDO: 0,
    CONTEUDO_COPY: 0,
    SOCIAL_MEDIA_LOCAL: 0,
    AUTOMACAO_NO_CODE: 0,
  };

  for (const question of assessmentQuestions) {
    const selected = answers.find((item) => item.questionId === question.id);
    if (!selected) continue;
    const option = question.options.find((item) => item.id === selected.optionId);
    if (!option) continue;
    for (const key of Object.keys(scores) as SkillKey[]) {
      scores[key] += option.scores[key];
    }
  }

  const ordered = (Object.keys(scores) as SkillKey[])
    .map((key) => ({ key, value: scores[key] }))
    .sort((a, b) => b.value - a.value);

  const top = ordered.slice(0, 3).map((item) => item.key);
  const dominant = top[0];

  const profile =
    dominant === "OPERACOES_PLANILHAS"
      ? "Executor de Operacoes Locais"
      : dominant === "VENDAS_PROSPECCAO"
        ? "Batedor Comercial"
        : dominant === "ATENDIMENTO_SUPORTE"
          ? "Guardiao de Atendimento"
          : dominant === "AUTOMACAO_NO_CODE"
            ? "Engenheiro No-Code"
            : dominant === "DESIGN_RAPIDO"
              ? "Ilustrador Tatico"
              : dominant === "SOCIAL_MEDIA_LOCAL"
                ? "Mensageiro Local"
                : "Arauto de Conteudo";

  return {
    profile,
    scores,
    dominantSkills: top,
  };
}

