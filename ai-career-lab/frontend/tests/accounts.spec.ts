import { randomUUID } from "node:crypto";
import { test, expect } from "./fixtures";

test("an invited learner can sign up and sign back in until the owner removes access", async ({
  page,
  browser,
}) => {
  const email = `pilot-${randomUUID()}@example.test`;
  const password = "an isolated learner test password";
  await page.goto("/#admin");
  await page.getByLabel("Learner email").fill(email);
  await page.getByRole("button", { name: "Create invitation" }).click();
  const link = await page
    .getByLabel("Invitation link", { exact: true })
    .inputValue();

  const learner = await browser.newContext({ baseURL: new URL(link).origin });
  try {
    const tab = await learner.newPage();
    await tab.goto(link);
    await expect(tab.getByLabel("Invitation code")).toHaveValue(/\S+/);
    await tab.getByLabel("Email address").fill(email);
    await tab.getByLabel(/^Password/).fill(password);
    await tab
      .getByRole("button", { name: "Create account", exact: true })
      .click();
    await expect(
      tab.getByRole("heading", { name: "Learning dashboard" }),
    ).toBeVisible();
    await expect(tab.getByRole("link", { name: "Pilot access" })).toHaveCount(
      0,
    );
    await tab.getByRole("button", { name: "Sign out" }).click();
    await tab.getByLabel("Email address").fill(email);
    await tab.getByLabel(/^Password/).fill(password);
    await tab.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(
      tab.getByRole("heading", { name: "Learning dashboard" }),
    ).toBeVisible();

    await page.reload();
    await page
      .locator(".account-list li")
      .filter({ hasText: email })
      .getByRole("button", { name: "Remove access" })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm removal" })
      .click();
    await expect(page.getByRole("status")).toContainText(
      `Access removed for ${email}`,
    );
    await tab.reload();
    await expect(tab.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await tab.getByLabel("Email address").fill(email);
    await tab.getByLabel(/^Password/).fill(password);
    await tab.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(tab.getByRole("alert")).toBeVisible();
    expect((await learner.request.get("/api/state")).status()).toBe(401);
  } finally {
    await learner.close();
  }
});
