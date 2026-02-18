import { expect, test, type Locator, type Page } from "@playwright/test";

interface SeededConflictInfo {
  conflict_id: string;
  entity_id: string;
}

async function waitForE2EBridge(page: Page): Promise<void> {
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__solostackE2E)), {
      timeout: 5000,
    })
    .toBe(true);
}

async function seedConflictsViaBridge(
  page: Page,
  count: number,
): Promise<SeededConflictInfo[]> {
  await waitForE2EBridge(page);

  const seededConflicts: SeededConflictInfo[] = [];
  for (let index = 0; index < count; index += 1) {
    // Seed one conflict at a time to preserve deterministic IDs in assertions.
    const seeded = await page.evaluate(async () => {
      const bridge = window.__solostackE2E;
      if (!bridge) {
        throw new Error("E2E bridge is not available.");
      }
      return bridge.seedTaskFieldConflict();
    });
    seededConflicts.push(seeded);
  }
  return seededConflicts;
}

async function openConflictCenter(page: Page): Promise<void> {
  const sidebar = page.locator(".sidebar-nav");
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole("button", { name: "Conflicts", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Conflict Center" }),
  ).toBeVisible();
}

async function openSyncCard(page: Page): Promise<Locator> {
  const sidebar = page.locator(".sidebar-nav");
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  const syncCard = page
    .locator("section.settings-card")
    .filter({
      has: page.getByRole("heading", { name: "Sync" }),
    })
    .first();
  await expect(syncCard).toBeVisible();
  return syncCard;
}

async function expectConflictRemoved(
  page: Page,
  entityId: string,
): Promise<void> {
  await expect(
    page.locator(".conflict-center-item").filter({ hasText: entityId }),
  ).toHaveCount(0);
}

test.describe("Conflict resolve strategy matrix", () => {
  test("supports keep local, keep remote, and manual merge before sync success", async ({
    page,
  }) => {
    await page.goto("/?e2e=1");
    const [keepLocalConflict, keepRemoteConflict, manualMergeConflict] =
      await seedConflictsViaBridge(page, 3);

    await openConflictCenter(page);

    const keepLocalItem = page
      .locator(".conflict-center-item")
      .filter({ hasText: keepLocalConflict.entity_id })
      .first();
    await expect(keepLocalItem).toBeVisible();
    await keepLocalItem.getByRole("button", { name: "Keep Local" }).click();
    await expect(page.getByText("Conflict marked as resolved.")).toBeVisible();
    await expectConflictRemoved(page, keepLocalConflict.entity_id);

    const keepRemoteItem = page
      .locator(".conflict-center-item")
      .filter({ hasText: keepRemoteConflict.entity_id })
      .first();
    await expect(keepRemoteItem).toBeVisible();
    await keepRemoteItem.getByRole("button", { name: "Keep Remote" }).click();
    await expect(page.getByText("Conflict marked as resolved.")).toBeVisible();
    await expectConflictRemoved(page, keepRemoteConflict.entity_id);

    const manualMergeItem = page
      .locator(".conflict-center-item")
      .filter({ hasText: manualMergeConflict.entity_id })
      .first();
    await expect(manualMergeItem).toBeVisible();
    await manualMergeItem.getByRole("button", { name: "Manual Merge" }).click();

    const manualMergeEditor = page.locator(".manual-merge-editor");
    await expect(manualMergeEditor).toBeVisible();
    await manualMergeEditor.getByRole("button", { name: "Use Combined" }).click();
    await expect(manualMergeEditor.getByLabel("Merged content")).not.toHaveValue(
      "",
    );
    await manualMergeEditor.getByRole("button", { name: "Apply Merge" }).click();
    await expect(page.getByText("Conflict marked as resolved.")).toBeVisible();
    await expectConflictRemoved(page, manualMergeConflict.entity_id);

    await expect(page.locator(".conflict-center-item")).toHaveCount(0);
    await expect(page.getByText("No open conflicts")).toBeVisible();

    const openConflictIds = await page.evaluate(async () => {
      const bridge = window.__solostackE2E;
      if (!bridge) return [];
      return bridge.listOpenConflictIds();
    });
    expect(openConflictIds).toEqual([]);

    const syncCard = await openSyncCard(page);
    await expect(syncCard.locator(".sync-pill")).toContainText("Needs attention");
    await syncCard
      .getByRole("button", { name: /Sync now|Syncing\.\.\./u })
      .click();
    await expect(syncCard.locator(".sync-pill")).toContainText("Synced");
    await expect(
      syncCard.getByText("Conflicts resolved locally. Run Sync now to confirm."),
    ).toHaveCount(0);
  });
});
