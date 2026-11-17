/* Starts the page: paints what is already known, wires the controls, then
   reads the book from the server. */

import { els } from "./dom.js";
import { store } from "./api.js";
import { S } from "./state.js";
import { bindEvents } from "./events.js";
import { refresh, startPolling } from "./sync.js";
import { renderChips } from "./views/chips.js";
import { renderDetail, updateTotals } from "./views/detail.js";
import { renderList } from "./views/list.js";

/* The currency symbol is the only saved setting; leave it alone while it is
   being typed into. */
function applySettings(s) {
  if (!s || !s.currency || document.activeElement === els.currency) return;
  S.currency = s.currency;
  els.currency.value = s.currency;
  updateTotals();
  renderList();
}

renderChips();
renderList();
renderDetail();
bindEvents();

store.loadSettings().then(applySettings).catch(function () {});
refresh();
startPolling();
