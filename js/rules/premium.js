/*
 * 保険料計算のルール表
 *
 * ■ prerequisites: 計算を始める前提条件。理由の文字列を返したら計算しない
 * ■ coverages: 補償ごとの年間保険料（上から順に計算し、そのまま内訳の行になる）
 *     group / label … 内訳の表示名
 *     applies       … (f) => boolean。この補償を計算するか
 *     needs         … (f) => 理由 | undefined。計算に必要な入力がそろっていなければ理由を返す
 *     calc          … (f) => { limit: 保険金額・限度額の表示, premium: 年間保険料（円・整数） }
 * ■ adjustments: 補償の小計に対する割増引（%）。0 のものは表示しない
 *
 * 金額はすべて整数で計算し、補償ごと・割増引ごとに円未満を切り捨てる。
 * 関数の第1引数 f は rules/facts.js で求めた導出値。
 */
var Hoken = Hoken || {};

Hoken.PremiumRules = (() => {
  "use strict";
  const U = Hoken.Util;
  const R = Hoken.RATES;

  // 財物補償: 保険金額（万円）× 料率（銭/万円）× 免責係数(%) ÷ 100（銭→円）÷ 100（%）
  const property = (key, label) => ({
    group: "財物補償",
    label,
    applies: (f) => f.property[key] > 0,
    needs: (f) => {
      if (!f.structure) return "構造級別を選択すると計算します";
      if (!f.deductible) return "免責金額を選択すると計算します";
    },
    calc: (f) => ({
      limit: U.formatMan(f.property[key]),
      premium: Math.floor((f.property[key] * f.propertyRate * f.deductible.pct) / 10000),
    }),
  });

  const prerequisites = [
    (f) => (!f.industry ? "業種を選択すると計算します" : undefined),
    (f) => (isNaN(f.propertyTotal) ? "保険金額を半角数字で入力すると計算します" : undefined),
  ];

  const coverages = [
    property("building", "建物"),
    property("equipment", "設備・什器"),
    property("stock", "商品・製品"),

    // 賠償責任: 売上高（万円）÷ 100 × 料率（円/売上100万円）× 限度額係数(%) ÷ 100。最低保険料あり
    {
      group: "賠償責任",
      label: "施設・業務遂行",
      applies: (f) => f.hasLiability,
      needs: (f) => (!(f.sales > 0) ? "売上高を入力すると計算します" : undefined),
      calc: (f) => ({
        limit: "1事故 " + f.liability.label,
        premium: Math.max(
          Math.floor((f.sales * f.industry.liability * f.liability.pct) / 10000),
          R.liabilityMinPremium
        ),
      }),
    },

    // 休業補償: 支払限度日額（万円）× 料率（円/日額1万円）× てん補期間係数(%) ÷ 100
    {
      group: "休業補償",
      label: "営業継続費用・利益",
      applies: (f) => f.hasBI,
      needs: (f) => (!(f.biDaily > 0) || !f.biPeriod ? "休業補償の日額とてん補期間を入力すると計算します" : undefined),
      calc: (f) => ({
        limit: "日額 " + U.formatMan(f.biDaily) + " × " + f.biPeriod.label,
        premium: Math.floor((f.biDaily * f.industry.bi * f.biPeriod.pct) / 100),
      }),
    },
  ];

  const adjustments = [
    {
      name: "事故歴割増",
      pct: (f) => {
        if (!(f.accidents > 0)) return 0;
        const table = R.accidentSurcharge;
        return table[Math.min(f.accidents, table.length - 1)];
      },
    },
  ];

  return { prerequisites, coverages, adjustments };
})();
