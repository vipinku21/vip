import { test as base, expect } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";

export { expect };
export async function login(request: APIRequestContext) {
  const { adminSetup } = await (await request.get("/api/auth/me")).json();
  const details = { email: "browser@example.test", password: "isolated browser test password" };
  const result = adminSetup
    ? await request.post("/api/auth/setup", { data: { ...details, setupToken: "only-for-the-disposable-browser-test-server" } })
    : await request.post("/api/auth/login", { data: details });
  expect(result.ok()).toBeTruthy();
}
export const test = base.extend<{ signedIn: void }>({
  signedIn: [async ({ context }, use) => {
    await login(context.request);
    await use();
  }, { auto: true }],
});
