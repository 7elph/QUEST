"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPasswordRules } from "@/lib/password-policy";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("ADVENTURER");
  const [acceptedRules, setAcceptedRules] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const passwordRules = getPasswordRules(password);
  const isPasswordStrong = passwordRules.every((rule) => rule.valid);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const qRole = params.get("role");
    if (qRole === "PATRON" || qRole === "ADVENTURER") {
      setRole(qRole);
    }
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    if (!isPasswordStrong) {
      setError("Sua senha ainda nao atende os requisitos de seguranca.");
      setLoading(false);
      return;
    }

    if (!passwordsMatch) {
      setError("As senhas nao conferem.");
      setLoading(false);
      return;
    }

    if (!acceptedRules) {
      setError("Aceite as regras do Alpha para continuar.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Falha no cadastro.");
        setLoading(false);
        return;
      }

      const loginParams = new URLSearchParams({ email: email.trim().toLowerCase(), callbackUrl: "/home" });
      router.push(`/login?${loginParams.toString()}`);
    } catch {
      setError("Nao foi possivel concluir o cadastro. Tente novamente.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-xl border border-amber-200/20 bg-black/30 p-6">
      <h1 className="text-2xl font-bold text-amber-200">Cadastro QUEST</h1>
      <form onSubmit={submit} className="mt-4 space-y-3">
        <Input placeholder="nome" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
        <Input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <Input type="password" placeholder="senha forte" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" required />
        <Input
          type="password"
          placeholder="confirmar senha"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          autoComplete="new-password"
          required
        />
        {confirmPassword.length > 0 && !passwordsMatch ? <p className="text-sm text-red-400">As senhas nao conferem.</p> : null}
        <div className="rounded-md border border-amber-200/20 bg-black/20 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-100/80">Requisitos da senha</p>
          <ul className="mt-2 space-y-1 text-xs text-amber-100/80">
            {passwordRules.map((rule) => (
              <li key={rule.id} className={rule.valid ? "text-emerald-300" : "text-amber-100/70"}>
                {rule.valid ? "OK" : "-"} {rule.label}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={() => setRole("ADVENTURER")} className={`rounded-md border px-3 py-2 text-sm ${role === "ADVENTURER" ? "border-amber-400" : "border-amber-100/20"}`}>Aventureiro</button>
          <button type="button" onClick={() => setRole("PATRON")} className={`rounded-md border px-3 py-2 text-sm ${role === "PATRON" ? "border-amber-400" : "border-amber-100/20"}`}>Patrono</button>
        </div>
        <label className="flex items-start gap-2 text-xs text-amber-100/90">
          <input type="checkbox" checked={acceptedRules} onChange={(e) => setAcceptedRules(e.target.checked)} className="mt-0.5" />
          <span>Li e aceito as regras do Alpha e a politica de privacidade.</span>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Criando..." : "Criar conta"}</Button>
      </form>
    </div>
  );
}
