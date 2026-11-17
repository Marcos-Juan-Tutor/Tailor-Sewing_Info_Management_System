/* The left pane: the list of orders. */

import { els } from "../dom.js";
import { S, isDone } from "../state.js";
import { dayDiff, esc } from "../util.js";

function matches(o) {
  var q = S.query.trim().toLowerCase();
  if (q) {
    var hay = [o.no, o.customer.name, o.customer.phone, o.customer.email, o.item, o.type].join(" ").toLowerCase();
    if (hay.indexOf(q) < 0) return false;
  }
  var d = dayDiff(o.due);
  switch (S.filter) {
    case "active": return !o.cancelled && !isDone(o);
    case "soon": return !o.cancelled && !isDone(o) && d !== null && d <= 7;
    case "done": return !o.cancelled && isDone(o);
    case "cancelled": return !!o.cancelled;
    default: return true;
  }
}

/** Open work first, then finished, then cancelled. */
function rank(o) {
  return o.cancelled ? 2 : isDone(o) ? 1 : 0;
}

/** "Overdue 2 days", "Due today", "Due in 5 days", or the plain date. */
function dueLabel(o) {
  if (!o.due) return { t: "No due date", late: false };
  var d = dayDiff(o.due);
  if (o.cancelled || isDone(o)) return { t: o.due, late: false };
  if (d < 0) return { t: "Overdue " + (-d) + (d === -1 ? " day" : " days"), late: true };
  if (d === 0) return { t: "Due today", late: false };
  if (d === 1) return { t: "Due tomorrow", late: false };
  if (d <= 14) return { t: "Due in " + d + " days", late: false };
  return { t: "Due " + o.due, late: false };
}

function pillFor(o) {
  if (o.cancelled) return '<span class="pill" style="--c:var(--s-cancel)">Cancelled</span>';
  var c = o.status === "New" ? "var(--s-new)"
    : o.status === "Ready" ? "var(--s-ready)"
    : isDone(o) ? "var(--s-done)" : "var(--s-work)";
  return '<span class="pill" style="--c:' + c + '">' + esc(o.status) + "</span>";
}

export function renderList() {
  var all = Array.from(S.orders.values());
  var rows = all.filter(matches).sort(function (a, b) {
    var r = rank(a) - rank(b);
    if (r) return r;
    var da = a.due || "9999", db = b.due || "9999";
    if (da !== db) return da < db ? -1 : 1;
    return (b.updatedAt || 0) - (a.updatedAt || 0);
  });

  var html;
  if (!rows.length) {
    html = '<li class="empty">' + (!S.ready
      ? "Loading orders…"
      : all.length
        ? "No orders match this filter."
        : "No orders yet. Press “New order” to write down the first one.") + "</li>";
  } else {
    html = rows.map(function (o) {
      var dl = dueLabel(o);
      return '<li><button class="row' + (o.cancelled ? " is-cancelled" : "") + '" type="button" data-open="' + esc(o.id) + '" aria-current="' + (o.id === S.sel) + '">' +
        '<div class="row-1"><span class="row-name">' + esc(o.customer.name || "Unnamed customer") + (o.sample ? '<span class="tag">Sample</span>' : "") + '</span><span class="row-no">' + esc(o.no) + '</span></div>' +
        '<div class="row-2">' + esc(o.item || o.type) + (o.item ? " · " + esc(o.type) : "") + '</div>' +
        '<div class="row-3">' + pillFor(o) + '<span class="due' + (dl.late ? " late" : "") + '">' + esc(dl.t) + '</span></div></button></li>';
    }).join("");
  }

  /* Repainting an unchanged list would throw away the scroll position, so only
     touch the page when the rows really differ — and keep the scroll either way. */
  if (html !== S.listHTML) {
    var top = els.list.scrollTop;
    els.list.innerHTML = html;
    S.listHTML = html;
    els.list.scrollTop = top;
  }

  var n = all.filter(function (o) { return !o.cancelled && !isDone(o); }).length;
  var foot = S.ready ? (n + " active of " + all.length + " orders · saved automatically") : "Loading order book…";
  if (els.foot.textContent !== foot) els.foot.textContent = foot;
}
