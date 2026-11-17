/* The right pane: one order on a sheet. */

import { BODY_TYPES, STATUSES, TYPES } from "../config.js";
import { els } from "../dom.js";
import { S, cur, totals } from "../state.js";
import { esc, money, num } from "../util.js";

function price(n) {
  return money(n, S.currency);
}

/** A labelled text field. */
function field(label, path, val, opts) {
  opts = opts || {};
  return '<label class="f' + (opts.full ? " full" : "") + '">' + label +
    (opts.area
      ? '<textarea data-f="' + path + '" rows="' + (opts.rows || 3) + '" placeholder="' + esc(opts.ph || "") + '">' + esc(val) + "</textarea>"
      : '<input data-f="' + path + '" type="' + (opts.type || "text") + '" value="' + esc(val) + '" placeholder="' + esc(opts.ph || "") + '"' +
        (opts.inputmode ? ' inputmode="' + opts.inputmode + '"' : "") +
        (opts.step ? ' step="' + opts.step + '"' : "") + ">") +
    "</label>";
}

/** Swap the sheet's content without losing where the reader had scrolled to. */
function paintDetail(html) {
  var top = els.detail.scrollTop;
  els.detail.innerHTML = html;
  els.detail.scrollTop = top;
}

export function renderDetail() {
  var o = cur();
  if (!o) {
    paintDetail('<div class="placeholder"><div class="tape" aria-hidden="true"></div><b>Pick an order or start a new one</b>' +
      "<span>Each order keeps the customer, measurements, adjustments, materials, price and due date on one sheet.</span></div>");
    return;
  }
  S.armed = false;
  var stIdx = STATUSES.indexOf(o.status);
  var t = totals(o);

  var steps = STATUSES.map(function (s, i) {
    return '<button type="button" class="step' + (i < stIdx ? " done" : "") + (i === stIdx ? " now" : "") +
      '" data-act="status" data-v="' + s + '" aria-pressed="' + (i === stIdx) + '">' + s + "</button>";
  }).join("");

  var mrows = o.measures.map(function (m, i) {
    return '<div class="mrow"><input class="lab" data-arr="measures" data-i="' + i + '" data-k="label" value="' + esc(m.label) + '" aria-label="Measurement name">' +
      '<input class="val" data-arr="measures" data-i="' + i + '" data-k="value" data-num="1" inputmode="decimal" value="' + esc(m.value) + '" placeholder="' + o.unit + '" aria-label="' + esc(m.label) + " in " + o.unit + '">' +
      '<button class="x" type="button" data-act="rm-measure" data-i="' + i + '" aria-label="Remove ' + esc(m.label) + '">×</button></div>';
  }).join("");

  var mats = o.materials.map(function (m, i) {
    return '<div class="mat"><input data-arr="materials" data-i="' + i + '" data-k="name" value="' + esc(m.name) + '" placeholder="e.g. Cotton twill, navy" aria-label="Material">' +
      '<input class="num" data-arr="materials" data-i="' + i + '" data-k="qty" value="' + esc(m.qty) + '" placeholder="2 m" aria-label="Quantity">' +
      '<input class="num" data-arr="materials" data-i="' + i + '" data-k="cost" data-num="1" type="number" min="0" step="any" inputmode="decimal" value="' + (num(m.cost) ? num(m.cost) : "") + '" placeholder="0.00" aria-label="Cost">' +
      '<button class="x" type="button" data-act="rm-mat" data-i="' + i + '" aria-label="Remove material">×</button></div>';
  }).join("");

  paintDetail('<div class="sheet' + (o.cancelled ? " cancelled" : "") + '">' +
    '<div class="dhead"><button class="btn small back" type="button" data-act="back">← Orders</button><span class="no">' + esc(o.no) + " · received " + esc(o.createdAt) + '</span><span class="sp"></span>' +
      '<button class="switch" type="button" role="switch" aria-checked="' + o.cancelled + '" data-act="toggle-cancel"><span class="track"></span>Cancelled by customer</button></div>' +
    (o.cancelled ? '<div class="banner">Cancelled by the customer' + (o.cancelledAt ? " on " + esc(o.cancelledAt) : "") + ". Switch it off to reopen the order.</div>" : "") +

    '<section><h2>Customer</h2><div class="grid">' +
      field("Name", "customer.name", o.customer.name, { full: true, ph: "Full name" }) +
      field("Phone", "customer.phone", o.customer.phone, { type: "tel", ph: "Mobile number" }) +
      field("Email", "customer.email", o.customer.email, { type: "email", ph: "Optional" }) +
      field("Address", "customer.address", o.customer.address, { full: true, area: true, rows: 2, ph: "Street, city" }) +
    "</div></section>" +

    '<section><h2>Item</h2><div class="grid">' +
      '<label class="f full">Item<input class="title-in" data-f="item" value="' + esc(o.item) + '" placeholder="e.g. Graduation gown, 2 school uniform sets, living room curtains"></label>' +
      '<label class="f">Type of tailoring<select data-f="type" id="typeSel">' +
        TYPES.map(function (x) { return "<option" + (x === o.type ? " selected" : "") + ">" + x + "</option>"; }).join("") +
      "</select></label>" +
      field("Due date", "due", o.due, { type: "date" }) +
    "</div></section>" +

    '<section><h2>Progress</h2><div class="steps">' + steps + "</div></section>" +

    '<section><div class="sec-h"><h2>Measurements</h2><div class="seg" role="group" aria-label="Unit">' +
      '<button type="button" data-act="unit" data-v="cm" aria-pressed="' + (o.unit === "cm") + '">cm</button>' +
      '<button type="button" data-act="unit" data-v="in" aria-pressed="' + (o.unit === "in") + '">in</button></div></div>' +
      '<div class="mrows">' + (mrows || '<span style="color:var(--muted)">No measurements yet.</span>') + "</div>" +
      '<div class="btnrow"><button class="btn small" type="button" data-act="add-measure">+ Add measurement</button>' +
      '<button class="btn small ghost" type="button" data-act="fill">Use standard ' + (BODY_TYPES.indexOf(o.type) >= 0 ? "body" : "window and home") + " fields</button></div></section>" +

    '<section><h2>Adjustment requests</h2>' +
      field("", "adjustments", o.adjustments, { full: true, area: true, rows: 4, ph: "Shorten hem by 2 cm, add pockets, loosen waist, lining colour…" })
        .replace('class="f full"', 'class="f"') +
    "</section>" +

    '<section><h2>Materials needed</h2>' +
      (o.materials.length ? '<div class="mat mat-h"><span>Material</span><span style="text-align:right">Qty</span><span style="text-align:right">Cost</span><span></span></div>' : "") +
      mats +
      '<div class="btnrow"><button class="btn small" type="button" data-act="add-mat">+ Add material</button></div></section>' +

    '<section><h2>Price</h2><div class="money">' +
      '<label class="f">Tailoring fee<input data-f="fee" type="number" min="0" step="any" inputmode="decimal" value="' + (num(o.fee) ? num(o.fee) : "") + '" placeholder="0.00"></label>' +
      '<label class="f">Deposit paid<input data-f="deposit" type="number" min="0" step="any" inputmode="decimal" value="' + (num(o.deposit) ? num(o.deposit) : "") + '" placeholder="0.00"></label>' +
      '<div class="sum">' +
        "<div><span>Tailoring fee</span><span id=\"t-fee\">" + price(num(o.fee)) + "</span></div>" +
        "<div><span>Materials</span><span id=\"t-mat\">" + price(t.mat) + "</span></div>" +
        "<div><span>Total</span><span id=\"t-total\">" + price(t.total) + "</span></div>" +
        "<div><span>Deposit paid</span><span id=\"t-dep\">−" + price(num(o.deposit)) + "</span></div>" +
        '<div class="bal"><span>Balance due</span><span id="t-bal">' + price(t.bal) + "</span></div>" +
      "</div></div></section>" +

    '<div><button class="btn danger" type="button" data-act="delete" id="delBtn">Delete order</button></div></div>');
}

/** Refresh just the money lines while the user types a fee or a cost. */
export function updateTotals() {
  var o = cur();
  if (!o) return;
  var t = totals(o);
  var g = function (i) { return document.getElementById(i); };
  if (!g("t-bal")) return;
  g("t-fee").textContent = price(num(o.fee));
  g("t-mat").textContent = price(t.mat);
  g("t-total").textContent = price(t.total);
  g("t-dep").textContent = "−" + price(num(o.deposit));
  g("t-bal").textContent = price(t.bal);
}
