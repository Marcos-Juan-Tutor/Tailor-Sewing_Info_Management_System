/* The page elements the app talks to. Modules run after the page is parsed,
   so every one of these exists by the time this file is read. */

export const els = {
  app: document.querySelector("#app"),
  list: document.querySelector("#list"),
  detail: document.querySelector("#detail"),
  chips: document.querySelector("#chips"),
  search: document.querySelector("#q"),
  foot: document.querySelector("#foot"),
  currency: document.querySelector("#cur"),
  toast: document.querySelector("#toast"),
  newOrder: document.querySelector("#newBtn"),
  exportCsv: document.querySelector("#exportBtn")
};
