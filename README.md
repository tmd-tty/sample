# 事業総合保険 設計・申込書作成（オフライン版）

企業向け損害保険（財物・賠償責任・休業補償のパッケージ型）の設計と申込書作成を行うサンプルアプリです。
インターネット接続・インストール不要。`index.html` をブラウザ（Chrome / Edge / Safari）で開くだけで動作します。

## 機能
- 入力チェック（必須・形式・補償に応じた必須項目・引受審査の警告）
- 保険料計算（入力に合わせてリアルタイム表示）
- 申込書の生成（A4 1枚。印刷ダイアログの「PDFに保存」でPDF化）
- 一時保存（ブラウザ内）と、JSONファイルへの書き出し・読み込み

## 構成

```
index.html              入力画面（読み込むスクリプトの順序もここで決まる）
css/style.css           画面と申込書（印刷）のレイアウト
js/
  master/
    rates.js            料率・選択肢・上限値 ……………… 料率改定・選択肢の追加
    questions.js        告知の質問 ……………………………… 質問の追加・文言変更
  rules/
    facts.js            入力から導出する値 ………………… 「付帯しているか」等の判定
    validation.js       入力チェックのルール表 …………… チェックの追加・変更
    premium.js          保険料計算のルール表 ……………… 計算式の追加・変更
  lib/
    checks.js           入力チェックの部品（必須・整数・形式など）
    util.js             日付・数値などの汎用関数
  core.js               ルール実行エンジン（通常は編集不要）
  app.js                画面制御・保存・申込書の生成
tests/
  core.test.js          チェック・計算のテスト
  rules.test.js         ルール表と画面の入力欄の整合性テスト
  load.js               テスト用の読み込み（index.html と同じ順序）
```

テストの実行: `node --test`

## 編集ガイド

### 入力チェックを変える（`js/rules/validation.js`）
項目ごとに、チェック部品を左から順に並べます。最初に引っかかったものがエラーとして表示されます。

```js
{ path: "policyholder.repName", label: "代表者氏名", rules: [C.required(), C.maxLength(30)] },
```

条件付きでチェックする場合は `when`、条件付き必須は `C.requiredIf` を使います。

```js
{ path: "coverage.biDaily", label: "支払限度日額", when: (f) => f.hasBI,
  rules: [C.required(), C.integer({ min: 1, max: L.biDailyMax, unit: "万円" })] },
```

使える部品（`js/lib/checks.js`）:
`required` `requiredIf` `choice` `maxLength` `pattern` `kana` `zip` `tel` `email` `integer` `date` `corporateNumber` `custom`

引受審査の警告は同じファイルの `underwriting` に、`when`（条件）と `message` を追加します。

### 保険料の計算式を変える（`js/rules/premium.js`）
補償ごとに `applies`（計算するか）・`needs`（必要な入力）・`calc`（計算式）を持ちます。
補償を追加すると、画面の内訳と申込書に自動で行が増えます。割増引は `adjustments` に追加します。

### 新しい入力項目を追加する
1. `index.html` に入力欄（`name`）とエラー表示欄（`data-field`）を追加
2. `js/rules/validation.js` にルールを追加
3. 計算で使う場合は `js/rules/facts.js` に導出値を追加し、`js/rules/premium.js` で参照
4. `node --test` を実行（ルールの書き忘れや項目名の不一致は `rules.test.js` が検出）

新しい `.js` ファイルを追加した場合は、`index.html` の `<script>` に追加してください（テストも同じ順序で読み込みます）。

## 注意
- 一時保存はブラウザごと・PCごとに別になります。確実に残す・別PCへ移す場合は「ファイルに書き出し」を使ってください。
- ES Modules や fetch は `file://` で動かないため使っていません（通常の `<script>` 読み込みのみ）。
