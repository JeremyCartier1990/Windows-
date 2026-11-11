import { createRequire } from "module";
import assert from "assert";

const require = createRequire(import.meta.url);
const { priceCart, fromPriceCents, formatUSD } = require("../lib/pricing.js");
const catalog = require("../data/catalog.json");
const pricing = require("../data/pricing.json");

const good = catalog.products.find((product) => product.id === "mi-v2000-single-hung");
const result = priceCart(catalog.products, pricing, {
  lines: [
    {
      productId: "mi-v2000-single-hung",
      widthIn: 36,
      heightIn: 60,
      qty: 2,
      frameColor: "white",
      grid: "colonial",
      glass: "tempered",
    },
  ],
  addons: { removal: true, installMethod: "retrofit", stucco: false, permit: true },
});
assert.strictEqual(result.ok, true, result.errors && result.errors.join("; "));
// 15000 + 250*96 = 39000, + colonial 4800 + tempered 7500 = 51300
// install united inches 96 → $225 → 22500
// qty 2 → material 102600, install 45000, removal 11000, permit 32500
assert.strictEqual(result.quote.lines[0].materialEachCents, 51300);
assert.strictEqual(result.quote.lines[0].installEachCents, 22500);
assert.strictEqual(result.quote.totalCents, 102600 + 45000 + 11000 + 32500);
assert.strictEqual(formatUSD(result.quote.totalCents), "$1,911");

const fractional = priceCart(catalog.products, pricing, {
  lines: [
    {
      productId: "mi-v2000-single-hung",
      widthIn: 36.5,
      heightIn: 60,
      qty: 1,
      frameColor: "white",
      grid: "none",
      glass: "dual-low-e",
    },
  ],
  addons: {},
});
assert.strictEqual(fractional.ok, true);
// 15000 + round(250*96.5) = 39125 → nearest dollar 39100, install 22500
assert.strictEqual(fractional.quote.lines[0].materialEachCents, 39100);
assert.strictEqual(fractional.quote.totalCents, 39100 + 22500);

const planned = priceCart(catalog.products, pricing, {
  lines: [{ productId: "mi-v2000-single-hung", qty: 1, measureForMe: true, frameColor: "white", grid: "none", glass: "dual-low-e" }],
  addons: {},
});
assert.strictEqual(planned.ok, true);
assert.strictEqual(planned.quote.lines[0].widthIn, good.reference.widthIn);
assert.strictEqual(planned.quote.lines[0].pricedFrom, "reference");
assert.strictEqual(fromPriceCents(good, pricing), planned.quote.lines[0].lineCents);

const fullFrame = priceCart(catalog.products, pricing, {
  lines: [{ productId: "mi-v2000-single-hung", widthIn: 36, heightIn: 60, qty: 1, frameColor: "white", grid: "none", glass: "dual-low-e" }],
  addons: { installMethod: "full-frame", stucco: true, removal: false, permit: false },
});
assert.strictEqual(fullFrame.quote.addonsCents, 19500 + 12500);

const tooWide = priceCart(catalog.products, pricing, {
  lines: [{ productId: "mi-v2000-single-hung", widthIn: 90, heightIn: 60, qty: 1, frameColor: "white", grid: "none", glass: "dual-low-e" }],
  addons: {},
});
assert.strictEqual(tooWide.ok, false);

const bay = priceCart(catalog.products, pricing, {
  lines: [{ productId: "vinyl-bay", widthIn: 84, heightIn: 60, qty: 1, frameColor: "white", grid: "none", glass: "dual-low-e" }],
  addons: {},
});
assert.strictEqual(bay.ok, true);
// 140000 + 800*144 = 255200, bay install ≤160 → 52000
assert.strictEqual(bay.quote.lines[0].materialEachCents, 255200);
assert.strictEqual(bay.quote.lines[0].installEachCents, 52000);
assert.strictEqual(bay.quote.totalCents, 307200);

console.log("pricing ok", formatUSD(result.quote.totalCents));
