/*
 * 画面制御: 入力の読み書き、エラー表示、保存・読み込み、申込書の生成
 */
(function () {
  "use strict";

  var STORAGE_KEY = "hoken-app.corp.drafts.v1";
  var FILE_FORMAT = "hoken-app-corp";
  var FILE_VERSION = 1;
  var Core = Hoken.Core;
  var R = Core.RATES;

  var form = document.getElementById("form");
  var $ = function (id) { return document.getElementById(id); };

  var current = { id: null, savedAt: null };
  var touched = {};      // 一度フォーカスを外した項目だけエラーを表示する
  var showAll = false;   // 「申込書を作成」押下後は全項目のエラーを表示する
  var dirty = false;

  // ---------- ユーティリティ ----------

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function yen(n) { return n.toLocaleString("ja-JP") + "円"; }
  function jpDate(s) {
    var d = Core.parseDate(s);
    return d ? d.y + "年" + d.m + "月" + d.d + "日" : "";
  }
  function pad(n) { return String(n).padStart(2, "0"); }
  function today() {
    var d = new Date();
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }
  function stamp(d) {
    return d.getFullYear() + "/" + pad(d.getMonth() + 1) + "/" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes());
  }
  function newId() {
    var d = new Date();
    return "AP-" + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "-" +
      pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }
  function labelOf(list, key, value) {
    var item = Core.find(list, key, value);
    return item ? item.label : "";
  }

  function getPath(obj, path) {
    return path.split(".").reduce(function (o, k) { return o == null ? undefined : o[k]; }, obj);
  }
  function setPath(obj, path, value) {
    var keys = path.split(".");
    var last = keys.pop();
    keys.forEach(function (k) { obj = obj[k] = obj[k] || {}; });
    obj[last] = value;
  }

  var toastTimer;
  function toast(msg) {
    var el = $("toast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, 3000);
  }

  // ---------- フォームとデータの相互変換 ----------

  function getData() {
    var data = {};
    form.querySelectorAll("[name]").forEach(function (el) {
      if (el.type === "radio") {
        if (el.checked) setPath(data, el.name, el.value);
        else if (getPath(data, el.name) === undefined) setPath(data, el.name, "");
      } else if (el.type === "checkbox") {
        setPath(data, el.name, el.checked);
      } else {
        setPath(data, el.name, el.value.trim());
      }
    });
    return data;
  }

  function setData(data) {
    form.querySelectorAll("[name]").forEach(function (el) {
      var v = getPath(data, el.name);
      if (el.type === "radio") el.checked = v === el.value;
      else if (el.type === "checkbox") el.checked = !!v;
      else if (v != null) el.value = v;
    });
    syncToggles();
  }

  function defaultData() {
    return {
      applyDate: today(),
      period: { start: today() },
      location: { same: true },
      coverage: { deductible: "0", liability: "10000", bi: false, biPeriod: "3" },
      payment: "lump",
    };
  }

  // ---------- 表示更新 ----------

  // data-show-if="チェックボックス名" の領域を表示・非表示し、非表示中は入力不可にする
  function syncToggles() {
    form.querySelectorAll("[data-show-if]").forEach(function (box) {
      var checked = form.elements[box.dataset.showIf].checked;
      var show = String(checked) === box.dataset.showValue;
      box.hidden = !show;
      box.querySelectorAll("input, select, textarea").forEach(function (el) { el.disabled = !show; });
    });
  }

  function refresh() {
    var data = getData();
    var result = Core.validate(data);
    renderErrors(result.errors);
    renderHints(data);
    renderPremium(Core.calcPremium(data));
    renderWarnings(result.warnings);
    return { data: data, result: result };
  }

  function renderErrors(errors) {
    form.querySelectorAll(".field[data-field]").forEach(function (f) {
      var path = f.dataset.field;
      var msg = (showAll || touched[path]) ? errors[path] : "";
      f.classList.toggle("invalid", !!msg);
      f.querySelector(".err").textContent = msg || "";
    });

    var count = Object.keys(errors).length;
    $("error-summary").innerHTML = showAll && count
      ? '<p class="error-box">未入力・誤りが ' + count + ' 件あります。赤字の項目を確認してください。</p>'
      : "";
  }

  function renderHints(data) {
    var start = getPath(data, "period.start");
    var end = Core.addYears(start, 1);
    $("period-hint").textContent = end ? "保険期間: " + jpDate(start) + " 〜 " + jpDate(end) + "（1年間）" : "";

    form.querySelectorAll("[data-man-of]").forEach(function (el) {
      var n = Core.toInt(getPath(data, el.dataset.manOf));
      el.textContent = n > 0 ? "= " + Core.formatMan(n) : "";
    });
  }

  function renderPremium(p) {
    var el = $("premium");
    if (!p.ok) {
      el.innerHTML = '<p class="muted">' + esc(p.reason) + "</p>";
      return;
    }
    var rows = p.items.map(function (it) {
      return "<tr><th>" + esc(it.group) + "（" + esc(it.label) + "）</th><td>" + yen(it.premium) + "</td></tr>";
    }).join("");
    p.adjustments.forEach(function (a) {
      rows += "<tr><th>" + esc(a.label) + "</th><td>" + yen(a.amount) + "</td></tr>";
    });
    var html =
      '<p class="muted">' + esc(p.industry.label) + "</p>" +
      '<table class="premium-table">' + rows + "</table>" +
      '<div class="premium-total"><span>年間保険料</span><strong>' + yen(p.annual) + "</strong></div>";
    if (p.payment && p.payment.times > 1) {
      html += '<p class="installment">' + esc(p.payment.label) + ": 1回 <strong>" + yen(p.perPayment) + "</strong>" +
        "（総額 " + yen(p.totalPaid) + "）</p>";
    }
    el.innerHTML = html;
  }

  function renderWarnings(warnings) {
    $("warnings").innerHTML = warnings.map(function (w) {
      return '<p class="warn-box">' + esc(w) + "</p>";
    }).join("");
  }

  function renderStatus() {
    $("app-no").textContent = current.id || "（未保存）";
    $("saved-at").textContent = current.savedAt ? "最終保存: " + stamp(new Date(current.savedAt)) : "";
  }

  // ---------- 一時保存（ブラウザ内: localStorage） ----------

  function loadDrafts() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function storeDrafts(drafts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  }

  function save() {
    var data = getData();
    var id = current.id || newId();
    var savedAt = new Date().toISOString();
    try {
      var drafts = loadDrafts();
      drafts[id] = { id: id, savedAt: savedAt, name: getPath(data, "policyholder.corpName") || "", data: data };
      storeDrafts(drafts);
    } catch (e) {
      alert("このブラウザでは一時保存が使えません。「ファイルに書き出し」で保存してください。\n(" + e.message + ")");
      return false;
    }
    current = { id: id, savedAt: savedAt };
    dirty = false;
    renderStatus();
    toast("一時保存しました（" + id + "）");
    return true;
  }

  function openDraft(id) {
    var d = loadDrafts()[id];
    if (!d) return;
    load(d.data, d.id, d.savedAt);
    $("open-dialog").close();
    toast("読み込みました（" + id + "）");
  }

  function deleteDraft(id) {
    if (!confirm(id + " を削除します。よろしいですか？")) return;
    var drafts = loadDrafts();
    delete drafts[id];
    storeDrafts(drafts);
    renderDraftList();
  }

  function renderDraftList() {
    var list = Object.values(loadDrafts()).sort(function (a, b) { return a.savedAt < b.savedAt ? 1 : -1; });
    $("draft-list").innerHTML = list.length
      ? '<table class="draft-table"><thead><tr><th>申込番号</th><th>契約者</th><th>保存日時</th><th></th></tr></thead><tbody>' +
        list.map(function (d) {
          return "<tr><td>" + esc(d.id) + "</td><td>" + esc(d.name || "（未入力）") + "</td><td>" + stamp(new Date(d.savedAt)) +
            '</td><td class="actions"><button type="button" data-open="' + esc(d.id) + '">開く</button>' +
            '<button type="button" class="danger" data-delete="' + esc(d.id) + '">削除</button></td></tr>';
        }).join("") + "</tbody></table>"
      : '<p class="muted">保存データはありません。</p>';
  }

  // ---------- ファイル書き出し・読み込み（JSON） ----------

  function exportFile() {
    var payload = {
      format: FILE_FORMAT,
      version: FILE_VERSION,
      id: current.id,
      savedAt: new Date().toISOString(),
      data: getData(),
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = (current.id || "申込データ_" + today()) + ".json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    dirty = false;
    toast("ファイルに書き出しました");
  }

  function importFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var obj;
      try {
        obj = JSON.parse(reader.result);
      } catch (e) {
        alert("ファイルを読み込めませんでした（JSON形式ではありません）");
        return;
      }
      if (!obj || obj.format !== FILE_FORMAT || typeof obj.data !== "object") {
        alert("このアプリで書き出したファイルではありません");
        return;
      }
      load(obj.data, obj.id || null, null);
      toast("ファイルを読み込みました");
    };
    reader.readAsText(file, "utf-8");
  }

  function load(data, id, savedAt) {
    form.reset();
    setData(data);
    current = { id: id, savedAt: savedAt };
    touched = {};
    showAll = false;
    dirty = false;
    renderStatus();
    refresh();
  }

  function confirmDiscard() {
    return !dirty || confirm("保存していない変更があります。破棄してよろしいですか？");
  }

  // ---------- 申込書 ----------

  function generate() {
    showAll = true;
    var r = refresh();
    if (Object.keys(r.result.errors).length) {
      var first = form.querySelector(".field.invalid");
      if (first) {
        first.scrollIntoView({ behavior: "smooth", block: "center" });
        var input = first.querySelector("input:not([type=radio]), select, textarea, input");
        if (input) input.focus({ preventScroll: true });
      }
      return;
    }
    // 申込番号を確定させるため、申込書作成時に保存する（保存できなくても作成は続行）
    if (dirty || !current.id) save();
    if (!current.id) current.id = newId();
    renderStatus();

    $("sheet").innerHTML = buildSheet(r.data, Core.calcPremium(r.data), r.result.warnings);
    $("preview").hidden = false;
    document.body.classList.add("previewing");
    window.scrollTo(0, 0);
  }

  function closePreview() {
    $("preview").hidden = true;
    document.body.classList.remove("previewing");
  }

  function buildSheet(d, p, warnings) {
    var ph = d.policyholder;
    var biz = d.business;
    var loc = d.location;
    var cv = d.coverage;
    var ds = d.disclosure;

    function row(label, value) {
      return "<tr><th>" + label + "</th><td>" + value + "</td></tr>";
    }
    function num(v, unit) {
      var n = Core.toInt(v);
      return n > 0 ? n.toLocaleString() + unit : "—";
    }

    var locText = loc.same
      ? "契約者の所在地と同じ"
      : "〒" + esc(loc.zip) + "<br>" + esc(loc.address);

    var coverageRows = p.items.map(function (it) {
      return "<tr><td>" + esc(it.group) + "</td><td>" + esc(it.label) + "</td><td>" + esc(it.limit) +
        '</td><td class="num">' + yen(it.premium) + "</td></tr>";
    }).join("");
    p.adjustments.forEach(function (a) {
      coverageRows += '<tr><td colspan="3">' + esc(a.label) + '</td><td class="num">' + yen(a.amount) + "</td></tr>";
    });

    var propertyNote = Core.toInt(cv.building) + Core.toInt(cv.equipment) + Core.toInt(cv.stock) > 0
      ? "財物補償の免責金額: " + esc(labelOf(R.deductibles, "value", cv.deductible))
      : "";

    var qRows = Core.DISCLOSURE_QUESTIONS.map(function (q, i) {
      var a = ds[q.key];
      return "<tr><td>" + (i + 1) + ". " + esc(q.text) + '</td><td class="answer">' +
        '<span class="' + (a === "yes" ? "circled" : "") + '">はい</span>・' +
        '<span class="' + (a === "no" ? "circled" : "") + '">いいえ</span></td></tr>';
    }).join("");
    var extra = [];
    if (ds.q1 === "yes") extra.push("事故件数: " + esc(ds.accidents) + "件");
    if (ds.detail) extra.push("詳細: " + esc(ds.detail));

    return (
      '<div class="sheet-head">' +
        "<h1>" + esc(R.productName.replace(/（.*）/, "")) + " 申込書</h1>" +
        '<table class="meta"><tr><th>申込番号</th><td>' + esc(current.id) + "</td></tr>" +
        "<tr><th>申込日</th><td>" + esc(jpDate(d.applyDate)) + "</td></tr></table>" +
      "</div>" +
      '<p class="lead">当社は、重要事項説明書・約款の内容を確認・了承のうえ、下記のとおり保険契約を申し込みます。</p>' +

      "<h3>契約者（法人）</h3>" +
      '<div class="cols"><table class="form">' +
          row("フリガナ", esc(ph.corpKana)) +
          row("法人名", '<span class="name">' + esc(ph.corpName) + "</span>") +
          row("法人番号", esc(ph.corpNumber)) +
          row("代表者", esc(ph.repTitle) + "　" + esc(ph.repName)) +
        '</table><table class="form">' +
          row("所在地", "〒" + esc(ph.zip) + "<br>" + esc(ph.address)) +
          row("電話番号", esc(ph.tel)) +
          row("ご担当者", (esc(ph.contactName) || "—") + (ph.email ? "<br>" + esc(ph.email) : "")) +
      "</table></div>" +

      "<h3>事業内容・保険の対象</h3>" +
      '<div class="cols"><table class="form">' +
          row("業種", esc(p.industry.label)) +
          row("年間売上高", Core.toInt(biz.sales) > 0 ? esc(Core.formatMan(Core.toInt(biz.sales))) : "—") +
          row("従業員数", num(biz.employees, "人")) +
        '</table><table class="form">' +
          row("所在地", locText) +
          row("構造級別", esc(labelOf(R.structures, "value", loc.structure)) || "—") +
          row("建築年", num(loc.builtYear, "年").replace(/,/g, "")) +
      "</table></div>" +

      "<h3>保険期間・補償内容</h3>" +
      '<table class="form"><tr><th>保険期間</th><td>' +
        esc(jpDate(d.period.start)) + " 午後4時 から " + esc(jpDate(Core.addYears(d.period.start, 1))) + " 午後4時 まで（1年間）" +
      "</td></tr></table>" +
      '<table class="form coverage"><thead><tr><th>補償</th><th>保険の対象・内容</th><th>保険金額・支払限度額</th><th>年間保険料</th></tr></thead><tbody>' +
        coverageRows +
        '<tr class="total"><td colspan="3">年間保険料 合計</td><td class="num">' + yen(p.annual) + "</td></tr>" +
      "</tbody></table>" +
      '<table class="form"><tr><th>払込方法</th><td>' + esc(p.payment.label) +
        (p.payment.times > 1 ? "　1回あたり " + yen(p.perPayment) + " × " + p.payment.times + "回（総額 " + yen(p.totalPaid) + "）" : "　" + yen(p.perPayment)) +
      "</td></tr></table>" +
      (propertyNote ? '<p class="note">' + propertyNote + "</p>" : "") +

      "<h3>告知</h3>" +
      '<table class="form disclosure">' + qRows +
        (extra.length ? '<tr><td colspan="2">' + extra.join("<br>") + "</td></tr>" : "") +
      "</table>" +
      (warnings.length ? '<p class="note">※ ' + warnings.map(esc).join(" ") + "</p>" : "") +

      '<table class="signs"><tr>' +
        "<td><div>契約者 記名・押印（代表者印）</div></td>" +
        "<td><div>取扱代理店 記名・押印</div></td>" +
        "<td><div>受付印</div></td>" +
      "</tr></table>" +

      '<p class="foot">料率版: ' + esc(R.version) + "　作成日時: " + esc(stamp(new Date())) + "　※本書はサンプルアプリで作成した見本です。</p>"
    );
  }

  // ---------- 初期化 ----------

  function init() {
    // 選択肢・告知質問は rates.js / core.js の定義から生成する
    form.querySelectorAll("select[data-options]").forEach(function (sel) {
      sel.insertAdjacentHTML("beforeend", R[sel.dataset.options].map(function (o) {
        var v = o.value != null ? o.value : o.code;
        return '<option value="' + esc(v) + '">' + esc(o.label) + "</option>";
      }).join(""));
    });
    $("payment-radios").innerHTML = Object.keys(R.payment).map(function (k) {
      var pm = R.payment[k];
      var note = pm.times > 1 ? "（年間保険料の" + ((pm.num * pm.times * 100) / pm.den - 100) + "%増）" : "";
      return '<label><input type="radio" name="payment" value="' + k + '">' + esc(pm.label) + esc(note) + "</label>";
    }).join("");
    $("disclosure-questions").innerHTML = Core.DISCLOSURE_QUESTIONS.map(function (q, i) {
      var name = "disclosure." + q.key;
      return '<div class="field question" data-field="' + name + '">' +
        "<label>" + (i + 1) + ". " + esc(q.text) + '<span class="req">必須</span></label>' +
        '<div class="radios">' +
          '<label><input type="radio" name="' + name + '" value="yes">はい</label>' +
          '<label><input type="radio" name="' + name + '" value="no">いいえ</label>' +
        "</div><p class=\"err\"></p></div>";
    }).join("");
    $("rate-version").textContent = R.version;

    form.addEventListener("input", function () { dirty = true; refresh(); });
    form.addEventListener("change", function (e) {
      dirty = true;
      if (e.target.type === "checkbox") syncToggles();
      if (e.target.type === "radio" || e.target.tagName === "SELECT") touched[e.target.name] = true;
      refresh();
    });
    form.addEventListener("focusout", function (e) {
      if (e.target.name) {
        touched[e.target.name] = true;
        refresh();
      }
    });

    $("btn-new").onclick = function () {
      if (confirmDiscard()) load(defaultData(), null, null);
    };
    $("btn-save").onclick = save;
    $("btn-open").onclick = function () {
      renderDraftList();
      $("open-dialog").showModal();
    };
    $("btn-dialog-close").onclick = function () { $("open-dialog").close(); };
    $("draft-list").onclick = function (e) {
      var t = e.target;
      if (t.dataset.open) {
        if (confirmDiscard()) openDraft(t.dataset.open);
      } else if (t.dataset.delete) {
        deleteDraft(t.dataset.delete);
      }
    };
    $("btn-export").onclick = exportFile;
    $("file-import").onchange = function (e) {
      var file = e.target.files[0];
      e.target.value = "";
      if (file && confirmDiscard()) importFile(file);
    };
    $("btn-generate").onclick = generate;
    $("btn-print").onclick = function () { window.print(); };
    $("btn-close").onclick = closePreview;

    window.addEventListener("beforeunload", function (e) {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    });

    load(defaultData(), null, null);
  }

  init();
})();
