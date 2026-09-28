// index.html の <script src> と同じ順序でロジックを読み込み、Hoken 名前空間を返す（app.js＝画面制御は除く）
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)]
  .map((m) => m[1])
  .filter((src) => src !== "js/app.js");

for (const src of scripts) {
  vm.runInThisContext(fs.readFileSync(path.join(ROOT, src), "utf8"), { filename: src });
}

module.exports = { Hoken: globalThis.Hoken, html };
