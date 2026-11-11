import { test, expect, login } from "./fixtures";
import type { Page } from "@playwright/test";

async function editCode(page: Page, code: string) {
  const editor = page.locator(".monaco-editor .view-lines").first();
  await editor.click();
  await page.keyboard.press("Control+a");
  await page.keyboard.insertText(code);
}
test("Strings lesson to code, interview, revision and persisted progress", async ({
  page,
  browser,
}, testInfo) => {
  const problems: string[] = [];
  page.on("pageerror", (e) => problems.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Learning dashboard" }),
  ).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("dashboard.png") });
  await page
    .getByRole("link", { name: "Learning roadmap", exact: true })
    .click();
  await expect(
    page.getByText("Programming Fundamentals", { exact: true }),
  ).toBeVisible();
  await page
    .locator(".module > summary")
    .filter({ hasText: "Python" })
    .first()
    .click();
  await page
    .locator(".topic-row")
    .filter({ hasText: "Python Strings" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Python Strings", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".worked-example")).toHaveCount(10);
  await page.getByRole("link", { name: "Run example" }).first().click();
  await page.getByRole("button", { name: "Run code", exact: true }).click();
  await expect(page.locator('[aria-live="polite"] pre.output')).toHaveText(
    "P n\nyth nohtyP",
  );
  await page
    .getByLabel("Exercise or example", { exact: true })
    .selectOption("strings-reverse");
  await editCode(page, "def solve(value):\n    return value[::-1]");
  await page.getByRole("button", { name: "Submit tests" }).click();
  await expect(
    page.getByRole("heading", { name: "4 / 4 tests passed" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Submission history" }).click();
  await expect(page.locator(".history-row").first()).toContainText(
    "4/4 passed",
  );
  await page.goto("/#lesson/strings");
  await page.getByRole("button", { name: "Mark lesson completed" }).click();
  await page.getByRole("link", { name: "Take assessment" }).click();
  await page.getByLabel("Practice set", { exact: true }).selectOption("8");
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(page.locator(".question")).toHaveCount(5);
  await page
    .locator(".choices label")
    .filter({ hasText: '"It\'s ready"' })
    .click();
  await page.getByLabel("Answer question 2").fill("yth");
  await page.getByLabel("Answer question 3").fill("I am unsure");
  await page.getByLabel("Answer question 4").fill("I am unsure");
  await editCode(page, "def solve(value):\n    return value[::-1]");
  await page.getByRole("button", { name: "Submit tests" }).click();
  await expect(
    page.getByRole("heading", { name: "4 / 4 tests passed" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await expect(page.locator(".score-number")).toHaveText("60/100");
  await expect(
    page.getByRole("link", { name: "Revisit Immutability" }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Skill gap analyzer", exact: true })
    .click();
  await expect(
    page.locator(".compact-link").filter({ hasText: "Immutability" }),
  ).toContainText("0%");
  await page
    .locator(".compact-link")
    .filter({ hasText: "Immutability" })
    .click();
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(page.locator(".question")).toHaveCount(1);
  await page.close();
  const fresh = await browser.newContext({ baseURL: "http://127.0.0.1:8031" });
  await login(fresh.request);
  const reopened = await fresh.newPage();
  await reopened.goto("/#lesson/strings");
  await expect(reopened.getByLabel("Lesson status")).toHaveValue("Completed");
  await reopened.goto("/#interview/strings");
  await expect(reopened.getByRole("link", { name: /60\/100/ })).toBeVisible();
  await reopened.getByRole("button", { name: "Refresh questions" }).click();
  await expect(reopened.locator("[role=status].notice")).toContainText(
    "Online retrieval is off",
  );
  const state = await (await fresh.request.get("/api/state")).json();
  expect(state.progress.strings.status).toBe("Completed");
  expect(state.progress.strings.lastScore).toBe(60);
  expect(state.progress.strings.due).toBeTruthy();
  await fresh.close();
  expect(problems).toEqual([]);
});

test("SQL execution, worker cancellation, project checklist, theme and mobile navigation", async ({
  page,
}) => {
  await page.goto("/#playground/sql/example-0");
  await page.getByRole("button", { name: "Run code", exact: true }).click();
  await expect(page.locator('[aria-live="polite"] pre.output')).toContainText(
    "Ada",
  );
  await page.goto("/#playground/sql/sql-practice");
  await editCode(page, "SELECT name, salary FROM employees ORDER BY name;");
  await page.getByRole("button", { name: "Submit tests" }).click();
  await expect(
    page.getByRole("heading", { name: "3 / 3 tests passed" }),
  ).toBeVisible();
  await page.goto("/#playground/strings/example-0");
  await editCode(page, "while True:\n    pass");
  await page.getByRole("button", { name: "Run code", exact: true }).click();
  await expect(
    page.getByText("Running…", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop", exact: true }).click();
  await expect(page.locator(".error-output")).toContainText(
    "Execution stopped",
  );
  await page.getByRole("button", { name: "Reset code" }).click();
  await page.getByRole("button", { name: "Run code", exact: true }).click();
  await expect(page.locator('[aria-live="polite"] pre.output')).toContainText(
    "nohtyP",
  );
  await page.goto("/#projects/strings");
  await page.getByRole("checkbox").first().check();
  await expect(page.getByText("1 of 4 complete")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("checkbox").first()).toBeChecked();
  await page.goto("/#settings");
  await page
    .getByRole("combobox", { name: "Theme", exact: true })
    .selectOption("dark");
  await page.getByLabel("Daily study availability (minutes)").fill("75");
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("link", { name: "Dashboard", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Learning dashboard" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBeTruthy();
});
