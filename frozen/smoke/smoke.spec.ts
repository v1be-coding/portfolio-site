import { expect, test } from "../helpers/fixtures.js";

test("the page loads in a real browser", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Emiliano Casi Jr" })).toBeVisible();
});

test("the API answers through the page", async ({ page }) => {
  await page.goto("/");

  // The Chat's textbox is enabled once /api/health succeeds (spec #2).
  await page.getByRole("button", { name: "Ask about Emiliano", exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Your question" })).toBeEnabled();
});

test("a write and a read reach the database", async ({ request }) => {
  const id = crypto.randomUUID();
  const note = { data: { text: "smoke test" } };

  // Twice, because any write may be retried (ADR-0003).
  expect((await request.put(`/api/notes/${id}`, note)).status()).toBe(200);
  expect((await request.put(`/api/notes/${id}`, note)).status()).toBe(200);

  const read = await request.get(`/api/notes/${id}`);

  expect(read.status()).toBe(200);
  expect(await read.json()).toEqual({ id, text: "smoke test" });
});
