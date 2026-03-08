import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const adventurerEmail = process.env.DEMO_ADVENTURER_EMAIL ?? "aventureiro.demo@quest.local";
const adventurerPassword = process.env.DEMO_ADVENTURER_PASSWORD ?? "QuestAventura123!";
const otherAdventurerEmail = process.env.LLM_SIM_EMAIL ?? "llm.simulador@quest.local";
const otherAdventurerPassword = process.env.LLM_SIM_PASSWORD ?? "Quest1234!";

async function login(context: BrowserContext, email: string, password: string): Promise<Page> {
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByPlaceholder("email").fill(email);
  await page.getByPlaceholder("senha").fill(password);
  await Promise.all([
    page.waitForURL(/\/home/),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);
  return page;
}

async function fetchJson(
  page: Page,
  url: string,
  options?: { method?: "GET" | "POST"; body?: Record<string, unknown> },
) {
  return page.evaluate(
    async ({ endpoint, requestOptions }) => {
      const response = await fetch(endpoint, {
        method: requestOptions?.method ?? "GET",
        headers: requestOptions?.body ? { "Content-Type": "application/json" } : undefined,
        body: requestOptions?.body ? JSON.stringify(requestOptions.body) : undefined,
      });
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      return { ok: response.ok, status: response.status, payload };
    },
    { endpoint: url, requestOptions: options },
  );
}

async function uploadTextFile(page: Page, text: string, name: string) {
  return page.evaluate(
    async ({ content, fileName }) => {
      const form = new FormData();
      form.append("file", new File([content], fileName, { type: "text/plain" }));
      const response = await fetch("/api/upload", { method: "POST", body: form });
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      return { ok: response.ok, status: response.status, payload };
    },
    { content: text, fileName: name },
  );
}

test("login ignores external callbackUrl", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/login?callbackUrl=https%3A%2F%2Fevil.example%2Fphish");
  await page.getByPlaceholder("email").fill(adventurerEmail);
  await page.getByPlaceholder("senha").fill(adventurerPassword);
  await Promise.all([
    page.waitForURL(/\/home/),
    page.getByRole("button", { name: "Entrar" }).click(),
  ]);

  expect(page.url()).not.toContain("evil.example");
  await context.close();
});

test("rbac blocks cross-user mission access and upload reuse", async ({ browser }) => {
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const pageA = await login(contextA, adventurerEmail, adventurerPassword);
  const pageB = await login(contextB, otherAdventurerEmail, otherAdventurerPassword);

  const assignedResponse = await fetchJson(pageA, "/api/missions?status=ASSIGNED");
  expect(assignedResponse.ok).toBeTruthy();
  const assignedPayload = assignedResponse.payload as { missions?: Array<{ id: string; status: string }> };
  let missionId = assignedPayload.missions?.find((item) => item.status === "ASSIGNED")?.id ?? "";

  if (!missionId) {
    const openResponse = await fetchJson(pageA, "/api/missions?status=OPEN");
    expect(openResponse.ok).toBeTruthy();
    const openPayload = openResponse.payload as { missions?: Array<{ id: string }> };
    const openMissionId = openPayload.missions?.[0]?.id ?? "";
    expect(openMissionId).toBeTruthy();

    const acceptResponse = await fetchJson(pageA, `/api/missions/${openMissionId}/accept`, { method: "POST" });
    expect(acceptResponse.ok).toBeTruthy();
    missionId = openMissionId;
  }

  const detailResponse = await fetchJson(pageB, `/api/missions/${missionId}`);
  expect(detailResponse.status).toBe(403);

  const otherListResponse = await fetchJson(pageB, "/api/missions?status=ASSIGNED");
  expect(otherListResponse.ok).toBeTruthy();
  const otherListPayload = otherListResponse.payload as { missions?: Array<{ id: string }> };
  expect((otherListPayload.missions ?? []).some((item) => item.id === missionId)).toBeFalsy();

  const uploadResponse = await uploadTextFile(pageB, "foreign-proof", "foreign-proof.txt");
  expect(uploadResponse.status).toBe(201);
  const uploadPayload = uploadResponse.payload as { url?: string };
  expect(uploadPayload.url).toBeTruthy();

  const submitResponse = await fetchJson(pageA, `/api/missions/${missionId}/submit`, {
    method: "POST",
    body: {
      proofLinks: [],
      proofFiles: [uploadPayload.url as string],
      notes: "teste ownership de arquivo",
    },
  });
  expect(submitResponse.status).toBe(400);
  const submitPayload = submitResponse.payload as { error?: string };
  expect(submitPayload.error ?? "").toContain("nao sao validas");

  await contextA.close();
  await contextB.close();
});
