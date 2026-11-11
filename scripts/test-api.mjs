import { createRequire } from "module";
import { createServer } from "http";
import assert from "assert";

const require = createRequire(import.meta.url);
const estimate = require("../api/estimate.js");
const order = require("../api/order.js");
const appointment = require("../api/appointment.js");

function invoke(handler, body, headers = {}) {
  return new Promise((resolve) => {
    const req = {
      method: "POST",
      headers: { origin: "http://127.0.0.1:4173", host: "127.0.0.1:4173", ...headers },
      body,
    };
    const res = {
      statusCode: 0,
      headers: {},
      setHeader(key, value) { this.headers[key] = value; },
      end(payload) { resolve({ status: this.statusCode, json: JSON.parse(payload) }); },
    };
    handler(req, res);
  });
}

const customer = {
  name: "Avery Coast",
  email: "avery@example.com",
  phone: "(310) 555-0199",
  smsConsent: true,
  address: "12 Sunset Ave",
  city: "Los Angeles",
  zip: "90291",
  notes: "Front bedroom and the kitchen slider.",
};

const line = {
  productId: "mi-v2000-single-hung",
  widthIn: 36,
  heightIn: 60,
  qty: 2,
  frameColor: "white",
  grid: "colonial",
  glass: "tempered",
};
const addons = { removal: true, installMethod: "retrofit", stucco: false, permit: true };

const estimateRes = await invoke(estimate, {
  intent: "estimate",
  customer,
  lines: [line],
  addons,
  serviceArea: { zip: "90291" },
  clientTotalCents: 191100,
});
assert.strictEqual(estimateRes.status, 200, JSON.stringify(estimateRes.json));
assert.strictEqual(estimateRes.json.ok, true);
assert.strictEqual(estimateRes.json.totalCents, 191100);
assert.match(estimateRes.json.confirmationCode, /^SCW-/);

const noConsent = await invoke(estimate, {
  intent: "estimate",
  customer: { ...customer, smsConsent: false },
  lines: [line],
  addons,
});
assert.strictEqual(noConsent.status, 400);
assert.ok(noConsent.json.errors.some((error) => /consent/i.test(error)));

const card = await invoke(order, {
  customer,
  lines: [line],
  addons,
  cardNumber: "4242424242424242",
});
assert.strictEqual(card.status, 400);

const outside = await invoke(order, {
  customer: { ...customer, zip: "10001", city: "New York" },
  lines: [line],
  addons,
});
assert.strictEqual(outside.status, 400);

const ordered = await invoke(order, { customer, lines: [line], addons, clientTotalCents: 191100 });
assert.strictEqual(ordered.status, 200, JSON.stringify(ordered.json));
assert.strictEqual(ordered.json.totalCents, 191100);
assert.deepStrictEqual(ordered.json.payment, { status: "not_connected", processor: null });

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
const booked = await invoke(appointment, {
  customer,
  lines: [line],
  addons,
  appointment: { date: today, timeWindow: "10:00 AM – 12:00 PM", altDate: "" },
});
assert.strictEqual(booked.status, 200, JSON.stringify(booked.json));
assert.strictEqual(booked.json.totalCents, 191100);

const contact = await invoke(estimate, {
  intent: "contact",
  customer: { ...customer, notes: "Please call about a garden window." },
  lines: [],
});
assert.strictEqual(contact.status, 200, JSON.stringify(contact.json));

const honeypot = await invoke(estimate, { companyWebsite: "http://spam.test", customer, lines: [line] });
assert.strictEqual(honeypot.status, 200);
assert.strictEqual(honeypot.json.confirmationCode, "SCW-RECEIVED");

const webhookHits = [];
const hook = createServer((req, res) => {
  const chunks = [];
  req.on("data", (chunk) => chunks.push(chunk));
  req.on("end", () => {
    webhookHits.push(JSON.parse(Buffer.concat(chunks).toString("utf8")));
    res.end("ok");
  });
});
await new Promise((resolve) => hook.listen(0, "127.0.0.1", resolve));
process.env.LEAD_WEBHOOK_URL = "http://127.0.0.1:" + hook.address().port + "/hook";
process.env.LEAD_WEBHOOK_SECRET = "test-secret";
const hooked = await invoke(estimate, { intent: "estimate", customer, lines: [line], addons });
assert.strictEqual(hooked.status, 200);
await new Promise((resolve) => setTimeout(resolve, 50));
assert.strictEqual(webhookHits.length, 1);
assert.strictEqual(webhookHits[0].kind, "estimate");
assert.strictEqual(webhookHits[0].record.quote.totalCents, 191100);
hook.close();
delete process.env.LEAD_WEBHOOK_URL;
delete process.env.LEAD_WEBHOOK_SECRET;

console.log("api ok", ordered.json.confirmationCode);
