import { describe, expect, it } from "vitest";

import {
  buildFinalPageContent,
  judgeSimpleFu,
  type FinalPageContent,
  type FuQuickState,
} from "./simpleFu";

const baseState = (overrides: Partial<FuQuickState>): FuQuickState => ({
  winType: "closedRon",
  kanType: "none",
  yaochuAnkoCount: "notAsked",
  smallFu: "notAsked",
  tripletCount: "notAsked",
  yaochuPonCount: "notAsked",
  ...overrides,
});

const finalContent = (state: FuQuickState): FinalPageContent => {
  const judgement = judgeSimpleFu(state);
  return buildFinalPageContent(state, judgement.result, judgement.routeId);
};

const allConditionItems = (content: FinalPageContent): string[] =>
  content.conditionBlocks.flatMap((block) => block.items);

describe("buildFinalPageContent", () => {
  it("case 1: shows only 30 fu content for non-closed ron no-heavy route", () => {
    const content = finalContent(
      baseState({
        winType: "openTsumo",
        yaochuAnkoCount: "none",
        tripletCount: "zeroOrOne",
      }),
    );

    expect(content.title).toBe("30符");
    expect(content.conditionBlocks).toHaveLength(0);
    expect(content.actions).toEqual(["viewScore", "editAnswers"]);
    expect(content.selectedSummary).toEqual([
      "あがり方：鳴きツモ",
      "槓：なし",
      "1・9・字牌の暗刻：なし",
      "刻子・ポン：0〜1つ",
    ]);
    expect(allConditionItems(content).join("\n")).not.toMatch(/槓がある場合|暗刻がある場合|刻子複数|詳細計算/);
  });

  it("case 2: shows only 40 fu content for closed ron no-heavy route", () => {
    const content = finalContent(
      baseState({
        winType: "closedRon",
        yaochuAnkoCount: "none",
        tripletCount: "zeroOrOne",
      }),
    );

    expect(content.title).toBe("40符");
    expect(content.conditionBlocks).toHaveLength(0);
    expect(content.actions).toEqual(["viewScore", "editAnswers"]);
  });

  it("case 3: shows explicit additional checks for one yaochu anko without small fu", () => {
    const content = finalContent(
      baseState({
        winType: "openTsumo",
        yaochuAnkoCount: "one",
        smallFu: "none",
      }),
    );

    expect(content.title).toBe("30符");
    expect(content.conditionBlocks).toEqual([
      {
        heading: "追加で見る条件",
        items: [
          "刻子・ポンが合計3個以上なら40符以上を確認",
          "1・9・字牌のポンがさらに1個以上あるなら40符以上を確認",
        ],
      },
    ]);
    expect(allConditionItems(content).join("\n")).not.toMatch(/他の刻子|役牌雀頭・悪形待ちがある場合/);
  });

  it("case 4: shows explicit upgrade checks for closed ron one yaochu anko without small fu", () => {
    const content = finalContent(
      baseState({
        winType: "closedRon",
        yaochuAnkoCount: "one",
        smallFu: "none",
      }),
    );

    expect(content.title).toBe("40符");
    expect(content.conditionBlocks).toEqual([
      {
        heading: "上がる条件",
        items: [
          "刻子・ポンが合計3個以上なら50符を確認",
          "1・9・字牌のポンがさらに1個以上あるなら50符を確認",
        ],
      },
    ]);
  });

  it("case 5: shows almost 50 fu with concrete detail condition for closed ron one yaochu anko with small fu", () => {
    const content = finalContent(
      baseState({
        winType: "closedRon",
        yaochuAnkoCount: "one",
        smallFu: "one",
      }),
    );

    expect(content.title).toBe("ほぼ50符");
    expect(content.conditionBlocks).toEqual([
      {
        heading: "このまま扱うなら",
        items: ["50符として点数を見る"],
      },
      {
        heading: "詳細計算へ進む条件",
        items: ["刻子・ポンが合計3個以上なら60符以上を確認"],
      },
    ]);
    expect(content.actions).toEqual(["viewScore", "openDetailedCalculator", "editAnswers"]);
  });

  it("case 6: shows concrete upgrade checks for open simple kan and open ron", () => {
    const content = finalContent(
      baseState({
        winType: "openRon",
        kanType: "openSimple",
      }),
    );

    expect(content.title).toBe("40符");
    expect(content.conditionBlocks).toEqual([
      {
        heading: "上がる条件",
        items: [
          "役牌雀頭と悪形待ちが両方あるなら50符を確認",
          "刻子・ポンが合計2個以上なら50符を確認",
          "1・9・字牌の暗刻が1つ以上あるなら50符を確認",
        ],
      },
    ]);
    expect(allConditionItems(content).join("\n")).not.toContain("槓がある場合");
  });

  it("case 7: shows almost 60 fu and concrete detail checks for closed yaochu kan", () => {
    const content = finalContent(
      baseState({
        winType: "openTsumo",
        kanType: "closedYaochu",
      }),
    );

    expect(content.title).toBe("ほぼ60符");
    expect(content.conditionBlocks).toEqual([
      {
        heading: "このまま扱うなら",
        items: ["60符として点数を見る"],
      },
      {
        heading: "詳細計算へ進む条件",
        items: [
          "役牌雀頭または悪形待ちがあるなら70符以上を確認",
          "刻子・ポンが合計2個以上なら70符以上を確認",
          "槓が2個以上あるなら詳細計算へ",
        ],
      },
    ]);
    expect(allConditionItems(content).join("\n")).not.toMatch(/1・9・字牌の暗槓がある場合|槓がある場合/);
  });

  it("uses boundary wording for open ron with open yaochu kan instead of restating denied conditions", () => {
    const content = finalContent(
      baseState({
        winType: "openRon",
        kanType: "openYaochu",
      }),
    );

    expect(content.title).toBe("ほぼ50符");
    expect(content.conditionBlocks).toContainEqual({
      heading: "境界条件",
      items: ["40符まで下げて見るなら、役牌雀頭・悪形待ちなし、刻子・ポン0〜1つを確認"],
    });
    expect(allConditionItems(content).join("\n")).not.toMatch(/鳴きロンで、|どちらもなく|他の刻子/);
  });

  it("does not show a lower-condition block when small fu was already denied in the closed ron one-yaochu-pon route", () => {
    const content = finalContent(
      baseState({
        winType: "closedRon",
        yaochuAnkoCount: "none",
        tripletCount: "two",
        yaochuPonCount: "one",
        smallFu: "none",
      }),
    );

    expect(content.title).toBe("40符");
    expect(content.conditionBlocks).toHaveLength(0);
    expect(content.actions).toEqual(["viewScore", "editAnswers"]);
  });
});
