import { test, expect } from "@playwright/test";

test("login and access profile", async ({ page }) => {
  await page.goto("/login");
  const email = process.env.DEMO_ADVENTURER_EMAIL ?? "demo-adventurer@example.com";
  const password = process.env.DEMO_ADVENTURER_PASSWORD ?? "change-me-adventurer-password";
  await page.getByPlaceholder("email").fill(email);
  await page.getByPlaceholder("senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/home/);
  await page.getByRole("link", { name: "Perfil" }).click();
  await expect(page.getByRole("heading", { name: "Perfil" })).toBeVisible();
});
