import { expect, test, type Page } from "@playwright/test";

interface SeededConflictInfo {
  conflict_id: string;
  entity_id: string;
}

async function seedConflictViaBridge(page: Page): Promise<SeededConflictInfo> {
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__solostackE2E)), {
      timeout: 5000,
    })
    .toBe(true);

  const seeded = await page.evaluate(async () => {
    const bridge = window.__solostackE2E;
    if (!bridge) {
      throw new Error("E2E bridge is not available.");
    }

    await bridge.resetSyncState();
    return bridge.seedTaskFieldConflict();
  });

  return seeded;
}

test.describe("Conflict retry and re-resolve flow", () => {
  test("supports retry confirmation and subsequent resolve", async ({
    page,
  }) => {
    await page.goto("/?e2e=1");
    const seededConflict = await seedConflictViaBridge(page);

    const sidebar = page.locator(".sidebar-nav");
    await expect(sidebar).toBeVisible();
    await sidebar
      .getByRole("button", { name: "Conflicts", exact: true })
      .click();

    await expect(
      page.getByRole("heading", { name: "Conflict Center" }),
    ).toBeVisible();

    const conflictItem = page
      .locator(".conflict-center-item")
      .filter({ hasText: seededConflict.entity_id })
      .first();
    await expect(conflictItem).toBeVisible();

    let retryDialogMessage: string | null = null;
    page.once("dialog", async (dialog) => {
      retryDialogMessage = dialog.message();
      await dialog.accept();
    });

    await conflictItem.getByRole("button", { name: "Retry" }).click();
    await expect
      .poll(() => retryDialogMessage, {
        timeout: 5000,
      })
      .toContain("re-queue this conflict");

    await expect(page.getByText("Conflict queued for retry.")).toBeVisible();
    await expect(conflictItem).toBeVisible();

    const openConflictIdsAfterRetry = await page.evaluate(async () => {
      const bridge = window.__solostackE2E;
      if (!bridge) return [];
      return bridge.listOpenConflictIds();
    });
    expect(openConflictIdsAfterRetry).toContain(seededConflict.conflict_id);

    await conflictItem.getByRole("button", { name: "Keep Local" }).click();
    await expect(page.getByText("Conflict marked as resolved.")).toBeVisible();

    await expect(
      page
        .locator(".conflict-center-item")
        .filter({ hasText: seededConflict.entity_id }),
    ).toHaveCount(0);
    await expect(page.getByText("No open conflicts")).toBeVisible();

    const openConflictIdsAfterResolve = await page.evaluate(async () => {
      const bridge = window.__solostackE2E;
      if (!bridge) return [];
      return bridge.listOpenConflictIds();
    });
    expect(openConflictIdsAfterResolve).not.toContain(
      seededConflict.conflict_id,
    );

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
    await expect(syncCard.locator(".sync-pill")).toContainText(
      "Needs attention",
    );
    await expect(
      syncCard.getByText(
        "Conflicts resolved locally. Run Sync now to confirm.",
      ),
    ).toBeVisible();

    await syncCard
      .getByRole("button", { name: /Sync now|Syncing\.\.\./u })
      .click();
    await expect(syncCard.locator(".sync-pill")).toContainText("Synced");
    await expect(
      syncCard.getByText(
        "Conflicts resolved locally. Run Sync now to confirm.",
      ),
    ).toHaveCount(0);
  });
});
