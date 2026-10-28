/* Small helpers with no knowledge of orders or of the page layout. */

import { els } from "./dom.js";

/** Escape text that goes into HTML, including inside attributes. */
export function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/** A number, or 0 for anything that is not one. */
export function num(v) {
  var n = parseFloat(v);
  return isFinite(n) ? n : 0;
}

/** 6500 -> "$6,500.00" */
export function money(n, symbol) {
  return symbol + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Today as Y-m-d in the shop's own time zone. */
export function todayStr() {
  var d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

/** Whole days from today to a Y-m-d date. Negative means overdue. */
export function dayDiff(s) {
  if (!s) return null;
  var a = new Date(s + "T00:00:00");
  var b = new Date(todayStr() + "T00:00:00");
  return Math.round((a - b) / 864e5);
}

/** JSON with sorted keys, so two equal copies always produce the same text. */
export function canon(o) {
  return JSON.stringify(o, function (k, v) {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      var r = {};
      Object.keys(v).sort().forEach(function (x) { r[x] = v[x]; });
      return r;
    }
    return v;
  });
}

export function clone(o) {
  return JSON.parse(JSON.stringify(o));
}

/** An order minus the moment it was last written: copies that differ only in
    that timestamp are the same order, so there is nothing to redraw for them. */
export function sig(o) {
  if (!o) return null;
  var c = clone(o);
  delete c.updatedAt;
  return canon(c);
}

/** A short message at the bottom of the screen. */
export function toast(msg) {
  els.toast.textContent = msg;
  els.toast.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(function () { els.toast.hidden = true; }, 2600);
}
