import fs from "fs";
import path from "path";
import { spawn, spawnSync } from "child_process";

const args = new Set(process.argv.slice(2));

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function boolFromEnv(value, fallback = false) {
  if (typeof value !== "string") return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function run(command, { required = true, stdio = "inherit" } = {}) {
  console.log(`\n> ${command}`);
  const result = spawnSync(command, {
    stdio,
    shell: true,
  });

  if (result.status !== 0 && required) {
    process.exit(result.status ?? 1);
  }

  return result.status ?? 1;
}

function runBin(binary, binArgs, { required = true, stdio = "inherit" } = {}) {
  console.log(`\n> ${binary} ${binArgs.join(" ")}`);
  const result = spawnSync(binary, binArgs, {
    stdio,
  });

  if (result.status !== 0 && required) {
    process.exit(result.status ?? 1);
  }

  return result.status ?? 1;
}

function commandExists(command) {
  const probe = process.platform === "win32" ? `where ${command}` : `command -v ${command}`;
  const result = spawnSync(probe, {
    stdio: "ignore",
    shell: true,
  });
  return result.status === 0;
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

function validateMigrations() {
  const migrationsDir = path.join("prisma", "migrations");
  if (!fs.existsSync(migrationsDir)) return;

  const broken = fs
    .readdirSync(migrationsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((dir) => !fs.existsSync(path.join(migrationsDir, dir, "migration.sql")));

  if (broken.length > 0) {
    console.error("Foram encontradas migracoes sem migration.sql:");
    for (const name of broken) {
      console.error(`- prisma/migrations/${name}/migration.sql`);
    }
    console.error("Restaure os arquivos ou remova as pastas quebradas antes de rodar quest:all.");
    process.exit(1);
  }
}

function waitForPostgres(maxAttempts = 45, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = spawnSync("docker exec quest-postgres pg_isready -U quest -d quest", {
      stdio: "ignore",
      shell: true,
    });

    if (result.status === 0) {
      console.log("Postgres pronto.");
      return true;
    }

    console.log(`Aguardando Postgres... tentativa ${attempt}/${maxAttempts}`);
    sleep(delayMs);
  }

  console.error("Postgres nao ficou pronto a tempo.");
  return false;
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

function resolveOllamaBinary() {
  if (commandExists("ollama")) return "ollama";

  if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
      const programPath = path.join(localAppData, "Programs", "Ollama", "ollama.exe");
      if (fs.existsSync(programPath)) return programPath;

      const packagesRoot = path.join(localAppData, "Microsoft", "WinGet", "Packages");
      if (fs.existsSync(packagesRoot)) {
        const candidates = fs
          .readdirSync(packagesRoot, { withFileTypes: true })
          .filter((entry) => entry.isDirectory() && entry.name.startsWith("Ollama.Ollama_"))
          .map((entry) => path.join(packagesRoot, entry.name, "ollama.exe"))
          .filter((fullPath) => fs.existsSync(fullPath));
        if (candidates.length > 0) return candidates[0];
      }
    }
  }

  return null;
}

function normalizeUrl(baseUrl) {
  return (baseUrl || "http://127.0.0.1:11434").trim().replace(/\/+$/, "");
}

async function isOllamaUp(baseUrl) {
  try {
    const response = await fetch(`${normalizeUrl(baseUrl)}/api/tags`);
    return response.ok;
  } catch {
    return false;
  }
}

async function waitForOllama(baseUrl, maxAttempts = 30, delayMs = 1200) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (await isOllamaUp(baseUrl)) {
      return true;
    }
    console.log(`Aguardando Ollama... tentativa ${attempt}/${maxAttempts}`);
    sleep(delayMs);
  }
  return false;
}

