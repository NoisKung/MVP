import { expect, test, type Locator, type Page } from "@playwright/test";

async function waitForE2EBridge(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__solostackE2E)), {
      timeout: 5000,
    })
    .toBe(true);
}

async function clickSyncNow(syncCard: Locator): Promise<void> {
  await syncCard
    .getByRole("button", { name: /Sync now|Syncing\.\.\./u })
    .click();
}

test.describe("Sync retry after failed transport", () => {
  test("shows failure then recovers after manual retry", async ({ page }) => {
    await page.goto("/?e2e=1");
    await waitForE2EBridge(page);

    await page.evaluate(async () => {
      const bridge = window.__solostackE2E;
      if (!bridge) throw new Error("E2E bridge missing.");
      await bridge.resetSyncState();
      await bridge.setSyncFailureBudget(1);
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

    const syncFailureMessage = syncCard.getByText(
      "E2E simulated transport failure.",
    );

    await clickSyncNow(syncCard);
    await expect(syncFailureMessage).toBeVisible();
    await expect(syncCard.locator(".sync-pill")).toContainText(
      "Needs attention",
    );
    const retryButton = syncCard.getByRole("button", {
      name: "Retry Last Failed Sync",
    });
    await expect(retryButton).toBeVisible();

    await retryButton.click();
    await expect(syncFailureMessage).toHaveCount(0);
    await expect(syncCard.locator(".sync-pill")).toContainText("Synced");
    await expect(retryButton).toHaveCount(0);
  });
});
