import { expect, test } from "@playwright/test";
import { stubStudioRoute } from "./helpers/studioRoute";

test.skip(
  process.env.CLAW3D_E2E_GATEWAY !== "1",
  "Requires a reachable gateway-backed office shell."
);

test.beforeEach(async ({ page }) => {
  await stubStudioRoute(page);
});

test("creates and edits a kanban card from HQ", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Open headquarters sidebar" }).click();
  await page.getByRole("tab", { name: "Kanban" }).click();
  await page.getByRole("button", { name: "New Task" }).click();

  const titleInput = page.getByLabel("Title");
  await expect(titleInput).toHaveValue("New task");
  await titleInput.fill("Create marketing website");
  await page.getByLabel("Description").fill("Landing page for the spring campaign.");
  await page.getByLabel("Status").selectOption("in_progress");

  await expect(page.getByText("Create marketing website")).toBeVisible();
  await expect(titleInput).toHaveValue("Create marketing website");
});

test("persists kanban cards to studio settings", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Open headquarters sidebar" }).click();
  await page.getByRole("tab", { name: "Kanban" }).click();
  await page.getByRole("button", { name: "New Task" }).click();
  await page.getByLabel("Title").fill("Persistent task card");

  const request = await page.waitForRequest((req) => {
    if (!req.url().includes("/api/studio") || req.method() !== "PUT") {
      return false;
    }
    const payload = JSON.parse(req.postData() ?? "{}") as {
      taskBoard?: Record<string, { cards?: Array<{ title?: string }> }>;
    };
    const entries = Object.values(payload.taskBoard ?? {});
    return entries.some((entry) =>
      (entry.cards ?? []).some((card) => card.title === "Persistent task card")
    );
  });

  const payload = JSON.parse(request.postData() ?? "{}") as {
    taskBoard?: Record<string, { cards?: Array<{ title?: string }> }>;
  };
  expect(
    Object.values(payload.taskBoard ?? {}).some((entry) =>
      (entry.cards ?? []).some((card) => card.title === "Persistent task card")
    )
  ).toBe(true);
});
