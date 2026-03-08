"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getPasswordRules } from "@/lib/password-policy";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loadingRequest, setLoadingRequest] = useState(false);
  const [loadingConfirm, setLoadingConfirm] = useState(false);
  const passwordRules = getPasswordRules(password);
  const isPasswordStrong = passwordRules.every((rule) => rule.valid);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  const requestToken = async () => {
    setLoadingRequest(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/reset-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`Token Alpha gerado: ${data.alphaToken ?? "verifique e-mail"}`);
        setLoadingRequest(false);
        return;
      }
      setMessage(data.error ?? "Falha ao solicitar token");
      setLoadingRequest(false);
    } catch {
      setMessage("Falha de conexao ao solicitar token.");
      setLoadingRequest(false);
    }
  };

  const confirmReset = async () => {
    if (!isPasswordStrong) {
      setMessage("A nova senha ainda nao atende os requisitos.");
      return;
    }
    if (!passwordsMatch) {
      setMessage("As senhas nao conferem.");
      return;
    }
    setLoadingConfirm(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/reset-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), password }),
      });
      const data = await response.json();
      setMessage(response.ok ? "Senha atualizada com sucesso." : data.error ?? "Falha ao redefinir senha");
      setLoadingConfirm(false);
    } catch {
      setMessage("Falha de conexao ao redefinir senha.");
      setLoadingConfirm(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-xl border border-amber-200/20 bg-black/30 p-6 space-y-4">
      <h1 className="text-2xl font-bold text-amber-200">Reset de senha (Alpha)</h1>
      <div className="space-y-2">
        <Input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <Button onClick={requestToken} className="w-full" disabled={loadingRequest || !email.trim()}>
          {loadingRequest ? "Solicitando..." : "Solicitar token"}
        </Button>
      </div>
      <div className="space-y-2">
        <Input placeholder="token" value={token} onChange={(e) => setToken(e.target.value)} autoComplete="one-time-code" />
        <Input type="password" placeholder="nova senha" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
        <Input type="password" placeholder="confirmar nova senha" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
        {confirmPassword.length > 0 && !passwordsMatch ? <p className="text-xs text-red-400">As senhas nao conferem.</p> : null}
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
        <Button onClick={confirmReset} className="w-full" disabled={loadingConfirm || !token.trim()}>
          {loadingConfirm ? "Atualizando..." : "Confirmar nova senha"}
        </Button>
      </div>
      {message && <p className="text-sm text-amber-100">{message}</p>}
    </div>
  );
}
