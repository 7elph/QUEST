"use client";

import { useEffect, useMemo, useState } from "react";
import { BudgetRange, DeliverableFormat, MissionCategory, RankName, RewardType } from "@prisma/client";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { alphaCategoryMeta, missionTypeCatalog, PIRACICABA_NEIGHBORHOODS } from "@/lib/mission-catalog";

type MissionForm = {
  title: string;
  category: MissionCategory;
  missionType: string;
  scope: string;
  desiredFormat: string;
  maxRevisions: number;
  deliverableFormat: DeliverableFormat;
  deadlineAt: string;
  budgetRange: BudgetRange;
  rewardType: RewardType;
  minRank: RankName;
  sponsored: boolean;
  city: string;
  state: string;
  neighborhood: (typeof PIRACICABA_NEIGHBORHOODS)[number];
};

type DraftPayload = {
  form: MissionForm;
  suggestedChecklist: string[];
  selectedSuggested: Record<string, boolean>;
  customConditions: string[];
};

const stepTitles = [
  "Escolha o tipo",
  "Explique o resultado",
  "Monte o checklist",
  "Prazo e valor",
  "Revisar e publicar",
];

const budgetLabels: Record<BudgetRange, string> = {
  LOW: "R$ 50-150",
  MEDIUM: "R$ 150-400",
  HIGH: "R$ 400+",
  PREMIUM: "R$ 400+",
};

const desiredFormatOptions = ["Doc", "Sheets", "PDF", "Canva", "Link"] as const;

function firstType(category: MissionCategory) {
  return missionTypeCatalog[category][0];
}

function buildSelectedMap(items: string[]) {
  return Object.fromEntries(items.map((item) => [item, true]));
}

function normalizeLegacyCategory(value?: string | null): MissionCategory | null {
  if (!value) return null;
  const asNew = value as MissionCategory;
  if (Object.keys(alphaCategoryMeta).includes(asNew)) return asNew;

  const legacyMap: Record<string, MissionCategory> = {
    ATENDIMENTO: MissionCategory.ATENDIMENTO_SUPORTE,
    PROSPECCAO: MissionCategory.VENDAS_PROSPECCAO,
    OPERACOES: MissionCategory.OPERACOES_PLANILHAS,
    DESIGN: MissionCategory.DESIGN_RAPIDO,
    TEXTO: MissionCategory.CONTEUDO_COPY,
    AUTOMACAO: MissionCategory.AUTOMACAO_NO_CODE,
    OUTRO: MissionCategory.SOCIAL_MEDIA_LOCAL,
  };

  return legacyMap[value] ?? null;
}

const initialCategory = MissionCategory.ATENDIMENTO_SUPORTE;
const initialType = firstType(initialCategory);

const emptyForm: MissionForm = {
  title: "",
  category: initialCategory,
  missionType: initialType.id,
  scope: initialType.scopeTemplate,
  desiredFormat: "Doc",
  maxRevisions: 1,
  deliverableFormat: initialType.deliverableFormat,
  deadlineAt: "",
  budgetRange: initialType.budgetRange,
  rewardType: RewardType.TRAINING_XP,
  minRank: RankName.E,
  sponsored: false,
  city: "Piracicaba",
  state: "SP",
  neighborhood: "Centro",
};

