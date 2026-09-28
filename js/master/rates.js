/*
 * 料率・選択肢マスタ（サンプル・架空の値）
 *
 * 料率改定時はこのファイルだけを差し替える想定。
 * 金額・料率はすべて整数で持ち、浮動小数点による端数誤差を避ける。
 * 係数（pct）は百分率の整数（100 = 1.00倍）。
 */
var Hoken = Hoken || {};

Hoken.RATES = {
  version: "2026-10-01",
  productName: "事業総合保険（サンプル）",

  // 業種ごとの基本料率
  //   property:  財物補償 保険金額1万円あたりの年額（単位: 銭）。配列は構造級別 1級〜4級
  //   liability: 賠償責任 売上高100万円あたりの年額（単位: 円、支払限度額1億円の場合）
  //   bi:        休業補償 支払限度日額1万円あたりの年額（単位: 円、てん補期間3か月の場合）
  industries: [
    { code: "office",     label: "事務所（オフィス・士業等）",          property: [300, 390, 540, 720],     liability: 25,  bi: 250 },
    { code: "retail",     label: "小売業（店舗）",                      property: [420, 550, 760, 1010],    liability: 60,  bi: 400 },
    { code: "restaurant", label: "飲食業",                              property: [700, 910, 1260, 1680],   liability: 110, bi: 650 },
    { code: "mfg_light",  label: "製造業（軽工業：電子機器・食品等）",  property: [600, 780, 1080, 1440],   liability: 90,  bi: 550 },
    { code: "mfg_heavy",  label: "製造業（重工業：金属・化学等）",      property: [950, 1240, 1710, 2280],  liability: 160, bi: 850 },
    { code: "warehouse",  label: "倉庫・物流業",                        property: [520, 680, 940, 1250],    liability: 55,  bi: 450 },
  ],

  // 建物の構造級別
  structures: [
    { value: "1", label: "1級（耐火構造：鉄筋コンクリート造等）" },
    { value: "2", label: "2級（準耐火構造：鉄骨造等）" },
    { value: "3", label: "3級（防火構造）" },
    { value: "4", label: "4級（その他：木造等）" },
  ],

  // 財物補償の免責金額（自己負担額）と割引
  deductibles: [
    { value: "0",   label: "なし",     pct: 100 },
    { value: "10",  label: "10万円",   pct: 95 },
    { value: "100", label: "100万円",  pct: 85 },
  ],

  // 賠償責任の支払限度額（value は万円。"0" は付帯しない）
  liabilityLimits: [
    { value: "0",     label: "付帯しない", pct: 0 },
    { value: "10000", label: "1億円",      pct: 100 },
    { value: "30000", label: "3億円",      pct: 130 },
    { value: "50000", label: "5億円",      pct: 150 },
  ],
  liabilityMinPremium: 10000,

  // 休業補償の約定てん補期間
  biPeriods: [
    { value: "3",  label: "3か月",  pct: 100 },
    { value: "6",  label: "6か月",  pct: 140 },
    { value: "12", label: "12か月", pct: 190 },
  ],

  // 過去3年間の事故件数による割増（%）。配列の最後はそれ以上の件数に適用
  accidentSurcharge: [0, 10, 20, 30],
  accidentReviewCount: 2, // この件数以上は引受審査

  // 入力の上限（金額は万円）
  limits: {
    propertyItemMax: 1000000,   // 保険の対象ごとの保険金額 100億円
    propertyReview: 500000,     // 財物の合計がこれを超えると引受審査 50億円
    salesMax: 10000000,         // 売上高 1,000億円
    biDailyMax: 1000,           // 休業補償 支払限度日額 1,000万円
    employeesMax: 1000000,
    startWithinDays: 90,        // 保険始期日は申込日から90日以内
    oldBuildingYears: 50,       // 築年数がこれを超えると引受審査
  },

  // 払込方法（1回あたり保険料 = 年間保険料 × num / den、円未満切り捨て）
  payment: {
    lump:    { label: "一括払",       num: 1,   den: 1,    times: 1 },
    monthly: { label: "月払（12回）", num: 105, den: 1200, times: 12 },
  },
};
