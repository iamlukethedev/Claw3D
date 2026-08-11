import { expect, test, type Page } from "@playwright/test";

async function blockNonMockTraffic(page: Page) {
  const forbidden: string[] = [];
  await page.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const isOwnOrigin = url.origin === "http://127.0.0.1:3210";
    const isPrivateRuntimeRoute = url.pathname.startsWith("/api/visual-runtime/");
    if (!isOwnOrigin || isPrivateRuntimeRoute) {
      forbidden.push(route.request().url());
      await route.abort("blockedbyclient");
      return;
    }
    await route.continue();
  });
  return forbidden;
}

test("mock office keeps the historical visual shell with zero private traffic", async ({ page }) => {
  const forbidden = await blockNonMockTraffic(page);
  const pageErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on("response", (response) => {
    if (response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.message);
  });
  await page.goto("/office");

  await expect(page.getByRole("region", { name: "Claw3D visual office" })).toBeVisible();
  await expect(page.getByText("JARVIS Headquarters", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Building Directory" })).toBeVisible();
  await expect(page.getByText("4 agents", { exact: true })).toBeVisible();
  await expect(page.getByText("demo • connected", { exact: true })).toHaveCount(1);

  await page.getByRole("button", { name: "Activity" }).click();
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(page.getByRole("button", { name: "multiple" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Erase browser preferences" })).toBeVisible();

  expect(forbidden).toEqual([]);
  expect(failedResponses).toEqual([]);
  expect(pageErrors).toEqual([]);
});

test("all deterministic mock scenarios remain selectable", async ({ page }) => {
  await blockNonMockTraffic(page);
  await page.goto("/office");
  await page.getByRole("button", { name: "Activity" }).click();

  for (const scenario of [
    "loading",
    "empty",
    "offline",
    "inactive",
    "active",
    "error",
    "multiple",
    "reconnect",
    "reset",
  ]) {
    const button = page.getByRole("button", { name: scenario, exact: true });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", { name: "Claw3D visual office" })).toBeVisible();
  }
});

test("keyboard navigation exposes real panels without mutation controls", async ({ page }) => {
  await blockNonMockTraffic(page);
  await page.goto("/office");
  await page.getByRole("button", { name: "Activity" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("complementary", { name: "Tasks and notifications" })).toBeVisible();
  await expect(page.getByText(/save|publish|create agent|delete agent/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Events" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText("Visual Event Console", { exact: true })).toBeVisible();
});

test("builder remains usable and contains no fake save or publish action", async ({ page }) => {
  await blockNonMockTraffic(page);
  await page.goto("/office/builder");
  await expect(page.getByRole("heading", { name: "builder controls" })).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByRole("button", { name: /save|publish/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Erase browser preferences" })).toBeVisible();
  await page.getByRole("button", { name: "Return to office" }).click();
  await expect(page).toHaveURL(/\/office$/);
});
