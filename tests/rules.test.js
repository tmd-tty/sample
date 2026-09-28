// ルール表と画面（index.html）の整合性チェック
// 入力欄を追加したのにルールを書き忘れた、またはその逆を検出する
const test = require("node:test");
const assert = require("node:assert/strict");
const { Hoken, html } = require("./load.js");

// JavaScript で生成する入力欄と、チェック対象外の入力欄
const GENERATED = ["payment", ...Hoken.DISCLOSURE_QUESTIONS.map((q) => "disclosure." + q.key)];
const NO_RULE = ["location.same", "coverage.bi"]; // 表示切替用のチェックボックス

const formHtml = html.slice(html.indexOf("<form"), html.indexOf("</form>"));
const formNames = new Set([...formHtml.matchAll(/\bname="([^"]+)"/g)].map((m) => m[1]).concat(GENERATED));
const rulePaths = Hoken.ValidationRules.fields.map((f) => f.path);

test("ルール表の項目はすべて画面に存在する", () => {
  const missing = rulePaths.filter((p) => !formNames.has(p));
  assert.deepEqual(missing, []);
});

test("画面の入力欄にはすべてルールがある", () => {
  const missing = [...formNames].filter((n) => !rulePaths.includes(n) && !NO_RULE.includes(n));
  assert.deepEqual(missing, []);
});

test("エラー表示欄（data-field）がすべてのルールに用意されている", () => {
  const slots = new Set([...formHtml.matchAll(/data-field="([^"]+)"/g)].map((m) => m[1]).concat(GENERATED));
  const paths = rulePaths.concat(Hoken.ValidationRules.checks.map((c) => c.path));
  assert.deepEqual(paths.filter((p) => !slots.has(p)), []);
});

test("ルール表の項目名は重複しない", () => {
  assert.equal(new Set(rulePaths).size, rulePaths.length);
});
