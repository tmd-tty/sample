/*
 * 入力チェックのルール表
 *
 * ■ fields: 項目ごとのチェック（上から順に評価。1項目につき最初に引っかかったエラーだけ表示）
 *     path  … 入力データ上の項目名（index.html の name 属性と同じ）
 *     label … エラーメッセージで使う項目名（「〇〇を入力してください」）
 *     when  … (facts, data) => boolean。false のときはその項目をチェックしない（省略時は常にチェック）
 *     rules … lib/checks.js の部品を並べる。左から順に評価される
 *
 * ■ checks: 複数項目にまたがるチェック。errorIf が true ならエラー
 * ■ underwriting: 引受審査が必要な条件。when が true なら警告（申込書は作成できる）
 *
 * 関数の第1引数 f は rules/facts.js で求めた導出値。
 */
var Hoken = Hoken || {};

Hoken.ValidationRules = (() => {
  "use strict";
  const C = Hoken.Checks;
  const U = Hoken.Util;
  const R = Hoken.RATES;
  const L = R.limits;

  const fields = [
    // ---------- 申込日・保険期間 ----------
    { path: "applyDate", label: "申込日", rules: [C.required(), C.date()] },
    {
      path: "period.start", label: "保険始期日",
      rules: [
        C.required(),
        C.date(),
        C.custom((v, f, d) => {
          if (!f.applyDate) return null;
          const days = U.daysBetween(d.applyDate, v);
          if (days < 0) return "申込日以降の日付を入力してください";
          if (days > L.startWithinDays) return "申込日から" + L.startWithinDays + "日以内の日付を入力してください";
        }),
      ],
    },

    // ---------- 契約者（法人） ----------
    { path: "policyholder.corpName",    label: "法人名",         rules: [C.required(), C.maxLength(50)] },
    { path: "policyholder.corpKana",    label: "法人名フリガナ", rules: [C.required(), C.kana(), C.maxLength(80)] },
    { path: "policyholder.corpNumber",  label: "法人番号",       rules: [C.required(), C.corporateNumber()] },
    { path: "policyholder.repTitle",    label: "代表者役職",     rules: [C.required(), C.maxLength(20)] },
    { path: "policyholder.repName",     label: "代表者氏名",     rules: [C.required(), C.maxLength(30)] },
    { path: "policyholder.zip",         label: "郵便番号",       rules: [C.required(), C.zip()] },
    { path: "policyholder.address",     label: "所在地",         rules: [C.required(), C.maxLength(100)] },
    { path: "policyholder.tel",         label: "電話番号",       rules: [C.required(), C.tel()] },
    { path: "policyholder.contactName", label: "ご担当者名",     rules: [C.maxLength(30)] },
    { path: "policyholder.email",       label: "メールアドレス", rules: [C.email()] },

    // ---------- 事業内容 ----------
    { path: "business.industry", label: "業種", rules: [C.choice(R.industries, "code")] },
    {
      path: "business.sales", label: "年間売上高",
      rules: [
        C.requiredIf((f) => f.hasLiability, "賠償責任を付帯する場合は売上高を入力してください"),
        C.integer({ min: 1, max: L.salesMax, unit: "万円" }),
      ],
    },
    { path: "business.employees", label: "従業員数", rules: [C.integer({ min: 0, max: L.employeesMax, unit: "人" })] },

    // ---------- 保険の対象の所在地・建物 ----------
    { path: "location.zip",     label: "郵便番号", when: (f) => f.isOtherLocation, rules: [C.required(), C.zip()] },
    { path: "location.address", label: "所在地",   when: (f) => f.isOtherLocation, rules: [C.required(), C.maxLength(100)] },
    {
      path: "location.structure", label: "構造級別", when: (f) => f.hasProperty,
      rules: [C.choice(R.structures, "value", "財物補償を付帯する場合は構造級別を選択してください")],
    },
    {
      path: "location.builtYear", label: "建築年",
      rules: [
        C.requiredIf((f) => f.hasBuilding, "建物を補償する場合は建築年を入力してください"),
        C.integer({ min: 1900, max: (f) => f.thisYear, unit: "年", comma: false }),
      ],
    },

    // ---------- 補償内容 ----------
    { path: "coverage.building",   label: "建物",       rules: [C.integer({ min: 0, max: L.propertyItemMax, unit: "万円" })] },
    { path: "coverage.equipment",  label: "設備・什器", rules: [C.integer({ min: 0, max: L.propertyItemMax, unit: "万円" })] },
    { path: "coverage.stock",      label: "商品・製品", rules: [C.integer({ min: 0, max: L.propertyItemMax, unit: "万円" })] },
    { path: "coverage.deductible", label: "免責金額",   when: (f) => f.hasProperty, rules: [C.choice(R.deductibles, "value")] },
    { path: "coverage.liability",  label: "賠償責任の支払限度額", rules: [C.choice(R.liabilityLimits, "value")] },
    {
      path: "coverage.biDaily", label: "支払限度日額", when: (f) => f.hasBI,
      rules: [C.required(), C.integer({ min: 1, max: L.biDailyMax, unit: "万円" })],
    },
    { path: "coverage.biPeriod", label: "てん補期間", when: (f) => f.hasBI, rules: [C.choice(R.biPeriods, "value")] },

    // ---------- 払込方法 ----------
    { path: "payment", label: "払込方法", rules: [C.choice(R.payment)] },

    // ---------- 告知 ----------
    // 質問ごとの回答必須チェックは master/questions.js から自動生成
    ...Hoken.DISCLOSURE_QUESTIONS.map((q, i) => ({
      path: "disclosure." + q.key,
      label: "質問" + (i + 1),
      rules: [C.choice(["yes", "no"], null, "質問" + (i + 1) + "に回答してください")],
    })),
    {
      path: "disclosure.accidents", label: "事故件数", when: (f) => f.hasAccidents,
      rules: [C.required(), C.integer({ min: 1, max: 99, unit: "件" })],
    },
    {
      path: "disclosure.detail", label: "「はい」の詳細", when: (f) => f.anyDisclosureYes,
      rules: [C.required(), C.maxLength(400)],
    },
  ];

  const checks = [
    {
      path: "coverage",
      errorIf: (f) => !isNaN(f.propertyTotal) && !f.hasProperty && !f.hasLiability && !f.hasBI,
      message: "財物・賠償責任・休業補償のうち、少なくとも1つの補償を設定してください",
    },
  ];

  const underwriting = [
    {
      when: (f) => f.propertyTotal > L.propertyReview,
      message: "財物の保険金額合計が" + U.formatMan(L.propertyReview) + "を超えるため、引受審査が必要です。",
    },
    {
      when: (f) => f.hasBuilding && f.buildingAge > L.oldBuildingYears,
      message: "築" + L.oldBuildingYears + "年を超える建物のため、引受審査が必要です。",
    },
    {
      when: (f) => f.accidents >= R.accidentReviewCount,
      message: (f) => "過去3年間の事故が" + f.accidents + "件あるため、引受審査が必要です。",
    },
    {
      when: (f) => f.disclosure.q3 === "yes",
      message: "危険物等を取り扱っているため、引受審査が必要です。",
    },
  ];

  return { fields, checks, underwriting };
})();
