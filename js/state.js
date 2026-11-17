/* The order book as it is held in memory. Nothing in this file touches the page. */

import { BODY_TYPES, BODY_FIELDS, HOME_FIELDS } from "./config.js";
import { num, todayStr } from "./util.js";

export const S = {
  orders: new Map(),   // id -> order
  sel: null,           // id of the open order
  filter: "active",
  query: "",
  currency: "$",
  ready: false,        // the first load has finished
  armed: false,        // "delete" has been pressed once
  listHTML: null       // what the list currently shows
};

/** The blank set of measurements a new order starts with. */
export function template(type) {
  return (BODY_TYPES.indexOf(type) >= 0 ? BODY_FIELDS : HOME_FIELDS).map(function (l) {
    return { label: l, value: "" };
  });
}

/** The next shop-facing number, T-0001 upwards. */
export function nextNo() {
  var m = 0;
  S.orders.forEach(function (o) {
    var n = parseInt(String(o.no || "").replace(/\D/g, ""), 10);
    if (n > m) m = n;
  });
  return "T-" + String(m + 1).padStart(4, "0");
}

/** A new, empty order. */
export function blank() {
  return {
    id: "o" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    no: nextNo(),
    createdAt: todayStr(),
    updatedAt: Date.now(),
    status: "New",
    cancelled: false,
    cancelledAt: "",
    customer: { name: "", phone: "", email: "", address: "" },
    type: "Dress",
    item: "",
    due: "",
    unit: "cm",
    measures: template("Dress"),
    adjustments: "",
    materials: [],
    fee: 0,
    deposit: 0
  };
}

export function matTotal(o) {
  return (o.materials || []).reduce(function (a, m) { return a + num(m.cost); }, 0);
}

/** Fee + materials, and what is still owed. */
export function totals(o) {
  var mt = matTotal(o);
  var t = num(o.fee) + mt;
  return { mat: mt, total: t, bal: t - num(o.deposit) };
}

export function isDone(o) {
  return o.status === "Picked up";
}

/** The open order, or undefined. */
export function cur() {
  return S.orders.get(S.sel);
}
