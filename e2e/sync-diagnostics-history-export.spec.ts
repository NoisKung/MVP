import { readFile } from "node:fs/promises";
import { expect, test, type Locator, type Page } from "@playwright/test";

interface DiagnosticsHistoryExportPayload {
  report_type: string;
  filters: {
    source_filter: string;
    query: string;
    date_from: string | null;
    date_to: string | null;
    limit: number;
    date_range_invalid: boolean;
  };
  total_filtered: number;
  total_exported: number;
  items: Array<{
    captured_at: string;
  }>;
}

async function openSettings(page: Page): Promise<Locator> {
  const sidebar = page.locator(".sidebar-nav");
  await expect(sidebar).toBeVisible();
  await sidebar.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

  const syncSection = page
    .locator("section.settings-card")
    .filter({
      has: page.getByRole("heading", { name: "Sync" }),
    })
    .first();
  await expect(syncSection).toBeVisible();
  return syncSection;
}

async function ensureDiagnosticsHistoryExpanded(
  syncSection: Locator,
): Promise<void> {
  const viewFullHistoryButton = syncSection.getByRole("button", {
    name: "View Full History",
  });
  if (await viewFullHistoryButton.isVisible()) {
    await viewFullHistoryButton.click();
    return;
  }

  await expect(
    syncSection.getByRole("button", { name: "Hide Full History" }),
  ).toBeVisible();
}

test.describe("Sync diagnostics history export", () => {
  test("exports filtered diagnostics JSON with expected metadata", async ({
    page,
  }) => {
    await page.goto("/");
    let syncSection = await openSettings(page);
    await expect(
      syncSection.getByText("Sync Diagnostics (Session)"),
    ).toBeVisible();

    await ensureDiagnosticsHistoryExpanded(syncSection);

    let fullHistoryItems = syncSection.locator(
      ".sync-diagnostics-history-full-list .sync-diagnostics-history-item",
    );

    await expect
      .poll(() => fullHistoryItems.count(), {
        timeout: 10_000,
      })
      .toBeGreaterThan(0);

    const exportButton = syncSection.getByRole("button", {
      name: "Export Filtered JSON",
    });
    await expect(exportButton).toBeEnabled();

    const dateFromInput = syncSection.getByLabel("From Date");
    const dateToInput = syncSection.getByLabel("To Date");
    await dateFromInput.fill("2026-02-22");
    await dateToInput.fill("2026-02-20");
    await expect(
      syncSection.getByText(
        "From Date must be earlier than or equal to To Date.",
      ),
    ).toBeVisible();
    await expect(exportButton).toBeDisabled();

    await syncSection.getByRole("button", { name: "Clear Filters" }).click();
    await expect(exportButton).toBeEnabled();

    const downloadPromise = page.waitForEvent("download");
    await exportButton.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(
      /^solostack-sync-diagnostics-.*\.json$/u,
    );

    const downloadPath = await download.path();
    expect(downloadPath).not.toBeNull();
    const content = await readFile(downloadPath as string, "utf8");
    const payload = JSON.parse(content) as DiagnosticsHistoryExportPayload;

    expect(payload.report_type).toBe("sync_diagnostics_history");
    expect(payload.filters.source_filter).toBe("all");
    expect(payload.filters.query).toBe("");
    expect(payload.filters.limit).toBe(30);
    expect(payload.filters.date_from).toBeNull();
    expect(payload.filters.date_to).toBeNull();
    expect(payload.filters.date_range_invalid).toBe(false);
    expect(payload.total_filtered).toBeGreaterThan(0);
    expect(payload.total_exported).toBeGreaterThan(0);
    expect(payload.items.length).toBe(payload.total_exported);
  });
});
