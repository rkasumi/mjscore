export type WinType = "closedRon" | "closedTsumo" | "openRon" | "openTsumo";

export type KanType =
  | "none"
  | "openSimple"
  | "openYaochu"
  | "closedSimple"
  | "closedYaochu"
  | "unknownClosedKan";

export type YaochuAnkoCount = "notAsked" | "none" | "one" | "twoOrMore";
export type SmallFu = "notAsked" | "none" | "one" | "both";
export type TripletCount = "notAsked" | "zeroOrOne" | "two" | "threeOrMore";
export type YaochuPonCount = "notAsked" | "none" | "one" | "two";

export type FuQuickState = {
  winType: WinType | null;
  kanType: KanType | null;
  yaochuAnkoCount: YaochuAnkoCount;
  smallFu: SmallFu;
  tripletCount: TripletCount;
  yaochuPonCount: YaochuPonCount;
};

export type ResultCategory =
  | "RESULT_30"
  | "RESULT_40"
  | "RESULT_ALMOST_50"
  | "RESULT_ALMOST_60"
  | "RESULT_DETAIL";

export type FinalRouteId =
  | "A_NON_CLOSED_NO_HEAVY"
  | "B_CLOSED_NO_HEAVY"
  | "C_NON_CLOSED_YAOCHU_ANKO_ONE_NO_SMALL"
  | "D_NON_CLOSED_YAOCHU_ANKO_ONE_SMALL"
  | "E_CLOSED_YAOCHU_ANKO_ONE_NO_SMALL"
  | "F_CLOSED_YAOCHU_ANKO_ONE_SMALL"
  | "G_NON_CLOSED_YAOCHU_ANKO_TWO_PLUS"
  | "H_CLOSED_YAOCHU_ANKO_TWO_PLUS"
  | "I_OPEN_SIMPLE_KAN_NON_CLOSED"
  | "J_OPEN_SIMPLE_KAN_CLOSED"
  | "K_OPEN_YAOCHU_KAN_NON_CLOSED"
  | "L_OPEN_YAOCHU_KAN_CLOSED"
  | "M_CLOSED_SIMPLE_KAN"
  | "N_CLOSED_YAOCHU_KAN"
  | "O_NON_CLOSED_TWO_TRIPLETS_NO_YAOCHU_PON"
  | "P_CLOSED_TWO_TRIPLETS_NO_YAOCHU_PON"
  | "Q_NON_CLOSED_TWO_TRIPLETS_ONE_YAOCHU_PON_NO_SMALL"
  | "R_CLOSED_TWO_TRIPLETS_ONE_YAOCHU_PON_SMALL"
  | "S_CLOSED_TWO_TRIPLETS_ONE_YAOCHU_PON_NO_SMALL"
  | "T_NON_CLOSED_TWO_TRIPLETS_ONE_YAOCHU_PON_SMALL"
  | "U_TWO_TRIPLETS_TWO_YAOCHU_PON"
  | "V_THREE_OR_MORE_TRIPLETS"
  | "DETAIL_INCOMPLETE";

export type FuQuickJudgement = {
  result: ResultCategory;
  routeId: FinalRouteId;
};

export type FinalConditionBlock = {
  heading:
    | "このまま扱うなら"
    | "上がる条件"
    | "下がる条件"
    | "詳細計算へ進む条件"
    | "境界条件"
    | "追加で見る条件"
    | "この条件なら確定";
  items: string[];
};

export type FinalAction = "viewScore" | "openDetailedCalculator" | "editAnswers";

export type FinalPageContent = {
  result: ResultCategory;
  title: string;
  selectedSummary: string[];
  conditionBlocks: FinalConditionBlock[];
  actions: FinalAction[];
};

const titleByResult: Record<ResultCategory, string> = {
  RESULT_30: "30符",
  RESULT_40: "40符",
  RESULT_ALMOST_50: "ほぼ50符",
  RESULT_ALMOST_60: "ほぼ60符",
  RESULT_DETAIL: "詳細確認",
};

