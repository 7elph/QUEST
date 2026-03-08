import { BudgetRange, DeliverableFormat, MissionCategory } from "@prisma/client";

export const PIRACICABA_NEIGHBORHOODS = [
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
] as const;

export const alphaCategoryMeta: Record<
  MissionCategory,
  {
    label: string;
    skin: string;
    tagline: string;
  }
> = {
  ATENDIMENTO_SUPORTE: {
    label: "Atendimento & Suporte",
    skin: "Escribas",
    tagline: "Respostas claras, registro e consistencia de atendimento.",
  },
  VENDAS_PROSPECCAO: {
    label: "Vendas & Prospeccao",
    skin: "Batedores",
    tagline: "Leads validados, abordagem objetiva e funil atualizado.",
  },
  OPERACOES_PLANILHAS: {
    label: "Operacoes & Planilhas",
    skin: "Artifices",
    tagline: "Rotina organizada, dados consistentes e processo sem retrabalho.",
  },
  DESIGN_RAPIDO: {
    label: "Design Rapido",
    skin: "Ilustradores",
    tagline: "Pecas com padrao visual e entrega rapida para operacao.",
  },
  CONTEUDO_COPY: {
    label: "Conteudo & Copy",
    skin: "Arautos",
    tagline: "Texto com foco em clareza, conversao e aderencia ao briefing.",
  },
  SOCIAL_MEDIA_LOCAL: {
    label: "Social Media Local",
    skin: "Mensageiros",
    tagline: "Publicacoes para alcance local com consistencia de marca.",
  },
  AUTOMACAO_NO_CODE: {
    label: "Automacao No-Code",
    skin: "Engenheiros",
    tagline: "Fluxos automatizados com evidencias de funcionamento.",
  },
};

export type MissionTypePreset = {
  id: string;
  label: string;
  scopeTemplate: string;
  checklist: string[];
  deliverableFormat: DeliverableFormat;
  budgetRange: BudgetRange;
};

