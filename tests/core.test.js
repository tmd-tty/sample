// 実行: node --test tests/core.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const { Hoken } = require("./load.js");
const Core = Hoken.Core;

function validData(overrides = {}) {
  const base = {
    applyDate: "2026-09-28",
    period: { start: "2026-10-01" },
    policyholder: {
      corpName: "株式会社サンプル商事", corpKana: "カブシキガイシャ サンプルショウジ", corpNumber: "7000012050002",
      repTitle: "代表取締役", repName: "保険 太郎",
      zip: "100-0001", address: "東京都千代田区千代田1-1", tel: "03-1234-5678", contactName: "", email: "",
    },
    business: { industry: "office", sales: "50000", employees: "30" },
    location: { same: true, zip: "", address: "", structure: "1", builtYear: "2005" },
    coverage: {
      building: "10000", equipment: "2000", stock: "", deductible: "10",
      liability: "10000", bi: true, biDaily: "10", biPeriod: "6",
    },
    payment: "lump",
    disclosure: { q1: "no", q2: "no", q3: "no", accidents: "", detail: "" },
  };
  for (const [k, v] of Object.entries(overrides)) base[k] = typeof v === "object" ? { ...base[k], ...v } : v;
  return base;
}

test("法人番号のチェックデジット", () => {
  assert.equal(Core.isValidCorporateNumber("7000012050002"), true); // 国税庁
  assert.equal(Core.isValidCorporateNumber("1000012050002"), false);
  assert.equal(Core.isValidCorporateNumber("700001205000"), false);
});

test("保険期間の終期（1年後、2/29は2/28）", () => {
  assert.equal(Core.addYears("2026-10-01", 1), "2027-10-01");
  assert.equal(Core.addYears("2028-02-29", 1), "2029-02-28");
});

test("金額の表記", () => {
  assert.equal(Core.formatMan(500), "500万円");
  assert.equal(Core.formatMan(10000), "1億円");
  assert.equal(Core.formatMan(12000), "1億2,000万円");
});

test("正しい入力ではエラーなし", () => {
  const r = Core.validate(validData());
  assert.deepEqual(r.errors, {});
  assert.deepEqual(r.warnings, []);
});

test("形式チェック", () => {
  const e = Core.validate(validData({
    policyholder: { corpKana: "かぶしき", corpNumber: "1000012050002", zip: "12345", tel: "1234" },
    coverage: { building: "1.5" },
  })).errors;
  assert.match(e["policyholder.corpKana"], /カタカナ/);
  assert.match(e["policyholder.corpNumber"], /チェックデジット/);
  assert.match(e["policyholder.zip"], /7桁/);
  assert.match(e["policyholder.tel"], /形式/);
  assert.match(e["coverage.building"], /整数/);
});

test("保険始期日は申込日から90日以内", () => {
  assert.match(Core.validate(validData({ period: { start: "2026-09-27" } })).errors["period.start"], /申込日以降/);
  assert.match(Core.validate(validData({ period: { start: "2026-12-28" } })).errors["period.start"], /90日以内/);
  assert.equal(Core.validate(validData({ period: { start: "2026-12-27" } })).errors["period.start"], undefined);
});

test("補償が1つもなければエラー", () => {
  const e = Core.validate(validData({ coverage: { building: "", equipment: "", liability: "0", bi: false } })).errors;
  assert.match(e["coverage"], /少なくとも1つ/);
});

test("補償に応じた必須項目", () => {
  const e = Core.validate(validData({
    business: { sales: "" },
    location: { structure: "", builtYear: "", same: false },
    coverage: { biDaily: "", biPeriod: "" },
  })).errors;
  assert.ok(e["business.sales"]);        // 賠償責任あり → 売上高必須
  assert.ok(e["location.structure"]);    // 財物あり → 構造級別必須
  assert.ok(e["location.builtYear"]);    // 建物あり → 建築年必須
  assert.ok(e["location.zip"] && e["location.address"]); // 所在地が別
  assert.ok(e["coverage.biDaily"] && e["coverage.biPeriod"]);
});

test("引受審査の警告", () => {
  const r = Core.validate(validData({
    location: { builtYear: "1970" },
    coverage: { building: "600000" },
    disclosure: { q1: "yes", accidents: "2", q3: "yes", detail: "2025年 水濡れ事故 など" },
  }));
  assert.deepEqual(r.errors, {});
  assert.equal(r.warnings.length, 4);
});

test("告知「はい」は詳細必須、質問1は事故件数必須", () => {
  const e = Core.validate(validData({ disclosure: { q1: "yes" } })).errors;
  assert.ok(e["disclosure.accidents"]);
  assert.ok(e["disclosure.detail"]);
});

test("保険料: 事務所・1級・免責10万円・賠償1億・休業6か月・一括払", () => {
  const p = Core.calcPremium(validData());
  assert.equal(p.ok, true);
  // 建物     10000万 × 300銭 × 95% = 28,500円
  // 設備什器  2000万 × 300銭 × 95% =  5,700円
  // 賠償     売上50000万/100 × 25円 × 100% = 12,500円
  // 休業     日額10万 × 250円 × 140% = 3,500円
  assert.deepEqual(p.items.map((i) => i.premium), [28500, 5700, 12500, 3500]);
  assert.equal(p.annual, 50200);
  assert.equal(p.perPayment, 50200);
});

test("保険料: 月払は年間保険料の5%増を12分割（円未満切り捨て）", () => {
  const p = Core.calcPremium(validData({ payment: "monthly" }));
  // 50200 × 105 / 1200 = 4392.5 → 4,392円
  assert.equal(p.perPayment, 4392);
  assert.equal(p.totalPaid, 4392 * 12);
});

test("保険料: 事故歴1件で10%割増", () => {
  const p = Core.calcPremium(validData({ disclosure: { q1: "yes", accidents: "1" } }));
  assert.deepEqual(p.adjustments.map((a) => [a.label, a.amount]), [["事故歴割増（+10%）", 5020]]);
  assert.equal(p.annual, 55220);
});

test("保険料: 賠償責任の最低保険料", () => {
  const p = Core.calcPremium(validData({
    business: { sales: "1000" },
    coverage: { building: "", equipment: "", bi: false },
  }));
  assert.deepEqual(p.items.map((i) => i.premium), [10000]);
});

test("建築年の範囲メッセージは桁区切りなし", () => {
  const e = Core.validate(validData({ location: { builtYear: "1800" } })).errors;
  assert.equal(e["location.builtYear"], "1900〜2026年の範囲で入力してください");
});

test("計算できない入力では理由を返す", () => {
  const p = Core.calcPremium(validData({ business: { industry: "" } }));
  assert.equal(p.ok, false);
  assert.match(p.reason, /業種/);
});