function collectWarmupModels(env) {
  const defaults = [
    env.OLLAMA_MODEL,
    env.OLLAMA_MISSION_MODEL,
    env.OLLAMA_RPG_MODEL,
    env.OLLAMA_DISPUTE_MODEL,
    env.OLLAMA_SIMULATION_MODEL,
  ];

  const extra = (env.OLLAMA_WARMUP_MODELS ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return [...new Set([...defaults, ...extra].filter(Boolean))];
}

async function setupOllama(env) {
  const enabled = boolFromEnv(env.OLLAMA_ENABLED ?? "true", true);
  if (!enabled) {
    console.log("Ollama desativado (OLLAMA_ENABLED=false).");
    return null;
  }

  const ollama = resolveOllamaBinary();
  if (!ollama) {
    console.log("Ollama nao encontrado. Pulando aquecimento de modelos.");
    return null;
  }

  const baseUrl = normalizeUrl(env.OLLAMA_BASE_URL);
  let startedProc = null;

  const running = await isOllamaUp(baseUrl);
  if (!running) {
    console.log(`\n> ${ollama} serve`);
    startedProc = spawn(ollama, ["serve"], { stdio: "ignore" });
  }

  const ready = await waitForOllama(baseUrl);
  if (!ready) {
    console.log("Ollama nao ficou disponivel a tempo. Continuando sem warm-up.");
    if (startedProc && !startedProc.killed) startedProc.kill();
    return null;
  }
  console.log("Ollama pronto.");

  const models = collectWarmupModels(env);
  if (models.length === 0) {
    console.log("Nenhum modelo de warm-up configurado.");
    return startedProc;
  }

  const warmupPrompt = env.OLLAMA_WARMUP_PROMPT || "Responda apenas: OK";

  for (const model of models) {
    console.log(`\n[Ollama] Preparando modelo: ${model}`);
    runBin(ollama, ["pull", model], { required: false });
    runBin(ollama, ["run", model, warmupPrompt], { required: false });
  }

  return startedProc;
}

function extractNgrokPublicUrl(payload) {
  if (!payload || !Array.isArray(payload.tunnels)) return null;
  const httpsTunnel = payload.tunnels.find((tunnel) => typeof tunnel?.public_url === "string" && tunnel.public_url.startsWith("https://"));
  if (httpsTunnel?.public_url) return httpsTunnel.public_url;
  const firstTunnel = payload.tunnels.find((tunnel) => typeof tunnel?.public_url === "string");
  return firstTunnel?.public_url ?? null;
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

async function waitForNgrokPublicUrl(maxAttempts = 20, delayMs = 500) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch("http://127.0.0.1:4040/api/tunnels", { cache: "no-store" });
      if (response.ok) {
        const payload = await response.json();
        const publicUrl = extractNgrokPublicUrl(payload);
        if (publicUrl) {
          return publicUrl;
        }
      }
    } catch {
      // ngrok API ainda nao subiu
    }
    sleep(delayMs);
  }
  return null;
}

async function setupNgrokWithUrl(env) {
  const enabled = args.has("--ngrok") || boolFromEnv(env.NGROK_ENABLED, false);
  if (!enabled) return null;

  const desiredPort = String(env.NGROK_PORT || "3000");
  const existing = await fetchExistingNgrokTunnel();
  const existingAddr = existing?.tunnel?.config?.addr;
  if (existing?.publicUrl && (!existingAddr || String(existingAddr).includes(desiredPort))) {
    process.env.NEXTAUTH_URL = existing.publicUrl;
    upsertEnvValue(".env", "NEXTAUTH_URL", existing.publicUrl);
    console.log(`[ngrok] Reutilizando tunel existente: ${existing.publicUrl}`);
    console.log("[ngrok] NEXTAUTH_URL sincronizado em .env");
    return { proc: null, publicUrl: existing.publicUrl, reused: true };
  }

  const ngrok = resolveNgrokBinary();
  if (!ngrok) {
    console.log("NGROK_ENABLED=true, mas ngrok nao foi encontrado. Pulando tunel.");
    return null;
  }

  if (env.NGROK_AUTHTOKEN) {
    runBin(ngrok, ["config", "add-authtoken", env.NGROK_AUTHTOKEN], { required: false, stdio: "ignore" });
  }

  runBin(ngrok, ["update"], { required: false, stdio: "ignore" });

  const ngrokArgs = ["http", desiredPort];
  if (env.NGROK_REGION) {
    ngrokArgs.push("--region", env.NGROK_REGION);
  }
  if (env.NGROK_DOMAIN) {
    ngrokArgs.push("--domain", env.NGROK_DOMAIN);
  }

  console.log(`\n> ${ngrok} ${ngrokArgs.join(" ")}`);
  const proc = spawn(ngrok, ngrokArgs, { stdio: "inherit" });
  const publicUrl = await waitForNgrokPublicUrl();

  if (publicUrl) {
    process.env.NEXTAUTH_URL = publicUrl;
    upsertEnvValue(".env", "NEXTAUTH_URL", publicUrl);
    console.log(`[ngrok] URL publica: ${publicUrl}`);
    console.log("[ngrok] NEXTAUTH_URL sincronizado em .env");
    console.log(`[ngrok] Acesse no celular: ${publicUrl}/home`);
    console.log("[ngrok] O link espelha todas as paginas do app.");
  } else {
    if (proc.exitCode !== null) {
      console.error("ngrok encerrou sem abrir tunel. Verifique erro acima (ex.: ERR_NGROK_108 por sessao duplicada).");
      console.error("Feche sessoes ativas no dashboard: https://dashboard.ngrok.com/agents");
      return { proc: null, publicUrl: null, error: "NGROK_START_FAILED" };
    }
    console.log("ngrok iniciado. Abra http://127.0.0.1:4040 para copiar a URL publica.");
  }

  return { proc, publicUrl };
}

