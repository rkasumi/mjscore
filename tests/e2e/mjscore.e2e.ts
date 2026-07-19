import { expect, test } from "@playwright/test";

const emptyEnvelope = {
  version: 0,
  updatedAt: "2026-05-30T00:00:00.000Z",
  session: null,
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/analytics?*", async (route) => {
    await route.fulfill({
      json: {
        from: null,
        to: null,
        sessions: 0,
        hands: 0,
        players: [],
        headToHead: [],
        records: [],
      },
    });
  });
  await page.route("**/api/seasons", async (route) => {
    await route.fulfill({ json: { seasons: [] } });
  });
  await page.route("**/api/players", async (route) => {
    await route.fulfill({ json: { players: [] } });
  });
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

test("opens the historical analytics dashboard", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "成績分析" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("対象: 0卓・0半荘（確定済みのみ）")).toBeVisible();
});

test("starts a score session and opens the score table panel", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: /麻雀スコア管理/ })).toBeVisible();
  await page.getByRole("button", { name: "卓管理" }).click();
  await page.getByRole("button", { name: "卓を開始" }).click();
  await expect(
    page.getByRole("combobox", { name: "プレイヤー1の参加者" }),
  ).toHaveValue("プレイヤー1");
  await expect(page.getByRole("button", { name: "現在の卓を確定", exact: true })).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "現在の卓を確定して新規卓" }),
  ).toBeDisabled();
  await expect(page.getByText("卓の確定には半荘が1回以上必要です。")).toBeVisible();
  await page.getByRole("button", { name: "閉じる" }).click();

  await page.getByRole("button", { name: "点数表" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("button", { name: "符計算" })).toBeVisible();
});

test("switches display mode between first and rank-up conditions", async ({ page }) => {
  const session = {
    id: "display-session",
    createdAt: "2026-07-19T00:00:00.000Z",
    players: ["a", "b", "c", "d"].map((id) => ({
      id,
      name: id.toUpperCase(),
    })),
    hands: [0, 1].map((index) => ({
      id: `display-hand-${index}`,
      createdAt: `2026-07-19T0${index + 1}:00:00.000Z`,
      seats: [
        { playerId: "a", score: 60000 },
        { playerId: "b", score: 20000 },
        { playerId: "c", score: 15000 },
        { playerId: "d", score: 5000 },
      ],
    })),
  };
  await page.unroute("**/api/session");
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      json: {
        version: 1,
        updatedAt: "2026-07-19T00:00:01.000Z",
        session,
      },
    });
  });

  await page.goto("/?display=1");

  await expect(page.getByRole("heading", { name: "逆転条件" })).toBeVisible();
  const firstTab = page.getByRole("tab", { name: "1位条件" });
  const rankUpTab = page.getByRole("tab", { name: "着順アップ条件" });
  await expect(firstTab).toHaveAttribute("aria-selected", "true");
  for (const playerName of ["A", "B", "C", "D"]) {
    await expect(page.getByLabel(`${playerName}の逆転条件`)).toBeVisible();
  }
  await expect(page.getByText("総合1位キープ")).toBeVisible();
  const secondPlaceCard = page.getByLabel("Bの逆転条件");
  await expect(secondPlaceCard).toContainText("首位条件（参考）");
  await expect(secondPlaceCard).toContainText("Aとトップラス");
  await expect(secondPlaceCard).toContainText("80,000点差");

  await rankUpTab.click();

  await expect(rankUpTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByLabel("Aの逆転条件")).toContainText("現在トップです");
  await expect(page.getByLabel("Dの逆転条件")).toContainText("総合3位へ");
});

