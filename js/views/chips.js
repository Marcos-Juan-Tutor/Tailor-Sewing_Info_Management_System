/* The Active / Due in 7 days / Picked up filter row. */

import { FILTERS } from "../config.js";
import { els } from "../dom.js";
import { S } from "../state.js";

export function renderChips() {
  els.chips.innerHTML = FILTERS.map(function (f) {
    return '<button class="chip" type="button" data-filter="' + f[0] + '" aria-pressed="' + (S.filter === f[0]) + '">' + f[1] + "</button>";
  }).join("");
}
