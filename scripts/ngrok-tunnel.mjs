import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";

const args = new Set(process.argv.slice(2));

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function commandExists(command) {
  const probe = process.platform === "win32" ? `where ${command}` : `command -v ${command}`;
  const result = spawnSync(probe, {
    stdio: "ignore",
    shell: true,
  });
  return result.status === 0;
}

function runBin(binary, binArgs, { required = true, stdio = "inherit" } = {}) {
  console.log(`\n> ${binary} ${binArgs.join(" ")}`);
  const result = spawnSync(binary, binArgs, { stdio });
  if (result.status !== 0 && required) {
    process.exit(result.status ?? 1);
  }
  return result.status ?? 1;
}

function ensureEnvFile() {
  if (fs.existsSync(".env")) return;
  if (!fs.existsSync(".env.example")) {
    console.error(".env.example nao encontrado.");
    process.exit(1);
  }
  fs.copyFileSync(".env.example", ".env");
  console.log(".env criado a partir de .env.example");
}

function parseDotEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, "utf8");
  const entries = {};

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match) continue;

    const key = match[1];
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    entries[key] = value;
  }

  return entries;
}

function upsertEnvValue(filePath, key, value) {
  const quoteSafe = String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const rendered = `${key}="${quoteSafe}"`;

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, `${rendered}\n`, "utf8");
    return;
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const lines = raw.split(/\r?\n/);
  let replaced = false;
  const nextLines = lines.map((line) => {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match?.[1] === key) {
      replaced = true;
      return rendered;
    }
    return line;
  });

  if (!replaced) {
    if (nextLines.length > 0 && nextLines[nextLines.length - 1].trim().length > 0) {
      nextLines.push("");
    }
    nextLines.push(rendered);
  }

  fs.writeFileSync(filePath, `${nextLines.join("\n").replace(/\n+$/, "\n")}`, "utf8");
}

function resolveNgrokBinary() {
  if (commandExists("ngrok")) return "ngrok";
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return null;

  const packagesRoot = path.join(localAppData, "Microsoft", "WinGet", "Packages");
  if (!fs.existsSync(packagesRoot)) return null;

  const candidates = fs
    .readdirSync(packagesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("Ngrok.Ngrok_"))
    .map((entry) => path.join(packagesRoot, entry.name, "ngrok.exe"))
    .filter((fullPath) => fs.existsSync(fullPath));

  return candidates[0] ?? null;
}

function extractNgrokPublicUrl(payload) {
  if (!payload || !Array.isArray(payload.tunnels)) return null;
  const httpsTunnel = payload.tunnels.find((tunnel) => typeof tunnel?.public_url === "string" && tunnel.public_url.startsWith("https://"));
  if (httpsTunnel?.public_url) return httpsTunnel.public_url;
  const firstTunnel = payload.tunnels.find((tunnel) => typeof tunnel?.public_url === "string");
  return firstTunnel?.public_url ?? null;
}

function addrMatchesPort(addr, port) {
  const normalized = String(addr || "").trim().toLowerCase();
  if (!normalized) return false;
  return (
    normalized === port ||
    normalized.endsWith(`:${port}`) ||
    normalized.includes(`:${port}/`) ||
    normalized.includes(`localhost:${port}`) ||
    normalized.includes(`127.0.0.1:${port}`)
  );
}

async function fetchExistingNgrokTunnel() {
  try {
    const response = await fetch("http://127.0.0.1:4040/api/tunnels", { cache: "no-store" });
    if (!response.ok) return null;
    const payload = await response.json();
    if (!payload || !Array.isArray(payload.tunnels) || payload.tunnels.length === 0) return null;
    const publicUrl = extractNgrokPublicUrl(payload);
    if (!publicUrl) return null;
    const tunnel = payload.tunnels.find((item) => item?.public_url === publicUrl) ?? payload.tunnels[0];
    return { publicUrl, tunnel };
  } catch {
    return null;
  }
}

