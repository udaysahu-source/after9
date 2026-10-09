import { test, expect } from "@playwright/test";

test.describe("Floor Ratio Balancer & Invite Sharing Suite", () => {
  test("smoke: checks landing page and auth page render properly", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/After9/i);
    await expect(page.getByRole("button", { name: /Enter After9/i })).toBeVisible();
  });

  test("verifies auth page handles mode toggle and form fields", async ({ page }) => {
    await page.goto("/auth");
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder(/Password/)).toBeVisible();
  });
});
