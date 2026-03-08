"use client";

import { useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sanitizeCallbackUrl } from "@/lib/callback-url";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [callbackUrl, setCallbackUrl] = useState("/home");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cb = params.get("callbackUrl");
    const emailParam = params.get("email");
    setCallbackUrl(sanitizeCallbackUrl(cb, "/home"));
    if (emailParam) setEmail(emailParam);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result || result.error || !result.ok) {
        if (result?.error === "CredentialsSignin") {
          setError("Falha no login. Verifique email/senha e status da conta.");
        } else {
          setError("Falha no login. Tente novamente.");
        }
        setLoading(false);
        return;
      }

      window.location.assign(sanitizeCallbackUrl(result.url ?? callbackUrl, callbackUrl || "/home"));
    } catch {
      setError("Falha de conexao no login.");
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md rounded-xl border border-amber-200/20 bg-black/30 p-6">
      <h1 className="text-2xl font-bold text-amber-200">Entrar na Guilda</h1>
      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <Input type="email" placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        <Input type="password" placeholder="senha" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <Button type="submit" className="w-full" disabled={loading}>{loading ? "Entrando..." : "Entrar"}</Button>
      </form>
      <p className="mt-4 text-sm text-amber-50/80">Ainda nao tem conta? <a href="/register" className="text-amber-300">Cadastre-se</a></p>
      <p className="mt-2 text-sm text-amber-50/80"><a href="/reset-password" className="text-amber-300">Esqueci minha senha</a></p>
    </div>
  );
}