const winTypeLabel: Record<WinType, string> = {
  closedRon: "面前ロン",
  closedTsumo: "面前ツモ",
  openRon: "鳴きロン",
  openTsumo: "鳴きツモ",
};

const kanTypeLabel: Record<KanType, string> = {
  none: "なし",
  openSimple: "中張牌の明槓",
  openYaochu: "1・9・字牌の明槓",
  closedSimple: "中張牌の暗槓",
  closedYaochu: "1・9・字牌の暗槓",
  unknownClosedKan: "暗槓",
};

const yaochuAnkoLabel: Record<YaochuAnkoCount, string> = {
  notAsked: "",
  none: "なし",
  one: "1つ",
  twoOrMore: "2つ以上",
};

const smallFuLabel: Record<SmallFu, string> = {
  notAsked: "",
  none: "なし",
  one: "どちらか1つ",
  both: "両方",
};

const tripletLabel: Record<TripletCount, string> = {
  notAsked: "",
  zeroOrOne: "0〜1つ",
  two: "2つ",
  threeOrMore: "3つ以上",
};

const yaochuPonLabel: Record<YaochuPonCount, string> = {
  notAsked: "",
  none: "なし",
  one: "1つ",
  two: "2つ",
};

const isClosedRon = (state: FuQuickState): boolean => state.winType === "closedRon";

export const judgeSimpleFu = (state: FuQuickState): FuQuickJudgement => {
  if (!state.winType || !state.kanType) {
    return { result: "RESULT_DETAIL", routeId: "DETAIL_INCOMPLETE" };
  }

  if (state.kanType === "openSimple") {
    return isClosedRon(state)
      ? { result: "RESULT_ALMOST_50", routeId: "J_OPEN_SIMPLE_KAN_CLOSED" }
      : { result: "RESULT_40", routeId: "I_OPEN_SIMPLE_KAN_NON_CLOSED" };
  }

  if (state.kanType === "openYaochu") {
    return isClosedRon(state)
      ? { result: "RESULT_ALMOST_60", routeId: "L_OPEN_YAOCHU_KAN_CLOSED" }
      : { result: "RESULT_ALMOST_50", routeId: "K_OPEN_YAOCHU_KAN_NON_CLOSED" };
  }

  if (state.kanType === "closedSimple") {
    return { result: "RESULT_ALMOST_50", routeId: "M_CLOSED_SIMPLE_KAN" };
  }

  if (state.kanType === "closedYaochu") {
    return { result: "RESULT_ALMOST_60", routeId: "N_CLOSED_YAOCHU_KAN" };
  }

  if (state.kanType === "unknownClosedKan") {
    return { result: "RESULT_DETAIL", routeId: "DETAIL_INCOMPLETE" };
  }

  if (state.yaochuAnkoCount === "notAsked") {
    return { result: "RESULT_DETAIL", routeId: "DETAIL_INCOMPLETE" };
  }

  if (state.yaochuAnkoCount === "twoOrMore") {
    return isClosedRon(state)
      ? { result: "RESULT_ALMOST_60", routeId: "H_CLOSED_YAOCHU_ANKO_TWO_PLUS" }
      : { result: "RESULT_ALMOST_50", routeId: "G_NON_CLOSED_YAOCHU_ANKO_TWO_PLUS" };
  }

  if (state.yaochuAnkoCount === "one") {
    if (state.smallFu === "notAsked") {
      return { result: "RESULT_DETAIL", routeId: "DETAIL_INCOMPLETE" };
    }
    if (state.smallFu === "none") {
      return isClosedRon(state)
        ? { result: "RESULT_40", routeId: "E_CLOSED_YAOCHU_ANKO_ONE_NO_SMALL" }
        : { result: "RESULT_30", routeId: "C_NON_CLOSED_YAOCHU_ANKO_ONE_NO_SMALL" };
    }
    return isClosedRon(state)
      ? { result: "RESULT_ALMOST_50", routeId: "F_CLOSED_YAOCHU_ANKO_ONE_SMALL" }
      : { result: "RESULT_40", routeId: "D_NON_CLOSED_YAOCHU_ANKO_ONE_SMALL" };
  }

  if (state.tripletCount === "notAsked") {
    return { result: "RESULT_DETAIL", routeId: "DETAIL_INCOMPLETE" };
  }

  if (state.tripletCount === "zeroOrOne") {
    return isClosedRon(state)
      ? { result: "RESULT_40", routeId: "B_CLOSED_NO_HEAVY" }
      : { result: "RESULT_30", routeId: "A_NON_CLOSED_NO_HEAVY" };
  }

  if (state.tripletCount === "threeOrMore") {
    return { result: "RESULT_ALMOST_50", routeId: "V_THREE_OR_MORE_TRIPLETS" };
  }

  if (state.yaochuPonCount === "notAsked") {
    return { result: "RESULT_DETAIL", routeId: "DETAIL_INCOMPLETE" };
  }

  if (state.yaochuPonCount === "none") {
    return isClosedRon(state)
      ? { result: "RESULT_40", routeId: "P_CLOSED_TWO_TRIPLETS_NO_YAOCHU_PON" }
      : { result: "RESULT_30", routeId: "O_NON_CLOSED_TWO_TRIPLETS_NO_YAOCHU_PON" };
  }

  if (state.yaochuPonCount === "two") {
    return isClosedRon(state)
      ? { result: "RESULT_ALMOST_50", routeId: "U_TWO_TRIPLETS_TWO_YAOCHU_PON" }
      : { result: "RESULT_40", routeId: "U_TWO_TRIPLETS_TWO_YAOCHU_PON" };
  }

  if (state.smallFu === "notAsked") {
    return { result: "RESULT_DETAIL", routeId: "DETAIL_INCOMPLETE" };
  }

  if (state.smallFu === "none") {
    return isClosedRon(state)
      ? { result: "RESULT_40", routeId: "S_CLOSED_TWO_TRIPLETS_ONE_YAOCHU_PON_NO_SMALL" }
      : { result: "RESULT_30", routeId: "Q_NON_CLOSED_TWO_TRIPLETS_ONE_YAOCHU_PON_NO_SMALL" };
  }

  return isClosedRon(state)
    ? { result: "RESULT_ALMOST_50", routeId: "R_CLOSED_TWO_TRIPLETS_ONE_YAOCHU_PON_SMALL" }
    : { result: "RESULT_40", routeId: "T_NON_CLOSED_TWO_TRIPLETS_ONE_YAOCHU_PON_SMALL" };
};

