/*
 * ルール実行エンジン
 *
 * rules/validation.js と rules/premium.js のルール表を順に実行するだけの汎用処理。
 * チェック内容や計算式を変えるときは、このファイルではなくルール表を編集する。
 */
var Hoken = Hoken || {};

Hoken.Core = (() => {
  "use strict";
  const U = Hoken.Util;
  const Facts = Hoken.Facts;
  const VR = Hoken.ValidationRules;
  const PR = Hoken.PremiumRules;

  const getPath = (obj, path) =>
    path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);

  const text = (message, f, data) => (typeof message === "function" ? message(f, data) : message);

  /*
   * 入力チェック
   * 戻り値: { errors: { "項目パス": "メッセージ" }, warnings: ["..."] }
   */
  const validate = (data) => {
    const f = Facts.derive(data);
    const errors = {};
    const warnings = [];

    for (const field of VR.fields) {
      if (field.when && !field.when(f, data)) continue;
      const ctx = { label: field.label, data, facts: f };
      const value = getPath(data, field.path);
      for (const rule of field.rules) {
        const msg = rule(value, ctx);
        if (msg) {
          errors[field.path] = msg;
          break;
        }
      }
    }

    for (const c of VR.checks) {
      if (!errors[c.path] && c.errorIf(f, data)) errors[c.path] = text(c.message, f, data);
    }

    for (const w of VR.underwriting) {
      if (w.when(f, data)) warnings.push(text(w.message, f, data));
    }

    return { errors, warnings };
  };

  /*
   * 保険料計算
   * 計算できない場合は { ok: false, reason }。
   */
  const calcPremium = (data) => {
    const f = Facts.derive(data);
    const fail = (reason) => ({ ok: false, reason });

    for (const pre of PR.prerequisites) {
      const reason = pre(f);
      if (reason) return fail(reason);
    }

    const items = [];
    for (const c of PR.coverages) {
      if (!c.applies(f)) continue;
      const reason = c.needs && c.needs(f);
      if (reason) return fail(reason);
      const r = c.calc(f);
      items.push({ group: c.group, label: c.label, limit: r.limit, premium: r.premium });
    }
    if (!items.length) return fail("補償内容を設定すると計算します");

    const subtotal = items.reduce((s, it) => s + it.premium, 0);

    const adjustments = PR.adjustments
      .map((a) => {
        const pct = a.pct(f);
        return {
          name: a.name,
          pct,
          label: a.name + "（" + (pct > 0 ? "+" : "") + pct + "%）",
          amount: Math.floor((subtotal * pct) / 100),
        };
      })
      .filter((a) => a.pct !== 0);

    const annual = subtotal + adjustments.reduce((s, a) => s + a.amount, 0);

    const pay = f.payment;
    const perPayment = pay ? Math.floor((annual * pay.num) / pay.den) : null;

    return {
      ok: true,
      industry: f.industry,
      items,
      subtotal,
      adjustments,
      annual,
      payment: pay,
      perPayment,
      totalPaid: pay ? perPayment * pay.times : null,
    };
  };

  return {
    RATES: Hoken.RATES,
    DISCLOSURE_QUESTIONS: Hoken.DISCLOSURE_QUESTIONS,
    validate,
    calcPremium,
    derive: Facts.derive,
    getPath,
    find: U.find,
    toInt: U.toInt,
    parseDate: U.parseDate,
    addYears: U.addYears,
    isValidCorporateNumber: U.isValidCorporateNumber,
    formatMan: U.formatMan,
  };
})();
