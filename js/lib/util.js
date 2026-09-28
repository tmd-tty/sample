/*
 * 汎用関数（日付・数値・書式など）
 */
var Hoken = Hoken || {};

Hoken.Util = (() => {
  "use strict";

  const blank = (v) => v == null || String(v).trim() === "";

  // 配列から key が value の要素を探す
  const find = (list, key, value) => list.find((x) => x[key] === value);

  // 空欄は 0、半角数字のみなら数値、それ以外は NaN
  const toInt = (v) => {
    if (blank(v)) return 0;
    return /^\d+$/.test(String(v).trim()) ? Number(v) : NaN;
  };

  // "YYYY-MM-DD" を検証して {y, m, d} を返す。存在しない日付は null。
  const parseDate = (s) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return null;
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
    return { y, m, d };
  };

  const daysBetween = (from, to) => {
    const a = parseDate(from);
    const b = parseDate(to);
    if (!a || !b) return null;
    return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000);
  };

  // n年後の同日（2/29 始期で平年に当たる場合は 2/28）
  const addYears = (s, n) => {
    const d = parseDate(s);
    if (!d) return null;
    const y = d.y + n;
    const last = new Date(y, d.m, 0).getDate();
    const pad = (x) => String(x).padStart(2, "0");
    return y + "-" + pad(d.m) + "-" + pad(Math.min(d.d, last));
  };

  // 法人番号（13桁）のチェックデジット検証
  // 検査用数字 = 9 - (Σ(下位からn桁目の数字 × (nが奇数なら1、偶数なら2)) mod 9)
  const isValidCorporateNumber = (s) => {
    if (!/^\d{13}$/.test(s || "")) return false;
    const body = s.slice(1);
    let sum = 0;
    for (let n = 1; n <= 12; n++) sum += Number(body[12 - n]) * (n % 2 === 1 ? 1 : 2);
    return Number(s[0]) === 9 - (sum % 9);
  };

  // 万円単位の金額を「1億2,000万円」の形に整形
  const formatMan = (man) => {
    const oku = Math.floor(man / 10000);
    const rest = man % 10000;
    if (oku && rest) return oku.toLocaleString() + "億" + rest.toLocaleString() + "万円";
    if (oku) return oku.toLocaleString() + "億円";
    return rest.toLocaleString() + "万円";
  };

  return { blank, find, toInt, parseDate, daysBetween, addYears, isValidCorporateNumber, formatMan };
})();