export const missionTypeCatalog: Record<MissionCategory, MissionTypePreset[]> = {
  ATENDIMENTO_SUPORTE: [
    {
      id: "atendimento_whatsapp",
      label: "Atendimento WhatsApp/e-mail",
      scopeTemplate:
        "Responder contatos de um comercio local com script aprovado e registrar cada atendimento em planilha.",
      checklist: [
        "Responder 100% dos contatos recebidos no periodo definido",
        "Seguir script e tom aprovado pelo Patrono",
        "Registrar data, canal e status de cada atendimento",
        "Sinalizar casos sem resolucao em lista separada",
      ],
      deliverableFormat: DeliverableFormat.BOTH,
      budgetRange: BudgetRange.LOW,
    },
    {
      id: "sac_pos_venda",
      label: "SAC pos-venda digital",
      scopeTemplate:
        "Executar atendimento pos-venda para clientes de prestador de servico local com registro de ocorrencias.",
      checklist: [
        "Classificar cada contato por tema",
        "Registrar encaminhamento e prazo de retorno",
        "Apontar top 3 recorrencias no fechamento",
      ],
      deliverableFormat: DeliverableFormat.BOTH,
      budgetRange: BudgetRange.MEDIUM,
    },
    {
      id: "faq_base",
      label: "Base de respostas (FAQ)",
      scopeTemplate:
        "Montar base de respostas padrao para acelerar atendimento remoto de loja local.",
      checklist: [
        "Entregar minimo de 20 respostas padrao",
        "Separar respostas por assunto",
        "Incluir orientacao de uso para equipe",
      ],
      deliverableFormat: DeliverableFormat.FILE,
      budgetRange: BudgetRange.MEDIUM,
    },
  ],
  VENDAS_PROSPECCAO: [
    {
      id: "lead_list_local",
      label: "Lista de leads locais",
      scopeTemplate:
        "Mapear leads para um negocio de Piracicaba e entregar lista validada para abordagem digital.",
      checklist: [
        "Entregar quantidade minima de leads definida no briefing",
        "Incluir nome, segmento, canal e contato valido",
        "Classificar prioridade em alta/media/baixa",
      ],
      deliverableFormat: DeliverableFormat.FILE,
      budgetRange: BudgetRange.MEDIUM,
    },
    {
      id: "mensagens_abordagem",
      label: "Scripts de prospeccao",
      scopeTemplate:
        "Criar sequencia curta de mensagens para prospeccao de comercio local por WhatsApp, e-mail e Instagram.",
      checklist: [
        "Entregar ao menos 3 variacoes por canal",
        "Incluir CTA objetivo em cada mensagem",
        "Adaptar linguagem ao perfil do publico",
      ],
      deliverableFormat: DeliverableFormat.FILE,
      budgetRange: BudgetRange.LOW,
    },
    {
      id: "followup_funil",
      label: "Follow-up de funil",
      scopeTemplate:
        "Executar follow-up digital em lista de leads e atualizar status do funil com evidencias.",
      checklist: [
        "Atualizar status de 100% dos leads do lote",
        "Registrar proxima acao para leads em aberto",
        "Apontar taxa de resposta final",
      ],
      deliverableFormat: DeliverableFormat.BOTH,
      budgetRange: BudgetRange.MEDIUM,
    },
  ],
  OPERACOES_PLANILHAS: [
    {
      id: "higienizacao_base",
      label: "Higienizacao de base",
      scopeTemplate:
        "Padronizar base de dados de operacao, remover duplicidades e preparar visao consolidada.",
      checklist: [
        "Remover duplicidades com criterio claro",
        "Padronizar colunas e formatos",
        "Entregar log de ajustes aplicados",
      ],
      deliverableFormat: DeliverableFormat.FILE,
      budgetRange: BudgetRange.MEDIUM,
    },
    {
      id: "relatorio_operacional",
      label: "Relatorio operacional",
      scopeTemplate:
        "Consolidar dados semanais em relatorio pratico para tomada de decisao.",
      checklist: [
        "Organizar indicadores em uma unica aba",
        "Destacar variacoes relevantes do periodo",
        "Entregar recomendacoes objetivas de acao",
      ],
      deliverableFormat: DeliverableFormat.BOTH,
      budgetRange: BudgetRange.HIGH,
    },
    {
      id: "checklist_rotina",
      label: "Checklist de rotina",
      scopeTemplate:
        "Criar checklist operacional padrao para execucao diaria de uma equipe remota.",
      checklist: [
        "Definir sequencia de tarefas por prioridade",
        "Incluir criterio de conclusao por tarefa",
        "Entregar versao pronta para uso no time",
      ],
      deliverableFormat: DeliverableFormat.FILE,
      budgetRange: BudgetRange.LOW,
    },
  ],
  DESIGN_RAPIDO: [
    {
      id: "cards_promocionais",
      label: "Cards promocionais",
      scopeTemplate:
        "Criar pecas digitais para promocao local com base na identidade visual enviada.",
      checklist: [
        "Entregar quantidade de pecas definida no briefing",
        "Manter identidade visual e legibilidade",
        "Exportar em formato pronto para publicacao",
      ],
      deliverableFormat: DeliverableFormat.BOTH,
      budgetRange: BudgetRange.MEDIUM,
    },
    {
      id: "kit_stories",
      label: "Kit de stories",
      scopeTemplate:
        "Produzir kit de stories para divulgacao semanal de servicos locais.",
      checklist: [
        "Incluir capa e sequencia de stories",
        "Padronizar tipografia e hierarquia visual",
        "Entregar arquivos editaveis e finais",
      ],
      deliverableFormat: DeliverableFormat.BOTH,
      budgetRange: BudgetRange.MEDIUM,
    },
    {
      id: "banner_digital",
      label: "Banner digital",
      scopeTemplate:
        "Desenvolver banner digital para campanha local com foco em conversao.",
      checklist: [
        "Aplicar CTA claro e visivel",
        "Usar elementos visuais coerentes com briefing",
        "Entregar variacao principal e alternativa",
      ],
      deliverableFormat: DeliverableFormat.FILE,
      budgetRange: BudgetRange.LOW,
    },
  ],
  CONTEUDO_COPY: [
    {
      id: "copy_landing",
      label: "Copy de landing page",
      scopeTemplate:
        "Escrever copy para landing de captacao local com foco em clareza da oferta.",
      checklist: [
        "Estruturar titulo, proposta de valor e CTA",
        "Manter tom adequado ao publico alvo",
        "Revisar ortografia e coerencia final",
      ],
      deliverableFormat: DeliverableFormat.FILE,
      budgetRange: BudgetRange.MEDIUM,
    },
    {
      id: "roteiro_video_curto",
      label: "Roteiro de video curto",
      scopeTemplate:
        "Criar roteiro curto para divulgacao de servico local em redes sociais.",
      checklist: [
        "Definir abertura, desenvolvimento e CTA",
        "Limitar duracao conforme briefing",
        "Entregar versao principal e alternativa",
      ],
      deliverableFormat: DeliverableFormat.FILE,
      budgetRange: BudgetRange.LOW,
    },
    {
      id: "sequencia_emails",
      label: "Sequencia de e-mails",
      scopeTemplate:
        "Escrever sequencia de e-mails para nutricao de contatos de um negocio local.",
      checklist: [
        "Entregar sequencia completa com assunto",
        "Incluir CTA em cada e-mail",
        "Alinhar linguagem com posicionamento da marca",
      ],
      deliverableFormat: DeliverableFormat.FILE,
      budgetRange: BudgetRange.HIGH,
    },
  ],
  SOCIAL_MEDIA_LOCAL: [
    {
      id: "calendario_social",
      label: "Calendario de posts local",
      scopeTemplate:
        "Montar calendario semanal de conteudo para perfil local de comercio ou servico.",
      checklist: [
        "Entregar grade com dias, temas e objetivo",
        "Indicar formato sugerido por publicacao",
        "Incluir hashtags locais coerentes",
      ],
      deliverableFormat: DeliverableFormat.FILE,
      budgetRange: BudgetRange.MEDIUM,
    },
    {
      id: "legendas_engajamento",
      label: "Legendas de engajamento",
      scopeTemplate:
        "Criar pacote de legendas para publicacoes de negocio local com foco em interacao.",
      checklist: [
        "Entregar volume de legendas combinado",
        "Adicionar CTA de comentario ou direct",
        "Adequar texto ao publico local",
      ],
      deliverableFormat: DeliverableFormat.FILE,
      budgetRange: BudgetRange.LOW,
    },
    {
      id: "respostas_comunidade",
      label: "Respostas para comunidade",
      scopeTemplate:
        "Padronizar respostas para comentarios e mensagens em redes sociais de operacao local.",
      checklist: [
        "Criar biblioteca de respostas por situacao",
        "Definir tom e limites de resposta",
        "Entregar guia rapido de uso para equipe",
      ],
      deliverableFormat: DeliverableFormat.BOTH,
      budgetRange: BudgetRange.MEDIUM,
    },
  ],
  AUTOMACAO_NO_CODE: [
    {
      id: "fluxo_leads_nocode",
      label: "Fluxo de leads no-code",
      scopeTemplate:
        "Automatizar captura e distribuicao de leads entre canais usando ferramenta no-code.",
      checklist: [
        "Configurar gatilho e acao principal",
        "Registrar logs de teste com sucesso",
        "Documentar passos para manutencao",
      ],
      deliverableFormat: DeliverableFormat.BOTH,
      budgetRange: BudgetRange.HIGH,
    },
    {
      id: "alertas_operacionais",
      label: "Alertas operacionais",
      scopeTemplate:
        "Criar automacao de alertas para eventos operacionais criticos.",
      checklist: [
        "Definir condicoes de disparo",
        "Validar envio em canal acordado",
        "Entregar checklist de monitoramento",
      ],
      deliverableFormat: DeliverableFormat.BOTH,
      budgetRange: BudgetRange.MEDIUM,
    },
    {
      id: "integracao_planilha",
      label: "Integracao com planilha",
      scopeTemplate:
        "Integrar formulario e planilha para reduzir trabalho manual de registro.",
      checklist: [
        "Garantir preenchimento automatico dos campos-chave",
        "Tratar erros de entrada basicos",
        "Entregar teste com evidencias",
      ],
      deliverableFormat: DeliverableFormat.BOTH,
      budgetRange: BudgetRange.HIGH,
    },
  ],
};

export function getCategoryLabel(category: MissionCategory) {
  return alphaCategoryMeta[category].label;
}

export function getCategorySkin(category: MissionCategory) {
  return alphaCategoryMeta[category].skin;
}

export function getCategoryDisplay(category: MissionCategory) {
  const item = alphaCategoryMeta[category];
  return `${item.label} (${item.skin})`;
}

export function getCategoryByType(typeId: string) {
  for (const [category, types] of Object.entries(missionTypeCatalog) as [MissionCategory, MissionTypePreset[]][]) {
    if (types.some((item) => item.id === typeId)) {
      return category;
    }
  }
  return null;
}

export function getTypePreset(category: MissionCategory, typeId: string) {
  return missionTypeCatalog[category].find((item) => item.id === typeId) ?? null;
}

