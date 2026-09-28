/*
 * 導出値（facts）
 *
 * 入力データから、チェックや保険料計算で何度も使う値を1か所で求める。
 * 「賠償責任を付帯しているか」「財物の保険金額合計」などの判定を変えたいときはここを直す。
 * rules/validation.js と rules/premium.js の関数は、第1引数でこの facts を受け取る。
 */
var Hoken = Hoken || {};

Hoken.Facts = (() => {
  "use strict";
  const U = Hoken.Util;
  const R = Hoken.RATES;

  const derive = (data) => {
    const biz = data.business || {};
    const loc = data.location || {};
    const cv = data.coverage || {};
    const ds = data.disclosure || {};

    const applyDate = U.parseDate(data.applyDate);
    const thisYear = applyDate ? applyDate.y : new Date().getFullYear();

    const industry = U.find(R.industries, "code", biz.industry);
    const structure = U.find(R.structures, "value", loc.structure);
    const liability = U.find(R.liabilityLimits, "value", cv.liability);

    // 財物の保険金額（万円）。数字以外が入っていれば NaN
    const property = {
      building: U.toInt(cv.building),
      equipment: U.toInt(cv.equipment),
      stock: U.toInt(cv.stock),
    };
    const propertyTotal = property.building + property.equipment + property.stock;

    const builtYear = U.toInt(loc.builtYear);

    return {
      applyDate,                          // 申込日 {y, m, d}（不正なら null）
      thisYear,                           // 申込日の年（建築年の上限などに使う）

      industry,                           // 業種マスタの要素
      structure,                          // 構造級別マスタの要素
      deductible: U.find(R.deductibles, "value", cv.deductible),
      liability,                          // 賠償責任の支払限度額マスタの要素
      biPeriod: U.find(R.biPeriods, "value", cv.biPeriod),
      payment: R.payment[data.payment] || null,

      // 財物補償の料率（銭/万円）。業種と構造級別がそろったときだけ決まる
      propertyRate: industry && structure ? industry.property[R.structures.indexOf(structure)] : null,

      property,
      propertyTotal,
      sales: U.toInt(biz.sales),          // 年間売上高（万円）
      biDaily: U.toInt(cv.biDaily),       // 休業補償の支払限度日額（万円）

      hasProperty: propertyTotal > 0,
      hasBuilding: property.building > 0,
      hasLiability: !!liability && liability.pct > 0,
      hasBI: !!cv.bi,
      isOtherLocation: !loc.same,         // 保険の対象の所在地が契約者と別

      // 築年数（建築年が正しく入力されているときだけ）
      buildingAge: builtYear >= 1900 && builtYear <= thisYear ? thisYear - builtYear : null,

      disclosure: ds,
      anyDisclosureYes: Hoken.DISCLOSURE_QUESTIONS.some((q) => ds[q.key] === "yes"),
      hasAccidents: ds.q1 === "yes",
      accidents: ds.q1 === "yes" ? U.toInt(ds.accidents) : 0,   // 過去3年間の事故件数
    };
  };

  return { derive };
})();
