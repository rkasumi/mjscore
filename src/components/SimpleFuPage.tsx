import { useMemo, useState } from "react";

import {
  buildFinalPageContent,
  judgeSimpleFu,
  type FinalAction,
  type FuQuickState,
  type KanType,
  type SmallFu,
  type TripletCount,
  type WinType,
  type YaochuAnkoCount,
  type YaochuPonCount,
} from "../lib/simpleFu";

type OptionValue = WinType | KanType | YaochuAnkoCount | SmallFu | TripletCount | YaochuPonCount;

type Question = {
  key: keyof FuQuickState;
  title: string;
  options: { label: string; value: OptionValue }[];
};

const initialState: FuQuickState = {
  winType: null,
  kanType: null,
  yaochuAnkoCount: "notAsked",
  smallFu: "notAsked",
  tripletCount: "notAsked",
  yaochuPonCount: "notAsked",
};

const getNextQuestion = (state: FuQuickState): Question | null => {
  if (state.winType === null) {
    return {
      key: "winType",
      title: "あがり方は？",
      options: [
        { label: "面前ロン", value: "closedRon" },
        { label: "面前ツモ", value: "closedTsumo" },
        { label: "鳴きロン", value: "openRon" },
        { label: "鳴きツモ", value: "openTsumo" },
      ],
    };
  }

  if (state.kanType === null) {
    return {
      key: "kanType",
      title: "槓はありますか？",
      options: [
        { label: "なし", value: "none" },
        { label: "中張牌の明槓", value: "openSimple" },
        { label: "1・9・字牌の明槓", value: "openYaochu" },
        { label: "暗槓", value: "unknownClosedKan" },
      ],
    };
  }

  if (state.kanType === "unknownClosedKan") {
    return {
      key: "kanType",
      title: "暗槓はどちらですか？",
      options: [
        { label: "中張牌", value: "closedSimple" },
        { label: "1・9・字牌", value: "closedYaochu" },
      ],
    };
  }

  if (state.kanType !== "none") {
    return null;
  }

  if (state.yaochuAnkoCount === "notAsked") {
    return {
      key: "yaochuAnkoCount",
      title: "暗刻の中に1・9・字牌はありますか？",
      options: [
        { label: "なし", value: "none" },
        { label: "1つ", value: "one" },
        { label: "2つ以上", value: "twoOrMore" },
      ],
    };
  }

  if (state.yaochuAnkoCount === "twoOrMore") {
    return null;
  }

  if (state.yaochuAnkoCount === "one") {
    if (state.smallFu === "notAsked") {
      return {
        key: "smallFu",
        title: "役牌雀頭・悪形待ちはありますか？",
        options: [
          { label: "なし", value: "none" },
          { label: "どちらか1つ", value: "one" },
          { label: "両方", value: "both" },
        ],
      };
    }
    return null;
  }

  if (state.tripletCount === "notAsked") {
    return {
      key: "tripletCount",
      title: "刻子・ポンは合計いくつありますか？",
      options: [
        { label: "0〜1つ", value: "zeroOrOne" },
        { label: "2つ", value: "two" },
        { label: "3つ以上", value: "threeOrMore" },
      ],
    };
  }

  if (state.tripletCount !== "two") {
    return null;
  }

  if (state.yaochuPonCount === "notAsked") {
    return {
      key: "yaochuPonCount",
      title: "その中に1・9・字牌のポンはありますか？",
      options: [
        { label: "なし", value: "none" },
        { label: "1つ", value: "one" },
        { label: "2つ", value: "two" },
      ],
    };
  }

  if (state.yaochuPonCount === "one" && state.smallFu === "notAsked") {
    return {
      key: "smallFu",
      title: "役牌雀頭・悪形待ちはありますか？",
      options: [
        { label: "なし", value: "none" },
        { label: "どちらか1つ", value: "one" },
        { label: "両方", value: "both" },
      ],
    };
  }

  return null;
};

const resetDependents = (key: keyof FuQuickState, next: FuQuickState): FuQuickState => {
  if (key === "winType") {
    return { ...initialState, winType: next.winType };
  }
  if (key === "kanType") {
    return {
      ...next,
      yaochuAnkoCount: "notAsked",
      smallFu: "notAsked",
      tripletCount: "notAsked",
      yaochuPonCount: "notAsked",
    };
  }
  if (key === "yaochuAnkoCount") {
    return {
      ...next,
      smallFu: "notAsked",
      tripletCount: "notAsked",
      yaochuPonCount: "notAsked",
    };
  }
  if (key === "tripletCount") {
    return {
      ...next,
      smallFu: "notAsked",
      yaochuPonCount: "notAsked",
    };
  }
  if (key === "yaochuPonCount") {
    return {
      ...next,
      smallFu: "notAsked",
    };
  }
  return next;
};

const actionLabel: Record<FinalAction, string> = {
  viewScore: "このまま点数を見る",
  openDetailedCalculator: "詳細計算で確認",
  editAnswers: "条件を戻って修正",
};

