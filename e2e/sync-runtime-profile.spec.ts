import { expect, test, type Page } from "@playwright/test";

async function readDiagnosticsCounter(
  page: Page,
  label: string,
): Promise<number> {
  const counterText = await page
    .getByText(new RegExp(`^${label}:\\s*\\d+`))
    .first()
    .textContent();
  if (!counterText) return 0;
  const parsed = Number(counterText.replace(/^.*:\s*/u, "").trim());
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
}

async function waitForE2EBridge(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__solostackE2E)), {
      timeout: 5000,
    })
    .toBe(true);
}

test.describe("Sync runtime profile", () => {
  test("supports presets and local validation in web runtime", async ({
    page,
  }) => {
    await page.goto("/");

    const sidebar = page.locator(".sidebar-nav");
    await expect(sidebar).toBeVisible();

    await sidebar
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Sync Runtime Profile")).toBeVisible();

    const foregroundInput = page.getByLabel("Foreground Interval (s)");
    const backgroundInput = page.getByLabel("Background Interval (s)");
    const pushLimitInput = page.getByLabel("Push Limit");
    const pullLimitInput = page.getByLabel("Pull Limit");
    const maxPullPagesInput = page.getByLabel("Max Pull Pages");

    await page.getByRole("button", { name: "Desktop Preset" }).click();
    await expect(foregroundInput).toHaveValue("60");
    await expect(backgroundInput).toHaveValue("300");
    await expect(pushLimitInput).toHaveValue("200");
    await expect(pullLimitInput).toHaveValue("200");
    await expect(maxPullPagesInput).toHaveValue("5");

    await page.getByRole("button", { name: "Mobile Beta Preset" }).click();
    await expect(foregroundInput).toHaveValue("120");
    await expect(backgroundInput).toHaveValue("600");
    await expect(pushLimitInput).toHaveValue("120");
    await expect(pullLimitInput).toHaveValue("120");
    await expect(maxPullPagesInput).toHaveValue("3");

    await foregroundInput.fill("300");
    await backgroundInput.fill("60");
    await page.getByRole("button", { name: "Save Runtime" }).click();
    await expect(
      page
        .getByText("Background interval must be >= foreground interval.")
        .first(),
    ).toBeVisible();

    await expect(page.getByText("Sync Diagnostics (Session)")).toBeVisible();
    await expect(page.getByText(/Success rate:/)).toBeVisible();
  });

  test("updates diagnostics when provider/runtime settings change", async ({
    page,
  }) => {
    await page.goto("/?e2e=1&e2e_transport=1");
    await waitForE2EBridge(page);
    await page.evaluate(async () => {
      const bridge = window.__solostackE2E;
      if (!bridge) throw new Error("E2E bridge missing.");
      await bridge.resetSyncState();
    });

    const sidebar = page.locator(".sidebar-nav");
    await expect(sidebar).toBeVisible();

    await sidebar
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByText("Sync Diagnostics (Session)")).toBeVisible();

    const providerSelect = page.getByLabel("Provider");
    const profileSelect = page.getByLabel("Profile");
    const providerEventsBefore = await readDiagnosticsCounter(
      page,
      "Provider selected events",
    );
    const runtimeEventsBefore = await readDiagnosticsCounter(
      page,
      "Runtime profile change events",
    );

    await providerSelect.selectOption("google_appdata");
    await page.getByRole("button", { name: "Save Provider" }).click();
    await expect(page.getByText("Sync provider was saved.")).toBeVisible();
    await expect(
      page.getByText(
        "Managed provider selected (custom URLs are still used in current build).",
      ),
    ).toBeVisible();
    await expect(
      page.getByText("Provider (sync loop): Google AppData"),
    ).toBeVisible();
    await expect(
      page.getByText(/Last warning: .*connector is not configured yet\./),
    ).toBeVisible();
    await expect
      .poll(() => readDiagnosticsCounter(page, "Provider selected events"))
      .toBeGreaterThan(providerEventsBefore);

    await profileSelect.selectOption("mobile_beta");
    await page.getByRole("button", { name: "Save Runtime" }).click();
    await expect(
      page.getByText("Sync runtime profile (Mobile Beta) was saved."),
    ).toBeVisible();
    await expect
      .poll(() => readDiagnosticsCounter(page, "Runtime profile change events"))
      .toBeGreaterThan(runtimeEventsBefore);
  });
});