const selectedSummary = (state: FuQuickState): string[] => {
  const summary: string[] = [];

  if (state.winType) {
    summary.push(`あがり方：${winTypeLabel[state.winType]}`);
  }
  if (state.kanType) {
    summary.push(`槓：${kanTypeLabel[state.kanType]}`);
  }
  if (state.kanType === "none" && state.yaochuAnkoCount !== "notAsked") {
    summary.push(`1・9・字牌の暗刻：${yaochuAnkoLabel[state.yaochuAnkoCount]}`);
  }
  if (state.smallFu !== "notAsked") {
    summary.push(`役牌雀頭・悪形待ち：${smallFuLabel[state.smallFu]}`);
  }
  if (state.tripletCount !== "notAsked") {
    summary.push(`刻子・ポン：${tripletLabel[state.tripletCount]}`);
  }
  if (state.yaochuPonCount !== "notAsked") {
    summary.push(`1・9・字牌のポン：${yaochuPonLabel[state.yaochuPonCount]}`);
  }

  return summary;
};

const block = (
  heading: FinalConditionBlock["heading"],
  items: string[],
): FinalConditionBlock => ({ heading, items });

const actions = (...items: FinalAction[]): FinalAction[] => items;

export const buildFinalPageContent = (
  state: FuQuickState,
  result: ResultCategory,
  routeId: FinalRouteId,
): FinalPageContent => {
  const conditionBlocks: FinalConditionBlock[] = [];
  let finalActions: FinalAction[] = actions("viewScore", "editAnswers");

  switch (routeId) {
    case "A_NON_CLOSED_NO_HEAVY":
    case "B_CLOSED_NO_HEAVY":
    case "Q_NON_CLOSED_TWO_TRIPLETS_ONE_YAOCHU_PON_NO_SMALL":
      break;

    case "C_NON_CLOSED_YAOCHU_ANKO_ONE_NO_SMALL":
      conditionBlocks.push(
        block("追加で見る条件", [
          "刻子・ポンが合計3個以上なら40符以上を確認",
          "1・9・字牌のポンがさらに1個以上あるなら40符以上を確認",
        ]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;

    case "D_NON_CLOSED_YAOCHU_ANKO_ONE_SMALL":
      conditionBlocks.push(
        block("上がる条件", [
          "刻子・ポンが合計3個以上なら50符を確認",
          "1・9・字牌のポンがさらに1個以上あるなら50符を確認",
        ]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;

    case "E_CLOSED_YAOCHU_ANKO_ONE_NO_SMALL":
      conditionBlocks.push(
        block("上がる条件", [
          "刻子・ポンが合計3個以上なら50符を確認",
          "1・9・字牌のポンがさらに1個以上あるなら50符を確認",
        ]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;

    case "F_CLOSED_YAOCHU_ANKO_ONE_SMALL":
      conditionBlocks.push(
        block("このまま扱うなら", ["50符として点数を見る"]),
        block("詳細計算へ進む条件", ["刻子・ポンが合計3個以上なら60符以上を確認"]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;

    case "G_NON_CLOSED_YAOCHU_ANKO_TWO_PLUS": {
      const upItems = ["刻子・ポンが合計3個以上なら60符を確認"];
      if (state.smallFu === "notAsked") {
        upItems.unshift("役牌雀頭と悪形待ちが両方あるなら60符を確認");
      } else if (state.smallFu === "one") {
        upItems.unshift("もう一方の小さい符もあるなら60符を確認");
      }
      conditionBlocks.push(
        block("このまま扱うなら", ["50符として点数を見る"]),
        block("上がる条件", upItems),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;
    }

    case "H_CLOSED_YAOCHU_ANKO_TWO_PLUS":
      conditionBlocks.push(
        block("このまま扱うなら", ["60符として点数を見る"]),
        block("境界条件", ["1・9・字牌の暗刻が実際には1つだけなら50符以下を確認"]),
        block("詳細計算へ進む条件", ["刻子・ポンが合計3個以上なら70符以上を確認"]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;

    case "I_OPEN_SIMPLE_KAN_NON_CLOSED":
      conditionBlocks.push(
        block("上がる条件", [
          "役牌雀頭と悪形待ちが両方あるなら50符を確認",
          "刻子・ポンが合計2個以上なら50符を確認",
          "1・9・字牌の暗刻が1つ以上あるなら50符を確認",
        ]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;

    case "J_OPEN_SIMPLE_KAN_CLOSED":
      conditionBlocks.push(
        block("このまま扱うなら", ["50符として点数を見る"]),
        block("詳細計算へ進む条件", [
          "刻子・ポンが合計2個以上なら60符以上を確認",
          "1・9・字牌の暗刻が1つ以上あるなら60符以上を確認",
        ]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;

    case "K_OPEN_YAOCHU_KAN_NON_CLOSED": {
      conditionBlocks.push(block("このまま扱うなら", ["50符として点数を見る"]));
      if (state.winType === "openRon") {
        conditionBlocks.push(
          block("境界条件", [
            "40符まで下げて見るなら、役牌雀頭・悪形待ちなし、刻子・ポン0〜1つを確認",
          ]),
        );
      }
      conditionBlocks.push(
        block("詳細計算へ進む条件", [
          "刻子・ポンが合計2個以上なら60符以上を確認",
          "1・9・字牌の暗刻が1つ以上あるなら60符以上を確認",
        ]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;
    }

    case "L_OPEN_YAOCHU_KAN_CLOSED":
      conditionBlocks.push(
        block("このまま扱うなら", ["60符として点数を見る"]),
        block("境界条件", [
          "50符まで下げて見るなら、役牌雀頭・悪形待ちなし、刻子・ポン0〜1つを確認",
        ]),
        block("詳細計算へ進む条件", [
          "刻子・ポンが合計2個以上なら70符以上を確認",
          "1・9・字牌の暗刻が1つ以上なら70符以上を確認",
        ]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;

    case "M_CLOSED_SIMPLE_KAN":
      conditionBlocks.push(block("このまま扱うなら", ["50符として点数を見る"]));
      if (state.winType === "openRon") {
        conditionBlocks.push(
          block("境界条件", [
            "40符まで下げて見るなら、役牌雀頭・悪形待ちなし、刻子・ポン0〜1つを確認",
          ]),
        );
      }
      conditionBlocks.push(
        block("詳細計算へ進む条件", [
          "刻子・ポンが合計2個以上なら60符以上を確認",
          "1・9・字牌の暗刻が1つ以上なら60符以上を確認",
        ]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;

    case "N_CLOSED_YAOCHU_KAN":
      conditionBlocks.push(
        block("このまま扱うなら", ["60符として点数を見る"]),
        block("詳細計算へ進む条件", [
          "役牌雀頭または悪形待ちがあるなら70符以上を確認",
          "刻子・ポンが合計2個以上なら70符以上を確認",
          "槓が2個以上あるなら詳細計算へ",
        ]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;

    case "O_NON_CLOSED_TWO_TRIPLETS_NO_YAOCHU_PON":
      conditionBlocks.push(
        block("上がる条件", ["役牌雀頭と悪形待ちが両方あるなら40符を確認"]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;

    case "P_CLOSED_TWO_TRIPLETS_NO_YAOCHU_PON":
      conditionBlocks.push(
        block("上がる条件", ["役牌雀頭と悪形待ちが両方あるなら50符を確認"]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;

    case "R_CLOSED_TWO_TRIPLETS_ONE_YAOCHU_PON_SMALL":
      conditionBlocks.push(block("このまま扱うなら", ["50符として点数を見る"]));
      break;

    case "S_CLOSED_TWO_TRIPLETS_ONE_YAOCHU_PON_NO_SMALL":
      break;

    case "T_NON_CLOSED_TWO_TRIPLETS_ONE_YAOCHU_PON_SMALL":
      conditionBlocks.push(
        block("このまま扱うなら", ["40符として点数を見る"]),
        block("上がる条件", ["役牌雀頭と悪形待ちが両方あるなら50符を確認"]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;

    case "U_TWO_TRIPLETS_TWO_YAOCHU_PON":
      conditionBlocks.push(
        block("このまま扱うなら", [isClosedRon(state) ? "50符として点数を見る" : "40符として点数を見る"]),
        block("上がる条件", [
          isClosedRon(state)
            ? "役牌雀頭または悪形待ちがあるなら50符を確認"
            : "役牌雀頭と悪形待ちが両方あるなら50符を確認",
        ]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;

    case "V_THREE_OR_MORE_TRIPLETS":
      conditionBlocks.push(
        block("このまま扱うなら", ["50符として点数を見る"]),
        block("詳細計算へ進む条件", [
          "1・9・字牌のポンが2個以上なら60符以上を確認",
          "役牌雀頭と悪形待ちが両方あるなら60符以上を確認",
        ]),
      );
      finalActions = actions("viewScore", "openDetailedCalculator", "editAnswers");
      break;

    case "DETAIL_INCOMPLETE":
      conditionBlocks.push(block("追加で見る条件", ["未回答の条件を選び直してください"]));
      finalActions = actions("openDetailedCalculator", "editAnswers");
      break;
  }

  return {
    result,
    title: titleByResult[result],
    selectedSummary: selectedSummary(state),
    conditionBlocks,
    actions: finalActions,
  };
};
