/* Saving, deleting and keeping in step with the server.
   Typing is batched, then written in order, and the page re-reads the book
   every POLL_MS so a second tab or device stays in step. */

import { POLL_MS, SAVE_DELAY_MS } from "./config.js";
import { els } from "./dom.js";
import { store } from "./api.js";
import { S, cur } from "./state.js";
import { clone, sig, toast } from "./util.js";
import { renderDetail } from "./views/detail.js";
import { renderList } from "./views/list.js";

var timers = {};    // id -> pending debounce
var inflight = {};  // id -> number of writes in flight
var chains = {};    // id -> promise, so writes to one order stay in order
var gone = {};      // ids deleted here, ignored if still in a poll reply

/** True while an order has a save waiting or running. */
export function busy(id) {
  return !!timers[id] || (inflight[id] || 0) > 0;
}

function queueSave(id) {
  var o = S.orders.get(id);
  if (!o) return;
  var snap = clone(o);
  inflight[id] = (inflight[id] || 0) + 1;
  chains[id] = (chains[id] || Promise.resolve())
    .then(function () { return store.saveOrder(snap); })
    .then(function (saved) {
      /* The server may pick a different number if two orders were started at once. */
      var latest = S.orders.get(id);
      if (saved && latest && saved.no && saved.no !== latest.no) {
        latest.no = saved.no;
        renderList();
        if (S.sel === id && !timers[id]) renderDetail();
      }
    })
    .catch(function (err) {
      toast("Could not save: " + (err && err.message ? err.message : "check your connection"));
    })
    .then(function () { inflight[id]--; });
}

/** Save now, or after a short pause so typing does not send a write per key. */
export function schedule(id, now) {
  clearTimeout(timers[id]);
  if (now) {
    delete timers[id];
    queueSave(id);
    return;
  }
  timers[id] = setTimeout(function () { delete timers[id]; queueSave(id); }, SAVE_DELAY_MS);
}

/** Record a local edit: stamp it, queue the save and repaint the list. */
export function touch(o, now) {
  o.updatedAt = Date.now();
  schedule(o.id, now);
  renderList();
}

export function removeOrder(id) {
  clearTimeout(timers[id]);
  delete timers[id];
  S.orders.delete(id);
  gone[id] = true;
  chains[id] = (chains[id] || Promise.resolve())
    .then(function () { return store.removeOrder(id); })
    .catch(function () { toast("Could not delete the order"); })
    .then(function () { delete gone[id]; });
}

/** True while the caret is somewhere in the order sheet. */
function typing() {
  return els.detail.contains(document.activeElement);
}

function onOrders(list) {
  var next = new Map();
  var selId = S.sel;
  var before = selId ? sig(cur()) : null;

  list.forEach(function (o) { if (!gone[o.id]) next.set(o.id, o); });
  /* Keep local copies of anything still being written. */
  S.orders.forEach(function (o, id) { if (busy(id)) next.set(id, o); });
  S.orders = next;
  S.ready = true;

  if (selId && !S.orders.has(selId)) {
    S.sel = null;
    els.app.dataset.view = "list";
    renderDetail();
  } else if (selId && !busy(selId) && before !== sig(cur()) && !typing()) {
    /* Redraw only for a real change made elsewhere, and never while a field has
       focus, so the caret and the scroll position stay where they were. */
    renderDetail();
  }
  renderList();
}

export function refresh() {
  return store.loadOrders().then(onOrders).catch(function (err) {
    els.foot.textContent = "Could not load orders. " + (err && err.message ? err.message : "");
    if (!S.ready) {
      S.ready = true;
      renderList();
    }
  });
}

export function startPolling() {
  setInterval(function () { if (!document.hidden) refresh(); }, POLL_MS);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) refresh();
  });
}