export const SimpleFuPage = () => {
  const [state, setState] = useState<FuQuickState>(initialState);
  const question = getNextQuestion(state);
  const finalContent = useMemo(() => {
    if (question) {
      return null;
    }
    const judgement = judgeSimpleFu(state);
    return buildFinalPageContent(state, judgement.result, judgement.routeId);
  }, [question, state]);
  const hasStarted = state.winType !== null;

  const handleSelect = (key: keyof FuQuickState, value: OptionValue) => {
    setState((prev) => {
      const next = { ...prev, [key]: value };
      return resetDependents(key, next);
    });
  };

  const renderAction = (action: FinalAction) => {
    const baseClass =
      "flex min-h-16 items-center justify-center rounded-[1.5rem] px-3 text-center text-base font-black";

    if (action === "viewScore") {
      return (
        <a
          key={action}
          className={`${baseClass} bg-slate-100 text-slate-700 active:bg-slate-200`}
          href="/#score-table"
        >
          {actionLabel[action]}
        </a>
      );
    }

    if (action === "openDetailedCalculator") {
      return (
        <a
          key={action}
          className={`${baseClass} bg-rose-500 text-white active:bg-rose-600`}
          href="/#fu-table"
        >
          {actionLabel[action]}
        </a>
      );
    }

    return (
      <button
        key={action}
        type="button"
        className={`${baseClass} bg-emerald-500 text-white active:bg-emerald-600`}
        onClick={() => setState(initialState)}
      >
        {actionLabel[action]}
      </button>
    );
  };

  return (
    <div className="h-dvh w-screen overflow-hidden bg-white text-slate-900">
      <main className="flex h-full w-full flex-col gap-4 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
        <header className="flex min-h-10 items-center justify-between gap-3">
          <h1 className="text-base font-bold text-slate-500">符ざっくり判定</h1>
          {hasStarted ? (
            <button
              type="button"
              className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600"
              onClick={() => setState(initialState)}
            >
              最初から
            </button>
          ) : null}
        </header>

        {question ? (
          <>
            <section className="flex min-h-0 flex-[0.9] items-center">
              <h2 className="w-full break-words text-[clamp(2rem,10vw,4.5rem)] font-black leading-[1.05] text-slate-950">
                {question.title}
              </h2>
            </section>
            <section className="grid min-h-0 flex-[1.4] auto-rows-fr gap-3">
              {question.options.map((option) => (
                <button
                  key={`${question.key}-${option.value}`}
                  type="button"
                  className="flex min-h-0 w-full items-center justify-center rounded-[2rem] bg-emerald-500 px-4 text-center text-[clamp(1.55rem,7.5vw,3.5rem)] font-black leading-tight text-white shadow-sm active:scale-[0.99] active:bg-emerald-600"
                  onClick={() => handleSelect(question.key, option.value)}
                >
                  {option.label}
                </button>
              ))}
            </section>
          </>
        ) : null}

        {finalContent ? (
          <section className="flex min-h-0 flex-1 flex-col gap-3">
            <div
              className={`rounded-[2rem] px-4 py-6 text-center ${
                finalContent.result === "RESULT_30" || finalContent.result === "RESULT_40"
                  ? "bg-emerald-500 text-white"
                  : finalContent.result === "RESULT_DETAIL"
                    ? "bg-rose-500 text-white"
                    : "bg-amber-400 text-slate-950"
              }`}
            >
              <div className="text-base font-black opacity-80">判定</div>
              <div className="mt-2 break-words text-[clamp(3.25rem,16vw,6rem)] font-black leading-none">
                {finalContent.title}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto rounded-[1.75rem] border border-slate-200 bg-white p-4">
              <section>
                <div className="text-xs font-black text-slate-400">選択内容</div>
                <div className="mt-2 space-y-1.5">
                  {finalContent.selectedSummary.map((item) => (
                    <div key={item} className="text-base font-bold leading-snug text-slate-800">
                      {item}
                    </div>
                  ))}
                </div>
              </section>

              {finalContent.conditionBlocks.length > 0 ? (
                <div className="mt-4 space-y-4">
                  {finalContent.conditionBlocks.map((conditionBlock) => (
                    <section key={conditionBlock.heading}>
                      <div className="text-xs font-black text-slate-400">
                        {conditionBlock.heading}
                      </div>
                      <ul className="mt-2 space-y-2 text-sm font-bold leading-snug text-slate-700">
                        {conditionBlock.items.map((item) => (
                          <li key={item}>・{item}</li>
                        ))}
                      </ul>
                    </section>
                  ))}
                </div>
              ) : null}
            </div>

            <div
              className={`grid gap-3 ${
                finalContent.actions.length === 1
                  ? "grid-cols-1"
                  : finalContent.actions.length === 2
                    ? "grid-cols-2"
                    : "grid-cols-1 sm:grid-cols-3"
              }`}
            >
              {finalContent.actions.map((action) => renderAction(action))}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
};
