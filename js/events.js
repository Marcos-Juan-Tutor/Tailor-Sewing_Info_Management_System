/* Every click and keystroke the page reacts to. */

import { els } from "./dom.js";
import { store } from "./api.js";
import { S, blank, cur, template, totals } from "./state.js";
import { num, todayStr, toast } from "./util.js";
import { removeOrder, schedule, touch } from "./sync.js";
import { renderChips } from "./views/chips.js";
import { renderDetail, updateTotals } from "./views/detail.js";
import { renderList } from "./views/list.js";

/** Write a value at "customer.name" or "fee". */
function setPath(o, path, v) {
  var parts = path.split(".");
  var target = o;
  for (var i = 0; i < parts.length - 1; i++) target = target[parts[i]];
  target[parts[parts.length - 1]] = v;
}

export function bindEvents() {
  /* ---- the order sheet ---- */
  els.detail.addEventListener("input", function (e) {
    var t = e.target;
    var o = cur();
    if (!o) return;

    if (t.dataset.f) {
      var v = t.type === "number" ? num(t.value) : t.value;
      setPath(o, t.dataset.f, v);
      if (t.dataset.f === "type") {
        /* Changing the type swaps the standard measurement list, unless the shop
           has already written values in. */
        if (o.measures.every(function (m) { return !String(m.value).trim(); })) o.measures = template(o.type);
        touch(o);
        renderDetail();
        return;
      }
      touch(o);
      updateTotals();
    } else if (t.dataset.arr) {
      var row = o[t.dataset.arr][+t.dataset.i];
      if (!row) return;
      row[t.dataset.k] = t.dataset.num && t.type === "number" ? num(t.value) : t.value;
      touch(o);
      updateTotals();
    }
  });

  els.detail.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (!b) return;
    var o = cur();
    var a = b.dataset.act;
    if (!o && a !== "back") return;

    if (a === "back") {
      els.app.dataset.view = "list";
      return;
    }
    if (a === "status") {
      o.status = b.dataset.v;
      touch(o, true);
      renderDetail();
      return;
    }
    if (a === "toggle-cancel") {
      o.cancelled = !o.cancelled;
      o.cancelledAt = o.cancelled ? todayStr() : "";
      touch(o, true);
      renderDetail();
      return;
    }
    if (a === "unit") {
      var u = b.dataset.v;
      if (u === o.unit) return;
      /* Convert the numbers already written; panels and counts stay as they are. */
      var k = u === "in" ? 1 / 2.54 : 2.54;
      o.measures.forEach(function (m) {
        if (/panel/i.test(m.label)) return;
        var n = parseFloat(m.value);
        if (isFinite(n)) m.value = String(Math.round(n * k * 10) / 10);
      });
      o.unit = u;
      touch(o, true);
      renderDetail();
      return;
    }
    if (a === "add-measure") {
      o.measures.push({ label: "", value: "" });
      touch(o);
      renderDetail();
      var ls = els.detail.querySelectorAll(".mrow .lab");
      if (ls.length) ls[ls.length - 1].focus();
      return;
    }
    if (a === "rm-measure") {
      o.measures.splice(+b.dataset.i, 1);
      touch(o, true);
      renderDetail();
      return;
    }
    if (a === "fill") {
      var have = o.measures.map(function (m) { return m.label.toLowerCase(); });
      template(o.type).forEach(function (m) {
        if (have.indexOf(m.label.toLowerCase()) < 0) o.measures.push(m);
      });
      touch(o, true);
      renderDetail();
      return;
    }
    if (a === "add-mat") {
      o.materials.push({ name: "", qty: "", cost: 0 });
      touch(o);
      renderDetail();
      var ms = els.detail.querySelectorAll('.mat input[data-k="name"]');
      if (ms.length) ms[ms.length - 1].focus();
      return;
    }
    if (a === "rm-mat") {
      o.materials.splice(+b.dataset.i, 1);
      touch(o, true);
      renderDetail();
      return;
    }
    if (a === "delete") {
      /* Two presses, so a slip of the finger cannot erase an order. */
      if (!S.armed) {
        S.armed = true;
        b.textContent = "Press again to delete";
        b.classList.add("armed");
        setTimeout(function () {
          if (S.armed && document.body.contains(b)) {
            S.armed = false;
            b.textContent = "Delete order";
            b.classList.remove("armed");
          }
        }, 3500);
        return;
      }
      var id = o.id;
      S.sel = null;
      removeOrder(id);
      els.app.dataset.view = "list";
      renderDetail();
      renderList();
      toast("Order deleted");
    }
  });

  /* ---- the list, filters and search ---- */
  els.list.addEventListener("click", function (e) {
    var b = e.target.closest("[data-open]");
    if (!b) return;
    S.sel = b.dataset.open;
    els.app.dataset.view = "detail";
    renderDetail();
    renderList();
    els.detail.scrollTop = 0;
  });

  els.chips.addEventListener("click", function (e) {
    var b = e.target.closest("[data-filter]");
    if (!b) return;
    S.filter = b.dataset.filter;
    renderChips();
    renderList();
  });

  els.search.addEventListener("input", function () {
    S.query = els.search.value;
    renderList();
  });

  /* ---- new order ---- */
  els.newOrder.addEventListener("click", function () {
    if (!S.ready) {
      toast("Still loading, try again in a moment");
      return;
    }
    var o = blank();
    S.orders.set(o.id, o);
    S.sel = o.id;
    if (S.filter === "cancelled" || S.filter === "done") S.filter = "active";
    schedule(o.id, true);
    renderChips();
    renderDetail();
    renderList();
    els.app.dataset.view = "detail";
    els.detail.scrollTop = 0;
    var f = els.detail.querySelector('[data-f="customer.name"]');
    if (f) f.focus();
  });

  /* ---- currency symbol ---- */
  els.currency.addEventListener("input", function () {
    S.currency = els.currency.value || "$";
    updateTotals();
    renderList();
    clearTimeout(els.currency.t);
    els.currency.t = setTimeout(function () {
      store.saveSettings({ currency: S.currency }).catch(function () {});
    }, 600);
  });

  /* ---- export ---- */
  els.exportCsv.addEventListener("click", function () {
    var rows = Array.from(S.orders.values());
    if (!rows.length) {
      toast("No orders to export yet");
      return;
    }
    var q = function (v) { return '"' + String(v == null ? "" : v).replace(/"/g, '""') + '"'; };
    var head = ["Order", "Received", "Due", "Status", "Cancelled", "Customer", "Phone", "Email", "Address",
      "Type", "Item", "Unit", "Measurements", "Adjustments", "Materials", "Fee", "Materials cost", "Total", "Deposit", "Balance"];
    var lines = [head.map(q).join(",")];

    rows.sort(function (a, b) { return String(a.no).localeCompare(String(b.no)); }).forEach(function (o) {
      var t = totals(o);
      lines.push([
        o.no, o.createdAt, o.due, o.status, o.cancelled ? "Yes" : "No",
        o.customer.name, o.customer.phone, o.customer.email, o.customer.address, o.type, o.item, o.unit,
        o.measures.filter(function (m) { return m.label || m.value; })
          .map(function (m) { return m.label + " " + m.value; }).join("; "),
        o.adjustments,
        o.materials.map(function (m) { return m.name + (m.qty ? " (" + m.qty + ")" : "") + (num(m.cost) ? " " + num(m.cost) : ""); }).join("; "),
        num(o.fee), t.mat, t.total, num(o.deposit), t.bal
      ].map(q).join(","));
    });

    /* A leading BOM makes Excel read the file as UTF-8. */
    var blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "tailor-orders-" + todayStr() + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast("Orders exported");
  });
}
