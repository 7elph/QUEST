import { test, expect } from "@playwright/test";

test("landing renders hero", async ({ page }) => {
  await page.goto("/landing");
  await expect(page).toHaveURL(/v0-landing-page-quest\.vercel\.app/);
});
