import { test, expect } from "@playwright/test";

// E2E for the public client-gallery viewer (/g/[token]).
//
// The "invalid link" case is self-contained (no data setup needed). The
// happy-path test runs only when E2E_GALLERY_TOKEN is provided (a real, active
// grant token for a gallery that has ready photos) — set it in CI after seeding.

test.describe("client gallery viewer", () => {
  test("invalid/expired link shows a friendly error", async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text());
    });

    await page.goto("/g/this-token-does-not-exist-000000000000000000000");

    // The viewer fetches GET /g/{token} → 404 → renders the error screen.
    await expect(
      page.getByText(/invalid|expired|not found/i).first(),
    ).toBeVisible({ timeout: 10_000 });

    // No uncaught client errors while handling the not-found case.
    const real = consoleErrors.filter(
      (e) => !/favicon|manifest|sw\.js|404|the server responded/i.test(e),
    );
    expect(real, real.join("\n")).toHaveLength(0);
  });

  test("renders a real gallery (when E2E_GALLERY_TOKEN is set)", async ({
    page,
  }) => {
    const token = process.env.E2E_GALLERY_TOKEN;
    test.skip(!token, "E2E_GALLERY_TOKEN not provided");

    await page.goto(`/g/${token}`);

    // Either the gallery content (an image) or the password unlock form.
    const image = page.locator("picture img, img").first();
    const passwordField = page.locator('input[type="password"]').first();
    await expect(async () => {
      const hasImage = await image.isVisible().catch(() => false);
      const hasUnlock = await passwordField.isVisible().catch(() => false);
      expect(hasImage || hasUnlock).toBeTruthy();
    }).toPass({ timeout: 10_000 });

    // Must NOT be the invalid-link error screen.
    await expect(page.getByText(/invalid|expired/i)).toHaveCount(0);
  });
});
