import { expect, test, type Page } from "@playwright/test";

async function waitForE2EBridge(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__solostackE2E)), {
      timeout: 5000,
    })
    .toBe(true);
}

test.describe("Migration sync guard", () => {
  test("blocks sync actions while guard is active and restores when cleared", async ({
    page,
  }) => {
    await page.goto("/?e2e=1");
    await waitForE2EBridge(page);

    await page.evaluate(async () => {
      const bridge = window.__solostackE2E;
      if (!bridge) throw new Error("E2E bridge missing.");
      await bridge.resetSyncState();
      await bridge.setMigrationSyncWriteBlocked(
        true,
        "E2E migration guard: copy verification failed.",
      );
    });

    const sidebar = page.locator(".sidebar-nav");
    await expect(sidebar).toBeVisible();
    await sidebar
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    const syncCard = page
      .locator("section.settings-card")
      .filter({
        has: page.getByRole("heading", { name: "Sync" }),
      })
      .first();
    await expect(syncCard).toBeVisible();

    await expect(syncCard.locator(".sync-pill")).toContainText("Sync paused");
    const blockedErrorMessage = syncCard
      .locator(".settings-feedback-error")
      .filter({
        hasText:
          "Sync is temporarily blocked by migration guardrails: E2E migration guard: copy verification failed.",
      });
    await expect(blockedErrorMessage).toBeVisible();

    const syncNowButton = syncCard.getByRole("button", { name: "Sync now" });
    await expect(syncNowButton).toBeDisabled();

    await page.evaluate(async () => {
      const bridge = window.__solostackE2E;
      if (!bridge) throw new Error("E2E bridge missing.");
      await bridge.setMigrationSyncWriteBlocked(false);
    });

    await expect(syncCard.locator(".sync-pill")).toContainText("Synced");
    await expect(blockedErrorMessage).toHaveCount(0);
    await expect(syncNowButton).toBeEnabled();
  });
});
