import { expect, test, type Page } from "@playwright/test";

interface WorkspaceViewExpectation {
  label: string;
  selectors: string[];
}

const WORKSPACE_VIEWS: WorkspaceViewExpectation[] = [
  {
    label: "Board",
    selectors: ['h1.board-title:has-text("Board")', 'text=Failed to load tasks'],
  },
  {
    label: "Projects",
    selectors: [
      'h1.project-view-title:has-text("Projects")',
      'h2:has-text("No projects yet")',
      ".project-view-state",
    ],
  },
  {
    label: "Calendar",
    selectors: [
      'h1.calendar-title:has-text("Calendar")',
      'text=Failed to load calendar',
    ],
  },
  {
    label: "Today",
    selectors: [
      'h1.schedule-title:has-text("Today")',
      'text=Failed to load tasks',
    ],
  },
  {
    label: "Upcoming",
    selectors: [
      'h1.schedule-title:has-text("Upcoming")',
      'text=Failed to load tasks',
    ],
  },
  {
    label: "Weekly Review",
    selectors: [
      'h1.weekly-review-title:has-text("Weekly Review")',
      'h2.weekly-review-error-title:has-text("Failed to load weekly review")',
      ".weekly-review-loading",
    ],
  },
  {
    label: "Dashboard",
    selectors: [
      'h1.dashboard-title:has-text("Dashboard")',
      'text=Failed to load dashboard',
      ".dashboard-loading",
    ],
  },
  {
    label: "Settings",
    selectors: ['h1.settings-title:has-text("Settings")'],
  },
];

async function isVisible(page: Page, selector: string): Promise<boolean> {
  const target = page.locator(selector).first();
  const matches = await target.count();
  if (matches === 0) {
    return false;
  }
  return target.isVisible();
}

async function expectAnySelectorVisible(
  page: Page,
  selectors: string[],
): Promise<void> {
  await expect
    .poll(
      async () => {
        for (const selector of selectors) {
          if (await isVisible(page, selector)) {
            return selector;
          }
        }
        return null;
      },
      {
        message: `Expected one visible selector from: ${selectors.join(", ")}`,
      },
    )
    .not.toBeNull();
}

test.describe("Workspace pages", () => {
  test("navigates to every sidebar page", async ({ page }) => {
    await page.goto("/");
    const sidebar = page.locator(".sidebar-nav");
    await expect(sidebar).toBeVisible();

    const supportButton = page.getByRole("button", {
      name: /support me on ko-fi/i,
    });

    for (const view of WORKSPACE_VIEWS) {
      const navButton = sidebar.getByRole("button", {
        name: view.label,
        exact: true,
      });

      await navButton.click();
      await expect(navButton).toHaveClass(/active/);
      await expectAnySelectorVisible(page, view.selectors);
      await expect(supportButton).toBeVisible();
    }
  });
});
