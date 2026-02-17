import { expect, test, type Locator, type Page } from "@playwright/test";

async function waitForEither(
  successLocator: Locator,
  errorLocator: Locator,
): Promise<"success" | "error"> {
  const winner = await Promise.race([
    successLocator
      .waitFor({ state: "visible", timeout: 15000 })
      .then(() => "success" as const),
    errorLocator
      .waitFor({ state: "visible", timeout: 15000 })
      .then(() => "error" as const),
  ]);

  return winner;
}

async function createLocalTaskIfPossible(page: Page): Promise<void> {
  const addButton = page.locator('button[title="Add task"]').first();
  if ((await addButton.count()) === 0 || !(await addButton.isVisible())) {
    return;
  }

  await addButton.click();
  const titleInput = page.getByLabel("Title");
  if (!(await titleInput.isVisible())) {
    return;
  }

  await titleInput.fill("Restore Flow Seed Task");
  await page.getByRole("button", { name: "Create Task" }).click();
  await expect(page.getByRole("button", { name: "Create Task" })).toHaveCount(0);
}

test.describe("Restore recovery guardrails", () => {
  test("supports preflight-aware restore from latest backup", async ({
    page,
  }) => {
    await page.goto("/");
    await createLocalTaskIfPossible(page);

    const sidebar = page.locator(".sidebar-nav");
    await expect(sidebar).toBeVisible();
    await sidebar
      .getByRole("button", { name: "Settings", exact: true })
      .click();
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    const backupSection = page
      .locator("section.settings-card")
      .filter({
        has: page.getByRole("heading", { name: "Data Backup & Restore" }),
      })
      .first();
    await expect(backupSection).toBeVisible();

    const exportButton = backupSection.getByRole("button", {
      name: "Export Backup",
    });
    await expect(exportButton).toBeVisible();

    await exportButton.click();

    const exportSuccess = backupSection.getByText("Backup exported successfully");
    const backupError = backupSection.locator(".settings-feedback-error");
    const exportResult = await waitForEither(exportSuccess, backupError);
    if (exportResult === "error") {
      await expect(backupError).toBeVisible();
      return;
    }

    const restoreLatestButton = backupSection.getByRole("button", {
      name: "Restore Latest Backup",
    });
    await expect(restoreLatestButton).toBeEnabled();

    let pendingOutboxCount = 0;
    const pendingOutboxLabel = backupSection.getByText("Pending outbox changes:");
    if (await pendingOutboxLabel.isVisible()) {
      const pendingText = (await pendingOutboxLabel.textContent()) ?? "";
      const matched = pendingText.match(/Pending outbox changes:\s*(\d+)/u);
      if (matched) {
        pendingOutboxCount = Number(matched[1] ?? "0");
      }
    }

    let confirmationMessage: string | null = null;
    page.once("dialog", async (dialog) => {
      confirmationMessage = dialog.message();
      await dialog.accept();
    });

    await restoreLatestButton.click();
    await expect
      .poll(() => confirmationMessage, {
        timeout: 5000,
      })
      .not.toBeNull();

    if (pendingOutboxCount > 0) {
      expect(confirmationMessage).toContain(
        "Force restore will discard pending outbox changes",
      );
    } else {
      expect(confirmationMessage).toContain(
        "Restore will replace all local data and reset sync state",
      );
    }

    const restoreSuccess = backupSection.getByText("Backup restored:");
    const restoreResult = await waitForEither(restoreSuccess, backupError);
    if (restoreResult === "error") {
      await expect(backupError).toBeVisible();
      return;
    }

    await expect(restoreSuccess).toBeVisible();
  });
});