test("reuses a known player identity when replacing a roster slot", async ({ page }) => {
  const recentPlayers = [
    { id: "yagi", name: "やぎ" },
    { id: "aki", name: "あき" },
    { id: "kasumi", name: "かすみ" },
    { id: "dobashi", name: "どばし" },
  ];
  const knownPlayers = [
    ...recentPlayers,
    { id: "kei", name: "けい" },
    { id: "kurumi", name: "くるみ" },
  ];
  let version = 0;
  let savedSession: { players: Array<{ id: string; name: string }> } | null = null;

  await page.unroute("**/api/players");
  await page.route("**/api/players", async (route) => {
    await route.fulfill({ json: { players: recentPlayers, knownPlayers } });
  });
  await page.unroute("**/api/session");
  await page.route("**/api/session", async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON() as {
        session: { players: Array<{ id: string; name: string }> };
      };
      savedSession = body.session;
      version += 1;
      await route.fulfill({
        json: {
          version,
          updatedAt: `2026-07-18T00:00:0${version}.000Z`,
          session: body.session,
        },
      });
      return;
    }
    await route.fulfill({ json: emptyEnvelope });
  });

  await page.goto("/");
  await page.getByRole("button", { name: "卓管理" }).click();
  await page.getByRole("button", { name: "卓を開始" }).click();

  const kasumiInput = page.getByRole("combobox", { name: "かすみの参加者" });
  await kasumiInput.fill("けい");
  await kasumiInput.press("Enter");

  await expect.poll(() => savedSession?.players[2]).toEqual({ id: "kei", name: "けい" });
  expect(savedSession?.players).not.toContainEqual({ id: "kasumi", name: "けい" });
});

test("creates a privacy-filtered result image for X", async ({ context, page }) => {
  const session = {
    id: "share-session",
    createdAt: "2026-07-18T00:00:00.000Z",
    day: "2026-07-18",
    label: "夜卓",
    players: [
      { id: "a", name: "Alice" },
      { id: "b", name: "Bob" },
      { id: "c", name: "Carol" },
      { id: "d", name: "Dave" },
    ],
    hands: [
      {
        id: "hand-1",
        createdAt: "2026-07-18T01:00:00.000Z",
        seats: [
          { playerId: "a", score: 40000 },
          { playerId: "b", score: 30000 },
          { playerId: "c", score: 20000 },
          { playerId: "d", score: 10000 },
        ],
      },
    ],
  };
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.unroute("**/api/session");
  await page.route("**/api/session", async (route) => {
    await route.fulfill({
      json: {
        version: 1,
        updatedAt: "2026-07-18T01:01:00.000Z",
        session,
      },
    });
  });

  await page.goto("/");
  await expect(page.getByText("2026-07-18")).toBeVisible();
  await page.getByRole("button", { name: "卓管理" }).click();
  await page.getByRole("button", { name: "投稿用画像を作成" }).click();

  const imageDialog = page.getByRole("dialog", { name: "投稿用結果画像" });
  await expect(imageDialog).toBeVisible();
  const canvas = imageDialog.getByLabel("投稿用結果画像のプレビュー");
  await expect(canvas).toHaveAttribute("width", "1440");
  await expect(canvas).toHaveAttribute("height", "1800");

  await imageDialog.getByRole("checkbox", { name: "Bobの名前を表示" }).uncheck();
  await imageDialog.getByRole("button", { name: "投稿文をコピー" }).click();
  const postText = await page.evaluate(() => navigator.clipboard.readText());
  expect(postText).toContain("2位 匿名B +10.0pt");
  expect(postText).not.toContain("Bob");

  const downloadPromise = page.waitForEvent("download");
  await imageDialog.getByRole("button", { name: "PNGをダウンロード" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe("mjscore-2026-07-18-夜卓.png");

  await page.keyboard.press("Escape");
  await expect(imageDialog).toBeHidden();
  await expect(page.getByRole("button", { name: "投稿用画像を作成" })).toBeVisible();
});

test("loads the simple fu page", async ({ page }) => {
  await page.goto("/fu");

  await expect(page.getByRole("heading", { name: "符ざっくり判定" })).toBeVisible();
  await expect(page.getByRole("button", { name: "面前ロン" })).toBeVisible();
});