ensureEnvFile();
validateMigrations();

const envFile = parseDotEnv(".env");
const env = { ...envFile, ...process.env };

const skipDocker = args.has("--skip-docker") || boolFromEnv(env.QUEST_SKIP_DOCKER, false);
const skipQuality = args.has("--skip-quality") || boolFromEnv(env.QUEST_SKIP_QUALITY, false);
const skipSeed = args.has("--skip-seed") || !boolFromEnv(env.DEMO_SEED ?? "true", true);
const noDev = args.has("--no-dev") || boolFromEnv(env.QUEST_NO_DEV, false);
const skipOllama = args.has("--skip-ollama") || boolFromEnv(env.QUEST_SKIP_OLLAMA, false);

if (!fs.existsSync("node_modules")) {
  run("npm install");
}

if (!skipDocker) {
  if (commandExists("docker")) {
    const upStatus = run("docker compose up -d", { required: false });
    if (upStatus !== 0) {
      console.error("Falha ao subir Docker. Verifique se o Docker Desktop esta aberto.");
      process.exit(1);
    }
    if (!waitForPostgres()) {
      process.exit(1);
    }
  } else {
    console.log("Docker nao encontrado. Pulando 'docker compose up -d'.");
    console.log("Garanta que o Postgres do DATABASE_URL esteja ativo antes da migracao.");
  }
} else {
  console.log("QUEST_SKIP_DOCKER=true. Pulando etapa Docker.");
}

run("npm run prisma:generate");
run("npm run prisma:deploy");

if (!skipSeed) {
  run("npm run seed");
} else {
  console.log("Seed pulado (DEMO_SEED=false ou --skip-seed).");
}

if (!skipQuality) {
  if (!skipOllama) {
    await setupOllama(env);
  } else {
    console.log("Warm-up de Ollama pulado (QUEST_SKIP_OLLAMA=true ou --skip-ollama).");
  }
  run("npm run lint");
  run("npm run test");
  run("npm run build");
} else {
  console.log("Checks de qualidade pulados (QUEST_SKIP_QUALITY=true ou --skip-quality).");
}

let ngrokProc = null;
if (!noDev) {
  const ngrokSession = await setupNgrokWithUrl(env);
  if (ngrokSession?.error) {
    process.exit(1);
  }
  ngrokProc = ngrokSession?.proc ?? null;
  const devStatus = run("npm run dev", { required: false });
  if (ngrokProc && !ngrokProc.killed) {
    ngrokProc.kill();
  }
  if (devStatus !== 0) {
    process.exit(devStatus);
  }
} else {
  console.log("QUEST_NO_DEV=true. Pipeline finalizado sem iniciar next dev.");
}
