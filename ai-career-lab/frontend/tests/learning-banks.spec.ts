import { expect, test } from "./fixtures";

test("a first-day learner can open an ML topic directly and follow the worked cases", async ({
  page,
}) => {
  await page.goto("/#lesson/classification");
  await expect(
    page.getByRole("heading", { name: "Classification", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".lesson-story")).toContainText(/parcel/i);
  await expect(page.locator(".lesson-steps li").first()).toBeVisible();
  await expect(page.locator(".lesson-terms dt").first()).toBeVisible();
  await expect(page.locator(".example-table tbody tr")).toHaveCount(4);
  await expect(page.locator("#real-decisions .case-reading")).toHaveCount(3);
  await page.goto("/#lesson/predicates");
  await expect(page.locator(".lesson-story")).toContainText("library");
  await expect(page.locator(".lesson-terms")).toContainText("yes-or-no");
});

test("all beginner questions count even at a low score, and the next level uses a new bank", async ({
  page,
}, info) => {
  await page.goto("/#interview/predicates");
  const skill = page.getByRole("combobox", {
    name: "Skill level",
    exact: true,
  });
  await expect(skill.locator("option")).toHaveText([
    "Beginner · 40 questions",
    "Intermediate · 30 questions",
    "Advanced · 25 questions",
  ]);
  await page.getByLabel("Practice set", { exact: true }).selectOption("0");
  await page.getByRole("button", { name: "Start assessment" }).click();
  const questions = page.locator(".question");
  await expect(questions).toHaveCount(40);
  const firstPrompt = await questions.first().locator("h3").first().innerText();
  for (const question of await questions.all()) {
    const option = question.locator('input[type="radio"]').first();
    if (await option.count()) await option.check();
    else if (await question.locator("textarea.answer").count())
      await question.locator("textarea.answer").fill("I need to review this.");
  }
  // Submit the starter's failing test results as a genuine attempted coding response.
  await page.getByRole("button", { name: "Submit tests" }).click();
  await expect(
    page.getByRole("heading", { name: /0 \/ 4 tests passed/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Submit assessment", exact: true })
    .click();
  await expect(page.locator(".score-number")).toBeVisible();
  const score = Number(
    (await page.locator(".score-number").innerText()).split("/")[0],
  );
  expect(score).toBeLessThan(80);
  await page
    .getByRole("link", { name: "Continue through the question bank" })
    .click();
  await expect(skill).toHaveValue("Intermediate");
  await skill.selectOption("Beginner");
  await expect(page.locator(".bank-coverage")).toContainText(
    "40 of 40 answered",
  );
  await page.reload();
  await expect(skill).toHaveValue("Intermediate");
  await page.getByRole("button", { name: "Start assessment" }).click();
  await expect(questions).toHaveCount(5);
  expect(await questions.first().locator("h3").first().innerText()).not.toEqual(
    firstPrompt,
  );
  await page.goto("/#lesson/predicates");
  await page.screenshot({ path: info.outputPath("predicates-lesson.png") });
});
