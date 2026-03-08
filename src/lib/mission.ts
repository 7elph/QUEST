import type { MissionCategory } from "@prisma/client";

const intros: Record<MissionCategory, string> = {
  ATENDIMENTO_SUPORTE: "Nos saloes da guilda, vozes aguardam resposta precisa.",
  VENDAS_PROSPECCAO: "No mapa de mercado, novos aliados aguardam descoberta.",
  OPERACOES_PLANILHAS: "As engrenagens do reino precisam de ordem impecavel.",
  DESIGN_RAPIDO: "A identidade visual da guilda precisa ganhar forma.",
  CONTEUDO_COPY: "Pergaminhos persuasivos precisam nascer com clareza.",
  SOCIAL_MEDIA_LOCAL: "Mensageiros da cidade precisam espalhar a palavra com consistencia.",
  AUTOMACAO_NO_CODE: "Runas de automacao devem ser ativadas sem falhas.",
};

export function buildNarrative(input: { title: string; category: MissionCategory; scope: string; victoryConditions: string[] }) {
  const intro = intros[input.category] ?? intros.OPERACOES_PLANILHAS;
  const checklist = input.victoryConditions.map((item, idx) => `${idx + 1}. ${item}`).join(" ");

  return `${intro} Missao: ${input.title}. Resultado esperado: ${input.scope}. Condicoes de Vitoria: ${checklist}.`;
}
