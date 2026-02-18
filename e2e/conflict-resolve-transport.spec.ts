import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from "@playwright/test";

interface RecordedPushChange {
  entity_id: string;
  idempotency_key: string;
}

function readRouteJson(route: Route): Record<string, unknown> {
  const rawBody = route.request().postData();
  if (!rawBody) return {};

  try {
    const parsed = JSON.parse(rawBody) as unknown;
    if (typeof parsed === "object" && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Ignore parse errors and treat as empty payload.
  }

  return {};
}

function getRecordedPushChanges(
  payload: Record<string, unknown>,
): RecordedPushChange[] {
  const rawChanges = payload.changes;
  if (!Array.isArray(rawChanges)) return [];

  return rawChanges
    .map((change) => {
      if (typeof change !== "object" || change === null) return null;
      const entityId = (change as { entity_id?: unknown }).entity_id;
      const idempotencyKey = (change as { idempotency_key?: unknown })
        .idempotency_key;

      if (typeof entityId !== "string" || typeof idempotencyKey !== "string") {
        return null;
      }

      const normalizedEntityId = entityId.trim();
      const normalizedIdempotencyKey = idempotencyKey.trim();
      if (!normalizedEntityId || !normalizedIdempotencyKey) {
        return null;
      }

      return {
        entity_id: normalizedEntityId,
        idempotency_key: normalizedIdempotencyKey,
      };
    })
    .filter((change): change is RecordedPushChange => change !== null);
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

test.describe("Transport-backed conflict resolve flow", () => {
  test("resolves conflict and reaches synced status after replay", async ({
    page,
  }) => {
    const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    const conflictEntityId = `task-transport-conflict-${uniqueSuffix}`;
    const incomingIdempotencyKey = `incoming-transport-${uniqueSuffix}`;
    const recordedPushBatches: RecordedPushChange[][] = [];
    let pushCallCount = 0;
    let pullCallCount = 0;

    await page.route("**/e2e-sync/push", async (route) => {
      pushCallCount += 1;
      const payload = readRouteJson(route);
      const changes = getRecordedPushChanges(payload);
      recordedPushBatches.push(changes);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          accepted: changes.map((change) => change.idempotency_key),
          rejected: [],
          server_cursor: `cursor-push-${pushCallCount}`,
          server_time: new Date().toISOString(),
        }),
      });
    });

    await page.route("**/e2e-sync/pull", async (route) => {
      pullCallCount += 1;

      const replayChange = {
        entity_type: "TASK",
        entity_id: conflictEntityId,
        operation: "UPSERT",
        updated_at: "2026-02-17T03:00:00.000Z",
        updated_by_device: "device-remote",
        sync_version: 2,
        payload: {
          description: "Remote payload without title to trigger conflict.",
        },
        idempotency_key: incomingIdempotencyKey,
      };

      const changes = pullCallCount <= 2 ? [replayChange] : [];

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          server_cursor: `cursor-pull-${pullCallCount}`,
          server_time: new Date().toISOString(),
          has_more: false,
          changes,
        }),
      });
    });

    await page.goto("/?e2e=1&e2e_transport=1");
    const syncCard = await openSyncCard(page);
    const origin = new URL(page.url()).origin;

    await syncCard.getByLabel("Push URL").fill(`${origin}/e2e-sync/push`);
    await syncCard.getByLabel("Pull URL").fill(`${origin}/e2e-sync/pull`);
    await syncCard.getByRole("button", { name: "Save Endpoints" }).click();
    await expect(
      syncCard.getByText("Sync endpoints were saved."),
    ).toBeVisible();
    await syncCard
      .getByRole("button", { name: /Sync now|Syncing\.\.\./u })
      .click();

    const conflictItem = syncCard
      .locator(".sync-conflict-item")
      .filter({ hasText: conflictEntityId })
      .first();
    await expect(conflictItem).toBeVisible();
    await expect(syncCard.locator(".sync-pill")).toContainText(
      "Needs attention",
    );

    await conflictItem.getByRole("button", { name: "Keep Local" }).click();
    await expect(
      syncCard.getByText("Conflict marked as resolved."),
    ).toBeVisible();
    await expect(
      syncCard
        .locator(".sync-conflict-item")
        .filter({ hasText: conflictEntityId }),
    ).toHaveCount(0);
    await syncCard
      .getByRole("button", { name: /Sync now|Syncing\.\.\./u })
      .click();
    await expect(syncCard.locator(".sync-pill")).toContainText("Synced");

    await expect
      .poll(() => pullCallCount, {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(2);
    await expect
      .poll(() => pushCallCount, {
        timeout: 10_000,
      })
      .toBeGreaterThanOrEqual(1);

    const resolutionChangeExists = recordedPushBatches.some((changes) =>
      changes.some((change) =>
        change.entity_id.startsWith("local.sync.conflict_resolution."),
      ),
    );
    expect(resolutionChangeExists).toBe(true);
  });
});
