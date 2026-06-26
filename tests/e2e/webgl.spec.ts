import { test, expect, type ConsoleMessage } from "@playwright/test";

/**
 * E2E coverage for the public home page and its progressive WebGL hero.
 *
 * The hand-built home can render a static <picture> (the LCP / complete
 * fallback) with an idle-mounted <canvas> enhancement layered on top. A
 * published builder-driven home may not use the WebGL hero at all, so the
 * canvas assertion is scoped to the actual enhancement surface.
 */

// Console noise that is benign and not indicative of a real page error.
const BENIGN_CONSOLE = [
  /favicon/i,
  /Failed to load resource.*404/i,
  /Download the React DevTools/i,
  // Service worker / PWA registration chatter.
  /serwist/i,
  /workbox/i,
];

function collectConsoleErrors(messages: string[]) {
  return (msg: ConsoleMessage) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (BENIGN_CONSOLE.some((re) => re.test(text))) return;
    messages.push(text);
  };
}

test("home renders without console errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", collectConsoleErrors(errors));
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/");

  // Every variant of the home page renders exactly one <h1>.
  await expect(page.locator("h1").first()).toBeVisible();

  expect(errors, `unexpected console errors:\n${errors.join("\n")}`).toEqual(
    [],
  );
});

test("WebGL hero canvas mounts when configured", async ({ page }, testInfo) => {
  await page.goto("/");

  // The static <picture> is the LCP fallback and must be present immediately.
  const picture = page.locator("picture").first();
  const hasPicture = (await picture.count()) > 0;

  // Empty DB → empty-state hero, no <picture>. Nothing to enhance; keep green.
  test.skip(
    !hasPicture,
    "No published photo for the hero (empty DB); WebGL hero not rendered.",
  );

  await expect(picture).toBeVisible();
  await expect(picture.locator("img").first()).toBeVisible();

  const hero = page.locator("[data-webgl-hero]").first();
  test.skip(
    (await hero.count()) === 0,
    "Home is not using the WebGL hero; static image fallback is the expected render.",
  );

  // The canvas mounts after requestIdleCallback, once the WebGL gate passes.
  // In a standard Chromium runner WebGL is available, so we expect it to show.
  await expect(hero.locator("canvas")).toBeVisible({ timeout: 8000 });

  // Visual reference for the enhanced hero.
  await page.screenshot({
    path: testInfo.outputPath("webgl-hero.png"),
    fullPage: false,
  });
});

test("navigation works", async ({ page }) => {
  await page.goto("/");

  // Prefer clicking the real nav link; fall back to direct navigation if the
  // header layout hides it (e.g. behind a mobile menu at this viewport).
  const navLink = page.getByRole("link", { name: "Categories" }).first();
  if (await navLink.isVisible().catch(() => false)) {
    await navLink.click();
  } else {
    await page.goto("/categories");
  }

  await expect(page).toHaveURL(/\/categories\/?$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Categories" }),
  ).toBeVisible();
});
