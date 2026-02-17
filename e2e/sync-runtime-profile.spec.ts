import { expect, test } from "@playwright/test";

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
      page.getByText("Background interval must be >= foreground interval."),
    ).toBeVisible();

    await expect(page.getByText("Sync Diagnostics (Session)")).toBeVisible();
    await expect(page.getByText(/Success rate:/)).toBeVisible();
  });
});
