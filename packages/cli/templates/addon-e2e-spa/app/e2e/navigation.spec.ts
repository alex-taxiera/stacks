import { expect, test } from "@playwright/test";

test("the home page links to the about page", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("__APP_TITLE__");

  await page.getByRole("link", { name: "Learn more" }).click();
  await expect(page).toHaveURL(/\/about$/);
  await expect(page.getByRole("heading", { level: 1, name: "About" })).toBeVisible();
});

test("every page is prerendered", async ({ request }) => {
  // The HTML has the page in it before any JavaScript runs. `vite preview` answers `/about` with
  // the root page, for the router to take, where hosts serve this file; ask for the file.
  const html = await (await request.get("/about/index.html")).text();
  expect(html).toContain(">About</h1>");
});
