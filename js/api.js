/* Talking to the server. Every call answers JSON; failures arrive as a thrown
   Error carrying the server's own message, so the page can show it. */

import { API } from "./config.js";

export function request(url, opts) {
  opts = opts || {};
  if (opts.body && typeof opts.body !== "string") {
    opts.body = JSON.stringify(opts.body);
    opts.headers = { "Content-Type": "application/json" };
  }
  return fetch(url, opts).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (j) {
      if (!r.ok) throw new Error(j.error || ("Request failed (" + r.status + ")"));
      return j;
    });
  });
}

export const store = {
  loadOrders: function () { return request(API.list); },
  loadSettings: function () { return request(API.settings); },
  saveOrder: function (o) { return request(API.save, { method: "POST", body: o }); },
  removeOrder: function (id) { return request(API.remove + "?id=" + encodeURIComponent(id), { method: "DELETE" }); },
  saveSettings: function (s) { return request(API.settings, { method: "POST", body: s }); }
};
