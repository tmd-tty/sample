/*
 * 入力チェックの部品
 *
 * 各関数はチェック関数を返す。チェック関数は (値, ctx) を受け取り、
 * エラーならメッセージ文字列、問題なければ null を返す。
 *   ctx = { label: 項目名, data: 入力データ全体, facts: 導出値（rules/facts.js） }
 *
 * required / requiredIf / choice 以外は、空欄のときは何もしない（必須かどうかは別のチェックで判定する）。
 * 数値の引数には関数も渡せる（例: max: (f) => f.thisYear）。
 */
var Hoken = Hoken || {};

Hoken.Checks = (() => {
  "use strict";
  const U = Hoken.Util;

  const resolve = (x, ctx) => (typeof x === "function" ? x(ctx.facts, ctx.data) : x);
  const ok = null;

  // 必須
  const required = (message) => (v, ctx) =>
    U.blank(v) ? message || ctx.label + "を入力してください" : ok;

  // 条件付き必須。cond(facts, data) が true のときだけ必須
  const requiredIf = (cond, message) => (v, ctx) =>
    cond(ctx.facts, ctx.data) && U.blank(v) ? message || ctx.label + "を入力してください" : ok;

  // 選択肢の中から選ばれているか（未選択もエラー）
  //   options: 配列（key で値を比較）またはオブジェクト（キーを値とみなす）
  const choice = (options, key, message) => (v, ctx) => {
    const list = resolve(options, ctx);
    const found = Array.isArray(list)
      ? list.some((o) => (key ? o[key] : o) === v)
      : Object.prototype.hasOwnProperty.call(list, v);
    return found ? ok : message || ctx.label + "を選択してください";
  };

  const maxLength = (n) => (v) =>
    !U.blank(v) && String(v).length > n ? n + "文字以内で入力してください" : ok;

  const pattern = (re, message) => (v) =>
    !U.blank(v) && !re.test(v) ? message : ok;

  const kana = () => pattern(/^[ァ-ヶー・　 ]+$/, "全角カタカナで入力してください");
  const zip = () => pattern(/^\d{3}-?\d{4}$/, "7桁の数字で入力してください（例: 100-0001）");
  const email = () => pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "メールアドレスの形式が正しくありません");

  const tel = () => (v) => {
    if (U.blank(v)) return ok;
    const digits = String(v).replace(/-/g, "");
    return /^0\d{1,4}-?\d{1,4}-?\d{3,4}$/.test(v) && digits.length >= 10 && digits.length <= 11
      ? ok
      : "電話番号の形式が正しくありません（例: 03-1234-5678）";
  };

  // 整数と範囲。{ min, max, unit, comma }（comma: false で「2,026」ではなく「2026」と表示）
  const integer = (opts = {}) => (v, ctx) => {
    if (U.blank(v)) return ok;
    const n = U.toInt(v);
    if (isNaN(n)) return "半角数字（整数）で入力してください";
    const min = resolve(opts.min, ctx);
    const max = resolve(opts.max, ctx);
    const num = (x) => (opts.comma === false ? String(x) : x.toLocaleString());
    const unit = opts.unit || "";
    if ((min != null && n < min) || (max != null && n > max)) {
      if (min == null) return num(max) + unit + "以下で入力してください";
      if (max == null) return num(min) + unit + "以上で入力してください";
      return num(min) + "〜" + num(max) + unit + "の範囲で入力してください";
    }
    return ok;
  };

  const date = () => (v) => (!U.blank(v) && !U.parseDate(v) ? "日付が正しくありません" : ok);

  const corporateNumber = () => (v) => {
    if (U.blank(v)) return ok;
    if (!/^\d{13}$/.test(v)) return "13桁の半角数字で入力してください";
    return U.isValidCorporateNumber(v) ? ok : "法人番号が正しくありません（チェックデジット不一致）";
  };

  // 独自チェック。fn(値, facts, data) がメッセージを返せばエラー
  const custom = (fn) => (v, ctx) => (U.blank(v) ? ok : fn(v, ctx.facts, ctx.data) || ok);

  return { required, requiredIf, choice, maxLength, pattern, kana, zip, email, tel, integer, date, corporateNumber, custom };
})();