export function CreateMissionForm() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<MissionForm>(emptyForm);
  const [suggestedChecklist, setSuggestedChecklist] = useState<string[]>(initialType.checklist);
  const [selectedSuggested, setSelectedSuggested] = useState<Record<string, boolean>>(buildSelectedMap(initialType.checklist));
  const [customConditions, setCustomConditions] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const selectedType = useMemo(
    () => missionTypeCatalog[form.category].find((item) => item.id === form.missionType) ?? firstType(form.category),
    [form.category, form.missionType],
  );

  const finalVictoryConditions = useMemo(() => {
    const fromSuggested = suggestedChecklist.filter((item) => selectedSuggested[item]);
    const fromCustom = customConditions.map((item) => item.trim()).filter((item) => item.length > 0);
    return Array.from(new Set([...fromSuggested, ...fromCustom])).slice(0, 7);
  }, [customConditions, selectedSuggested, suggestedChecklist]);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      const draftRes = await fetch("/api/missions/draft", { cache: "no-store" });
      const draftData = draftRes.ok ? await draftRes.json() : { draft: null };
      if (cancelled) return;

      const payload = draftData?.draft?.payload as Partial<DraftPayload> | undefined;
      if (payload?.form) {
        const normalizedCategory = normalizeLegacyCategory(payload.form.category);
        const category = normalizedCategory ?? payload.form.category ?? emptyForm.category;
        const defaultType = firstType(category);

        const hydratedForm: MissionForm = {
          ...emptyForm,
          ...payload.form,
          category,
          missionType:
            missionTypeCatalog[category].some((item) => item.id === payload.form?.missionType)
              ? (payload.form?.missionType as string)
              : defaultType.id,
          neighborhood:
            (PIRACICABA_NEIGHBORHOODS as readonly string[]).includes(payload.form?.neighborhood ?? "")
              ? (payload.form?.neighborhood as (typeof PIRACICABA_NEIGHBORHOODS)[number])
              : "Centro",
        };

        setForm(hydratedForm);
        setStep(draftData?.draft?.currentStep ?? 1);
        const hydratedType = missionTypeCatalog[hydratedForm.category].find((item) => item.id === hydratedForm.missionType) ?? defaultType;
        setSuggestedChecklist(payload.suggestedChecklist ?? hydratedType.checklist);
        setSelectedSuggested(payload.selectedSuggested ?? buildSelectedMap(payload.suggestedChecklist ?? hydratedType.checklist));
        setCustomConditions(payload.customConditions ?? []);
      }

      const rawPreset = localStorage.getItem("quest_enterprise_preset");
      if (rawPreset) {
        try {
          const preset = JSON.parse(rawPreset) as {
            title?: string;
            category?: string;
            scope?: string;
            victoryConditions?: string[];
            deliverableFormat?: DeliverableFormat;
            deadlinePreset?: string;
          };
          const category = normalizeLegacyCategory(preset.category) ?? emptyForm.category;
          const type = firstType(category);
          setForm((prev) => ({
            ...prev,
            title: preset.title ?? prev.title,
            category,
            missionType: type.id,
            scope: preset.scope ?? prev.scope,
            deliverableFormat: preset.deliverableFormat ?? prev.deliverableFormat,
          }));
          const suggested = preset.victoryConditions && preset.victoryConditions.length > 0 ? preset.victoryConditions : type.checklist;
          setSuggestedChecklist(suggested);
          setSelectedSuggested(buildSelectedMap(suggested));
          setCustomConditions([]);

          if (preset.deadlinePreset === "24h") setQuickDeadline(24);
          if (preset.deadlinePreset === "48h") setQuickDeadline(48);
          if (preset.deadlinePreset === "72h") setQuickDeadline(72);
          if (preset.deadlinePreset === "week") setQuickDeadline(7 * 24);
        } catch {
          // ignore invalid preset
        } finally {
          localStorage.removeItem("quest_enterprise_preset");
        }
      }

      setHydrated(true);
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timeout = setTimeout(() => {
      const payload: DraftPayload = {
        form,
        suggestedChecklist,
        selectedSuggested,
        customConditions,
      };
      void fetch("/api/missions/draft", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payload, currentStep: step }),
      });
    }, 700);

    return () => clearTimeout(timeout);
  }, [customConditions, form, hydrated, selectedSuggested, step, suggestedChecklist]);

  const applyCategory = (category: MissionCategory) => {
    const type = firstType(category);
    setForm((prev) => ({
      ...prev,
      category,
      missionType: type.id,
      scope: type.scopeTemplate,
      deliverableFormat: type.deliverableFormat,
      budgetRange: type.budgetRange,
    }));
    setSuggestedChecklist(type.checklist);
    setSelectedSuggested(buildSelectedMap(type.checklist));
    setCustomConditions([]);
  };

  const applyType = (typeId: string) => {
    const type = missionTypeCatalog[form.category].find((item) => item.id === typeId);
    if (!type) return;
    setForm((prev) => ({
      ...prev,
      missionType: type.id,
      scope: type.scopeTemplate,
      deliverableFormat: type.deliverableFormat,
      budgetRange: type.budgetRange,
    }));
    setSuggestedChecklist(type.checklist);
    setSelectedSuggested(buildSelectedMap(type.checklist));
    setCustomConditions([]);
  };

  const toggleSuggested = (value: string) => {
    setSelectedSuggested((prev) => ({ ...prev, [value]: !prev[value] }));
  };

  const setCustom = (index: number, value: string) => {
    setCustomConditions((prev) => prev.map((item, idx) => (idx === index ? value : item)));
  };

  const addCustom = () => {
    if (customConditions.length + suggestedChecklist.length >= 7) return;
    setCustomConditions((prev) => [...prev, ""]);
  };

  const removeCustom = (index: number) => {
    setCustomConditions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const setQuickDeadline = (hours: number) => {
    const date = new Date(Date.now() + hours * 60 * 60 * 1000);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setForm((prev) => ({ ...prev, deadlineAt: local }));
  };

  const validateStep = (currentStep: number) => {
    if (currentStep === 1) {
      return form.title.trim().length >= 4 && !!form.missionType;
    }
    if (currentStep === 2) {
      return form.scope.trim().length >= 8 && form.desiredFormat.trim().length >= 2;
    }
    if (currentStep === 3) {
      return finalVictoryConditions.length >= 3 && finalVictoryConditions.length <= 7;
    }
    if (currentStep === 4) {
      return !!form.deadlineAt && form.city.trim().length > 0 && form.state.trim().length > 0;
    }
    return true;
  };

  const nextStep = () => {
    setError("");
    if (!validateStep(step)) {
      setError("Preencha os campos obrigatorios deste passo.");
      return;
    }
    setStep((prev) => Math.min(prev + 1, 5));
  };

  const previousStep = () => {
    setError("");
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const publish = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    if (!validateStep(1) || !validateStep(2) || !validateStep(3) || !validateStep(4)) {
      setError("Revise os campos obrigatorios antes de publicar.");
      setLoading(false);
      return;
    }

    const payload = {
      ...form,
      victoryConditions: finalVictoryConditions,
      rewardType: form.sponsored ? RewardType.SPONSORED_CASH : form.rewardType,
    };

    const response = await fetch("/api/missions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(data.error ?? "Nao foi possivel criar a missao.");
      setLoading(false);
      return;
    }

    await fetch("/api/missions/draft", { method: "DELETE" });
    if (data.workflow === "PENDING_APPROVAL") {
      setMessage("Missao enviada para aprovacao.");
      router.push("/my-missions");
    } else {
      setMessage("Missao publicada com sucesso.");
      router.push(`/mission/${data.mission.id}`);
    }
    router.refresh();
    setLoading(false);
  };

  return (
    <div className="space-y-4 rounded-xl border border-amber-200/20 bg-black/30 p-5">
      <div className="grid gap-2 md:grid-cols-5">
        {stepTitles.map((title, idx) => (
          <div
            key={title}
            className={`rounded-md border px-3 py-2 text-xs ${
              step === idx + 1 ? "border-amber-300 bg-amber-500/20" : "border-amber-100/20"
            }`}
          >
            {idx + 1}. {title}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <Input
            placeholder="Nome da missao"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            required
          />

          <div className="grid gap-2 md:grid-cols-2">
            <select
              value={form.category}
              onChange={(e) => applyCategory(e.target.value as MissionCategory)}
              className="w-full rounded-md border border-amber-100/20 bg-slate-900/80 p-2 text-sm"
            >
              {Object.entries(alphaCategoryMeta).map(([value, meta]) => (
                <option key={value} value={value}>
                  {meta.label} ({meta.skin})
                </option>
              ))}
            </select>
            <select
              value={form.missionType}
              onChange={(e) => applyType(e.target.value)}
              className="w-full rounded-md border border-amber-100/20 bg-slate-900/80 p-2 text-sm"
            >
              {missionTypeCatalog[form.category].map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <label className="text-xs uppercase tracking-wider text-amber-100/80">O que voce quer pronto no final?</label>
          <textarea
            value={form.scope}
            onChange={(e) => setForm((prev) => ({ ...prev, scope: e.target.value }))}
            placeholder="Descreva o resultado esperado"
            className="h-28 w-full rounded-md border border-amber-100/20 bg-slate-900/80 p-2 text-sm"
            required
          />

          <div className="grid gap-2 md:grid-cols-2">
            <select
              value={form.desiredFormat}
              onChange={(e) => setForm((prev) => ({ ...prev, desiredFormat: e.target.value }))}
              className="rounded-md border border-amber-100/20 bg-slate-900/80 p-2 text-sm"
            >
              {desiredFormatOptions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              value={form.deliverableFormat}
              onChange={(e) => setForm((prev) => ({ ...prev, deliverableFormat: e.target.value as DeliverableFormat }))}
              className="rounded-md border border-amber-100/20 bg-slate-900/80 p-2 text-sm"
            >
              <option value={DeliverableFormat.LINK}>Link</option>
              <option value={DeliverableFormat.FILE}>Arquivo</option>
              <option value={DeliverableFormat.BOTH}>Link ou arquivo</option>
            </select>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-xs uppercase tracking-wider text-amber-100/80">
            Checklist sugerido para: {selectedType.label}
          </p>

          <div className="space-y-2">
            {suggestedChecklist.map((item) => (
              <label
                key={item}
                className="flex items-start gap-2 rounded-md border border-amber-100/15 bg-black/25 p-2 text-sm"
              >
                <input type="checkbox" checked={!!selectedSuggested[item]} onChange={() => toggleSuggested(item)} />
                <span>{item}</span>
              </label>
            ))}
          </div>

          <div className="space-y-2">
            <p className="text-xs uppercase tracking-wider text-amber-100/80">Itens extras</p>
            {customConditions.map((item, idx) => (
              <div key={`custom-${idx}`} className="flex gap-2">
                <Input value={item} onChange={(e) => setCustom(idx, e.target.value)} placeholder={`Item extra ${idx + 1}`} />
                <Button type="button" variant="ghost" onClick={() => removeCustom(idx)}>
                  Remover
                </Button>
              </div>
            ))}
            <Button type="button" variant="ghost" onClick={addCustom}>
              Adicionar item extra
            </Button>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <label className="text-sm">
              Revisoes maximas:
              <select
                value={form.maxRevisions}
                onChange={(e) => setForm((prev) => ({ ...prev, maxRevisions: Number(e.target.value) }))}
                className="mt-1 w-full rounded-md border border-amber-100/20 bg-slate-900/80 p-2 text-sm"
              >
                <option value={1}>1 (padrao)</option>
                <option value={2}>2</option>
                <option value={3}>3</option>
              </select>
            </label>
            <label className="text-sm">
              Rank minimo:
              <select
                value={form.minRank}
                onChange={(e) => setForm((prev) => ({ ...prev, minRank: e.target.value as RankName }))}
                className="mt-1 w-full rounded-md border border-amber-100/20 bg-slate-900/80 p-2 text-sm"
              >
                {Object.values(RankName).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="text-xs text-amber-100/80">Itens no checklist: {finalVictoryConditions.length}/7</p>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <Input
            type="datetime-local"
            value={form.deadlineAt}
            onChange={(e) => setForm((prev) => ({ ...prev, deadlineAt: e.target.value }))}
            required
          />
          <div className="flex flex-wrap gap-2 text-xs">
            <Button type="button" variant="ghost" onClick={() => setQuickDeadline(24)}>
              24h
            </Button>
            <Button type="button" variant="ghost" onClick={() => setQuickDeadline(48)}>
              48h
            </Button>
            <Button type="button" variant="ghost" onClick={() => setQuickDeadline(72)}>
              72h
            </Button>
            <Button type="button" variant="ghost" onClick={() => setQuickDeadline(7 * 24)}>
              Esta semana
            </Button>
          </div>

          <div className="grid gap-2 md:grid-cols-2">
            <select
              value={form.budgetRange}
              onChange={(e) => setForm((prev) => ({ ...prev, budgetRange: e.target.value as BudgetRange }))}
              className="rounded-md border border-amber-100/20 bg-slate-900/80 p-2 text-sm"
            >
              <option value={BudgetRange.LOW}>{budgetLabels.LOW}</option>
              <option value={BudgetRange.MEDIUM}>{budgetLabels.MEDIUM}</option>
              <option value={BudgetRange.HIGH}>{budgetLabels.HIGH}</option>
            </select>
            <select
              value={form.rewardType}
              onChange={(e) => setForm((prev) => ({ ...prev, rewardType: e.target.value as RewardType }))}
              className="rounded-md border border-amber-100/20 bg-slate-900/80 p-2 text-sm"
            >
              <option value={RewardType.TRAINING_XP}>Treino (XP)</option>
              <option value={RewardType.SPONSORED_CASH}>Patrocinada (cash)</option>
              <option value={RewardType.MIXED}>Misto</option>
            </select>
          </div>

          <div className="grid gap-2 md:grid-cols-3">
            <Input value={form.city} onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))} />
            <Input value={form.state} onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value.toUpperCase() }))} />
            <select
              value={form.neighborhood}
              onChange={(e) => setForm((prev) => ({ ...prev, neighborhood: e.target.value as (typeof PIRACICABA_NEIGHBORHOODS)[number] }))}
              className="rounded-md border border-amber-100/20 bg-slate-900/80 p-2 text-sm"
            >
              {PIRACICABA_NEIGHBORHOODS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.sponsored}
              onChange={(e) => setForm((prev) => ({ ...prev, sponsored: e.target.checked }))}
            />
            Missao com pagamento (manual no Alpha)
          </label>
        </div>
      )}

      {step === 5 && (
        <div className="space-y-2 rounded-md border border-amber-100/20 bg-black/20 p-4 text-sm">
          <p>
            <strong>Titulo:</strong> {form.title}
          </p>
          <p>
            <strong>Categoria:</strong> {alphaCategoryMeta[form.category].label} ({alphaCategoryMeta[form.category].skin})
          </p>
          <p>
            <strong>Tipo:</strong> {selectedType.label}
          </p>
          <p>
            <strong>Resultado esperado:</strong> {form.scope}
          </p>
          <p>
            <strong>Formato desejado:</strong> {form.desiredFormat}
          </p>
          <p>
            <strong>Prazo:</strong> {form.deadlineAt ? new Date(form.deadlineAt).toLocaleString("pt-BR") : "-"}
          </p>
          <p>
            <strong>Faixa de valor:</strong> {budgetLabels[form.budgetRange]}
          </p>
          <p>
            <strong>Local:</strong> {form.city}/{form.state} - {form.neighborhood}
          </p>
          <p>
            <strong>Revisoes maximas:</strong> {form.maxRevisions}
          </p>
          <ul className="list-disc pl-6">
            {finalVictoryConditions.map((item, idx) => (
              <li key={`${item}-${idx}`}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <Button type="button" variant="ghost" onClick={previousStep} disabled={step === 1 || loading}>
          Voltar
        </Button>
        {step < 5 ? (
          <Button type="button" onClick={nextStep} disabled={loading}>
            Proxima etapa
          </Button>
        ) : (
          <Button type="button" onClick={publish} disabled={loading}>
            {loading ? "Publicando..." : "Publicar missao"}
          </Button>
        )}
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {message && <p className="text-sm text-amber-100">{message}</p>}
    </div>
  );
}
