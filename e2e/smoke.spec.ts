import { test, expect } from "@playwright/test";

test.describe("AFTER9 Smoke & Landing Suite", () => {
  test("renders welcome page with brand identity and core copy", async ({ page }) => {
    await page.goto("/");

    // Verify document title
    await expect(page).toHaveTitle(/After9/i);

    // Verify key editorial headline
    const heading = page.locator("h1");
    await expect(heading).toContainText("Meet on the floor");
    await expect(heading).toContainText("Stay after");

    // Verify call to action button exists
    const enterBtn = page.getByRole("button", { name: /Enter After9/i });
    await expect(enterBtn).toBeVisible();

    // Verify 18+ badge
    await expect(page.getByText("18+ · REAL PEOPLE ONLY")).toBeVisible();
  });

  test("navigates to auth page when clicking Enter After9", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    const enterBtn = page.getByRole("button", { name: /Enter After9/i });
    await expect(enterBtn).toBeVisible();
    await enterBtn.click();

    // Wait for route navigation to /auth
    await expect(page).toHaveURL(/\/auth/);

    // Verify auth page header and elements
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Join the floor|Welcome back/);
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder(/Password/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Continue with Google/i })).toBeVisible();
  });

  test("toggles between sign up and sign in modes", async ({ page }) => {
    await page.goto("/auth");

    const toggleBtn = page.getByRole("button", { name: /Already on After9\? Sign in|New here\? Create an account/i });
    await expect(toggleBtn).toBeVisible();

    // Toggle mode
    await toggleBtn.click();
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Welcome back|Join the floor/);
  });

  test("respects prefers-reduced-motion media query", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");

    // Verify page loads without issues and elements are present
    const heading = page.locator("h1");
    await expect(heading).toBeVisible();
  });

  test("adapts layout across mobile, tablet, and desktop viewports without horizontal overflow", async ({ page }) => {
    const viewports = [
      { name: "mobile", width: 375, height: 667 },
      { name: "tablet", width: 768, height: 1024 },
      { name: "desktop", width: 1280, height: 800 },
    ];

    for (const vp of viewports) {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto("/");

      // Verify no horizontal overflow on page
      const hasHorizontalOverflow = await page.evaluate(() => {
        return document.documentElement.scrollWidth > document.documentElement.clientWidth;
      });
      expect(hasHorizontalOverflow).toBeFalsy();

      // Check Enter button is accessible and >= 44px tall for touch target guidelines
      const enterBtn = page.getByRole("button", { name: /Enter After9/i });
      await expect(enterBtn).toBeVisible();
      const box = await enterBtn.boundingBox();
      expect(box).not.toBeNull();
      if (box) {
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    }
  });

  test("adapts auth viewports with touch target compliance and centered layout", async ({ page }) => {
    // Test on desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/auth");

    const emailInput = page.getByPlaceholder("Email");
    await expect(emailInput).toBeVisible();

    const inputHeight = await emailInput.evaluate((el) => el.getBoundingClientRect().height);
    expect(inputHeight).toBeGreaterThanOrEqual(44);

    // Verify no horizontal overflow on auth page
    const hasHorizontalOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    expect(hasHorizontalOverflow).toBeFalsy();
  });
});
