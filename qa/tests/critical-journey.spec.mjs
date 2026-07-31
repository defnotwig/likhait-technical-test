import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const apiUrl = (process.env.QA_API_URL || "http://127.0.0.1:3100/api").replace(/\/+$/, "");

test.describe("combined assessment journey", () => {
  let consoleErrors;
  let pageErrors;
  let categoryRequests;

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    pageErrors = [];
    categoryRequests = 0;

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("request", (request) => {
      if (request.method() === "GET" && request.url().endsWith("/api/categories")) {
        categoryRequests += 1;
      }
    });
  });

  test.afterEach(async () => {
    expect(consoleErrors, "browser console errors").toEqual([]);
    expect(pageErrors, "uncaught page errors").toEqual([]);
  });

  test("creates a category, uses it, edits the expense, persists, and deletes it", async ({
    page,
  }, testInfo) => {
    const marker = `QA UI ${process.env.QA_SEED || "20260801"} ${testInfo.project.name}`;
    const navigationStarted = Date.now();
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Expense History" })).toBeVisible();
    expect(Date.now() - navigationStarted, "critical page load duration").toBeLessThan(2_000);
    expect(categoryRequests).toBe(1);

    const pageA11y = await new AxeBuilder({ page }).analyze();
    expect(
      pageA11y.violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
    ).toEqual([]);

    await page.getByRole("button", { name: "Add Category" }).click();
    const categoryDialog = page.getByRole("dialog", { name: "Add Category" });
    await expect(categoryDialog).toBeVisible();
    await categoryDialog.getByLabel("Category name").fill(marker);
    await categoryDialog.getByRole("button", { name: "Create Category" }).click();
    await expect(page.getByText(`Category ${marker} created.`)).toBeVisible();
    expect(categoryRequests).toBe(1);

    await page.getByRole("button", { name: "Add Expense" }).click();
    const expenseDialog = page.getByRole("dialog", { name: "Add New Expense" });
    await expenseDialog.getByLabel("Amount").fill("42.75");
    await expenseDialog.getByLabel("Description").fill(marker);
    await expenseDialog.getByLabel("Category").selectOption({ label: marker });
    await expenseDialog.getByRole("button", { name: "Add Expense" }).click();

    const row = page.getByRole("row").filter({ hasText: marker });
    await expect(row).toContainText(marker);
    await expect(row).toContainText("$42.75");

    await row.getByRole("button", { name: "Edit" }).click();
    const editDialog = page.getByRole("dialog", { name: "Edit Expense" });
    await editDialog.getByLabel("Category").selectOption({ label: "Food" });
    await editDialog.getByRole("button", { name: "Update Expense" }).click();
    await expect(row).toContainText("Food");

    await page.reload();
    const persistedRow = page.getByRole("row").filter({ hasText: marker });
    await expect(persistedRow).toContainText("Food");

    await persistedRow.getByRole("button", { name: "Delete" }).click();
    const deleteDialog = page.getByRole("dialog", { name: "Delete Expense" });
    await deleteDialog.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByRole("row").filter({ hasText: marker })).toHaveCount(0);
  });

  test("preserves input and reports a server-authoritative future-date rejection", async ({
    page,
    request,
  }) => {
    await page.goto("/");
    const categories = await request.get(`${apiUrl}/categories`);
    const food = (await categories.json()).find(({ name }) => name === "Food");
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const futureDate = tomorrow.toISOString().slice(0, 10);

    const response = await request.post(`${apiUrl}/expenses`, {
      data: {
        expense: {
          amount: 5,
          description: "QA future boundary",
          category_id: food.id,
          date: futureDate,
        },
      },
    });

    expect(response.status()).toBe(422);
    expect(await response.json()).toEqual({ errors: ["Date cannot be in the future"] });

    await page.getByRole("button", { name: "Add Expense" }).click();
    const dialog = page.getByRole("dialog", { name: "Add New Expense" });
    await dialog.getByLabel("Amount").fill("5");
    await dialog.getByLabel("Description").fill("Preserved values");
    await dialog.getByLabel("Category").selectOption({ label: "Food" });

    const dialogA11y = await new AxeBuilder({ page }).include('[role="dialog"]').analyze();
    expect(
      dialogA11y.violations.filter(({ impact }) => impact === "critical" || impact === "serious"),
    ).toEqual([]);
  });
});
