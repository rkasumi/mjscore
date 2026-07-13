import { expect, test } from "@playwright/test";

const emptyEnvelope = {
  version: 0,
  updatedAt: "2026-05-30T00:00:00.000Z",
  session: null,
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/sessions", async (route) => {
    await route.fulfill({ json: { sessions: [] } });
  });
  await page.route("**/api/session", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as { session?: unknown };
      await route.fulfill({
        json: {
          version: 1,
          updatedAt: "2026-05-30T00:01:00.000Z",
          session: body.session ?? null,
        },
      });
      return;
    }
    await route.fulfill({ json: emptyEnvelope });
  });
});

test("opens the stored result history", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "結果履歴" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("保存済みの卓はありません。")).toBeVisible();
});

test("starts a score session and opens the score table panel", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /麻雀スコア管理/ })).toBeVisible();
  await page.getByRole("button", { name: "卓管理" }).click();
  await page.getByRole("button", { name: "卓を開始" }).click();
  await expect(page.getByRole("textbox").first()).toHaveValue("プレイヤー1");
  await page.getByRole("button", { name: "閉じる" }).click();

  await page.getByRole("button", { name: "点数表" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "符計算" })).toBeVisible();
});

test("loads the simple fu page", async ({ page }) => {
  await page.goto("/fu");

  await expect(page.getByRole("heading", { name: "符ざっくり判定" })).toBeVisible();
  await expect(page.getByRole("button", { name: "面前ロン" })).toBeVisible();
});
