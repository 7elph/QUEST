"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { skillLabels } from "@/lib/adventurer-assessment";

type Question = {
  id: string;
  title: string;
  options: Array<{ id: string; label: string }>;
};

type Assessment = {
  id: string;
  resultProfile: string;
  dominantSkills: string[];
  skillScores: Record<string, number>;
  completedAt: string;
};

type AdventurerAssessmentProps = {
  initialAssessment: Assessment | null;
};

export function AdventurerAssessment({ initialAssessment }: AdventurerAssessmentProps) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Assessment | null>(initialAssessment);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [showQuiz, setShowQuiz] = useState(!initialAssessment);
  const sortedScores = useMemo(
    () => (result ? Object.entries(result.skillScores).sort((a, b) => (b[1] as number) - (a[1] as number)) : []),
    [result],
  );

  useEffect(() => {
    let cancelled = false;
    async function loadQuestions() {
      const response = await fetch("/api/profile/assessment", { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || cancelled) return;
      setQuestions(data.questions ?? []);
      if (data.assessment && !initialAssessment) {
        setResult(data.assessment);
      }
    }
    void loadQuestions();
    return () => {
      cancelled = true;
    };
  }, [initialAssessment]);

  const answeredCount = useMemo(() => Object.keys(selected).length, [selected]);

  const submit = async () => {
    setLoading(true);
    setMessage("");
    const answers = questions.map((question) => ({
      questionId: question.id,
      optionId: selected[question.id],
    }));

    const response = await fetch("/api/profile/assessment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setMessage(data.error ?? "Falha ao concluir avaliacao.");
      setLoading(false);
      return;
    }

    setResult(data.assessment ?? null);
    setShowQuiz(false);
    setMessage("Perfil atualizado com sucesso.");
    setLoading(false);
  };

  return (
    <section className="rounded-xl border border-amber-200/25 bg-[linear-gradient(120deg,rgba(20,14,12,0.92),rgba(12,10,11,0.92))] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-amber-100">Teste rapido de perfil aventureiro</h3>
        {!showQuiz && (
          <Button variant="ghost" onClick={() => setShowQuiz(true)}>
            Refazer teste
          </Button>
        )}
      </div>

      {!showQuiz && result && (
        <div className="mt-3 space-y-2 text-sm">
          <p>
            Perfil atual: <strong>{result.resultProfile}</strong>
          </p>
          <p>
            Habilidades dominantes:{" "}
            {result.dominantSkills.map((item) => skillLabels[item as keyof typeof skillLabels] ?? item).join(", ")}
          </p>
          <div className="space-y-1">
            {sortedScores.map(([skill, score]) => (
              <div key={skill}>
                <p className="text-xs text-amber-100/80">
                  {skillLabels[skill as keyof typeof skillLabels] ?? skill}: {score}
                </p>
                <div className="h-2 w-full rounded-full bg-slate-800">
                  <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(100, Number(score) * 5)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-amber-100/70">Atualizado em {new Date(result.completedAt).toLocaleString("pt-BR")}</p>
        </div>
      )}

      {showQuiz && (
        <div className="mt-3 space-y-3">
          {questions.map((question) => (
            <article key={question.id} className="rounded-md border border-amber-100/15 bg-black/20 p-3">
              <p className="font-medium">{question.title}</p>
              <div className="mt-2 grid gap-2">
                {question.options.map((option) => (
                  <label key={option.id} className="flex items-center gap-2 rounded-md border border-amber-100/10 bg-black/25 p-2 text-sm">
                    <input
                      type="radio"
                      name={question.id}
                      checked={selected[question.id] === option.id}
                      onChange={() => setSelected((prev) => ({ ...prev, [question.id]: option.id }))}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </article>
          ))}

          <div className="flex items-center justify-between">
            <p className="text-xs text-amber-100/80">{answeredCount}/{questions.length} respostas</p>
            <Button onClick={submit} disabled={loading || answeredCount !== questions.length}>
              {loading ? "Processando..." : "Concluir teste"}
            </Button>
          </div>
        </div>
      )}

      {message && <p className="mt-2 text-sm text-amber-200">{message}</p>}
    </section>
  );
}
