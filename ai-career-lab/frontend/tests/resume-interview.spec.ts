import { expect, test } from "./fixtures";

test("a learner can dictate, edit and continue a six-question résumé interview", async ({ page }) => {
  // Supply a device-independent speech service. Real microphones require a user gesture and permission.
  await page.addInitScript(() => {
    const questionsRead: string[] = [];
    Object.defineProperty(window, "interviewTestPlayback", { value: questionsRead });
    Object.defineProperty(window, "speechSynthesis", { configurable: true, value: {
      cancel() {},
      getVoices: () => [],
      speak(utterance: { text: string }) { questionsRead.push(utterance.text); },
    }});
    Object.defineProperty(window, "SpeechSynthesisUtterance", { configurable: true, value: class {
      constructor(public text: string) {}
    }});
    Object.defineProperty(window, "SpeechRecognition", { configurable: true, value: class {
      onresult?: (event: unknown) => void;
      onend?: () => void;
      start() {
        this.onresult?.({ resultIndex: 0, results: [{ isFinal: true, 0: { transcript: "I reduced missed cases by 12%." } }] });
      }
      stop() { this.onend?.(); }
      abort() { this.onend?.(); }
    }});
  });
  await page.goto("/#dashboard");
  await page.getByRole("link", { name: "Résumé interviewer", exact: true }).click();
  await expect(page).toHaveURL(/#resume-interview$/);
  await page.getByLabel("Target role").fill("Data analyst");
  await page.getByLabel("Résumé or selected project descriptions").fill(
    "Built a parcel classifier to identify damaged packages.\nTested parcel predictions with depot inspectors.",
  );
  await page.getByLabel("Enable spoken questions and dictation").check();
  await page.getByRole("button", { name: "Start résumé interview" }).click();
  const question = page.locator(".resume-question");
  await expect(question).toContainText("parcel classifier");
  const first = await question.innerText();
  await expect.poll(() => page.evaluate(
    () => (window as Window & { interviewTestPlayback?: string[] }).interviewTestPlayback,
  )).toContain(first);
  await page.getByRole("button", { name: "Dictate answer" }).click();
  const draft = page.getByLabel("Your answer", { exact: true });
  await expect(draft).toHaveValue("I reduced missed cases by 12%.");
  await page.getByRole("button", { name: "Stop dictation" }).click();
  await draft.fill("I reduced missed cases by 18%.");
  await page.getByRole("button", { name: "Send answer", exact: true }).click();
  await expect(question).toContainText("18%");
  await page.reload();
  await expect(question).toContainText("18%");
  for (const answer of [
    "I compared both groups of parcels.",
    "I tested crushed boxes separately.",
    "I built another check for new depots.",
    "I would compare the input data from each depot.",
  ]) {
    const priorQuestion = await question.innerText();
    await draft.fill(answer);
    await page.getByRole("button", { name: "Send answer", exact: true }).click();
    await expect(question).not.toHaveText(priorQuestion);
  }
  await draft.fill("I would measure the change in missed cases against the baseline.");
  await page.getByRole("button", { name: "Send answer and finish" }).click();
  await expect(page.getByRole("heading", { name: "Interview review", exact: true })).toBeVisible();
  await expect(page.getByText("6 answers submitted", { exact: false })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Personal contribution", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Clear saved interview" }).click();
  await page.getByRole("button", { name: "Delete interview" }).click();
  await expect(page.getByRole("heading", { name: "Prepare your interview", exact: true })).toBeVisible();
});
