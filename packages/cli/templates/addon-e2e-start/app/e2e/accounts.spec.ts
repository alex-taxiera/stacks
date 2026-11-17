import { expect, test, type Page } from "@playwright/test";

/**
 * Opens a page and waits for React to take over the server's HTML: what's typed into a form
 * before then is lost. The root layout sets `data-hydrated` on <html>.
 */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.locator("html[data-hydrated]").waitFor();
}

test("signing up asks to confirm the email address", async ({ page }) => {
  // A new address each run, so the test needs no clean database.
  const email = `e2e-${Date.now()}@example.com`;

  await open(page, "/");
  await page.getByRole("link", { name: "Create an account" }).click();
  await expect(page.getByRole("heading", { name: "Create an account" })).toBeVisible();

  await page.getByRole("textbox", { name: /^Name/ }).fill("Ada Lovelace");
  await page.getByRole("textbox", { name: /^Email/ }).fill(email);
  await page.getByRole("textbox", { name: /^Password/ }).fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect(page.getByText(email)).toBeVisible();
});

test("the account page sends visitors to sign in", async ({ page }) => {
  await open(page, "/account");
  await expect(page).toHaveURL(/\/login\?redirect=%2Faccount$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});

test("a wrong password is refused", async ({ page }) => {
  await open(page, "/login");
  await page.getByRole("textbox", { name: /^Email/ }).fill("nobody@example.com");
  await page.getByRole("textbox", { name: /^Password/ }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText(/invalid email or password/i)).toBeVisible();
});
