/* The words this shop uses and where the server endpoints live.
   Change the lists here if you want different tailoring types or progress steps. */

export const STATUSES = ["New", "Measured", "Sewing", "Fitting", "Ready", "Picked up"];

export const TYPES = ["Dress", "Uniform", "Suit / Formal", "Alteration", "Curtains", "Bedding", "Other"];

/* Types measured on the body rather than on a window. */
export const BODY_TYPES = ["Dress", "Uniform", "Suit / Formal", "Alteration"];

export const BODY_FIELDS = [
  "Neck", "Shoulder", "Chest / Bust", "Waist", "Hip",
  "Sleeve length", "Back length", "Inseam", "Outseam", "Height"
];

export const HOME_FIELDS = ["Width", "Height / Drop", "Fullness", "Hem / Rod pocket", "Panels"];

export const FILTERS = [
  ["active", "Active"],
  ["soon", "Due in 7 days"],
  ["done", "Picked up"],
  ["cancelled", "Cancelled"],
  ["all", "All"]
];

export const API = {
  list: "api/orders/list.php",
  save: "api/orders/save.php",
  remove: "api/orders/delete.php",
  settings: "api/settings.php"
};

/* How often the page checks for changes made on another device or tab. */
export const POLL_MS = 30000;

/* Typing pause before an order is saved. */
export const SAVE_DELAY_MS = 550;