async function waitForNgrokPublicUrl(maxAttempts = 40, delayMs = 500) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:4040/api/tunnels", { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        const publicUrl = extractNgrokPublicUrl(payload);
        if (publicUrl) return publicUrl;
      }
    } catch {
      // API do ngrok ainda nao subiu.
    }
    sleep(delayMs);
  }
  return null;
}

function syncNextAuthUrl(publicUrl) {
  process.env.NEXTAUTH_URL = publicUrl;
  upsertEnvValue(".env", "NEXTAUTH_URL", publicUrl);
  if (fs.existsSync(".env.example")) {
    upsertEnvValue(".env.example", "NEXTAUTH_URL", publicUrl);
  }
}

async function main() {
  ensureEnvFile();
  const env = { ...parseDotEnv(".env"), ...process.env };
  const desiredPort = String(env.NGROK_PORT || "3000").trim();
  const statusOnly = args.has("--status");

  const existing = await fetchExistingNgrokTunnel();
  if (existing?.publicUrl) {
    const existingAddr = String(existing?.tunnel?.config?.addr ?? "");
    if (existingAddr && !addrMatchesPort(existingAddr, desiredPort)) {
      console.log(
        `[ngrok] Tunel ativo em ${existingAddr}; porta configurada ${desiredPort}. Reutilizando para evitar sessao duplicada.`,
      );
    }
    syncNextAuthUrl(existing.publicUrl);
    console.log(`[ngrok] Reutilizando tunel existente: ${existing.publicUrl}`);
    console.log("[ngrok] NEXTAUTH_URL sincronizado em .env e .env.example");
    return;
  }

  if (statusOnly) {
    console.error(`[ngrok] Nenhum tunel ativo encontrado para porta ${desiredPort}.`);
    process.exit(1);
  }

  const ngrok = resolveNgrokBinary();
  if (!ngrok) {
    console.error("ngrok nao encontrado. Instale e rode novamente: npm run tunnel");
    process.exit(1);
  }

  if (env.NGROK_AUTHTOKEN) {
    runBin(ngrok, ["config", "add-authtoken", env.NGROK_AUTHTOKEN], { required: false, stdio: "ignore" });
  }

  const ngrokArgs = ["http", desiredPort];
  if (env.NGROK_REGION) {
    ngrokArgs.push("--region", env.NGROK_REGION);
  }
  if (env.NGROK_DOMAIN) {
    ngrokArgs.push("--domain", env.NGROK_DOMAIN);
  }

  console.log(`\n> ${ngrok} ${ngrokArgs.join(" ")}`);
  const proc = spawn(ngrok, ngrokArgs, { stdio: "inherit" });

  const shutdown = () => {
    if (proc.exitCode === null && !proc.killed) {
      proc.kill();
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const publicUrl = await waitForNgrokPublicUrl();
  if (publicUrl) {
    syncNextAuthUrl(publicUrl);
    console.log(`[ngrok] URL publica: ${publicUrl}`);
    console.log("[ngrok] NEXTAUTH_URL sincronizado em .env e .env.example");
    console.log(`[ngrok] Acesse no celular: ${publicUrl}/home`);
  } else if (proc.exitCode !== null) {
    console.error("ngrok encerrou sem abrir tunel. Verifique o erro acima (ex.: ERR_NGROK_108).");
    console.error("Feche sessoes ativas no dashboard: https://dashboard.ngrok.com/agents");
    process.exit(proc.exitCode ?? 1);
  } else {
    console.log("ngrok iniciado. Abra http://127.0.0.1:4040 para copiar a URL publica.");
  }

  const exitCode = await new Promise((resolve) => {
    proc.on("exit", (code) => resolve(code ?? 0));
  });
  process.exit(exitCode);
}

main().catch((error) => {
  console.error("[ngrok] Falha ao iniciar tunel:", error);
  process.exit(1);
});
