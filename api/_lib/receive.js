/**
 * Shared lead receiver for estimate, order, and appointment posts.
 * Stores with @vercel/blob when BLOB_READ_WRITE_TOKEN is set, otherwise logs
 * the JSON. Forwards to LEAD_WEBHOOK_URL when that env var is set.
 * Optional LEAD_WEBHOOK_SECRET is sent as the X-Lead-Secret header.
 *
 * No card data is accepted. The payment step is a later hook.
 */
const crypto = require("crypto");
const { priceCart } = require("../../lib/pricing");
const { checkServiceArea } = require("../../lib/area");
const catalog = require("../../data/catalog.json");
const pricing = require("../../data/pricing.json");
const serviceArea = require("../../data/service-area.json");
const site = require("../../data/site.json");

const MAX_BYTES = 200000;
const CARD_KEY = /(card|ccnum|cvv|cvc|^pan$|expiry|expiration|exp_?month|exp_?year)/i;

function send(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return Promise.resolve(req.body);
  }
  if (typeof req.body === "string") {
    return Promise.resolve(req.body ? JSON.parse(req.body) : {});
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BYTES) {
        reject(Object.assign(new Error("Payload is too large."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(Object.assign(new Error("Send JSON."), { status: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function hasCardFields(value) {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasCardFields);
  return Object.keys(value).some((key) => CARD_KEY.test(key) || hasCardFields(value[key]));
}

function clean(value, max) {
  return String(value == null ? "" : value).replace(/[\u0000-\u001F]/g, "").trim().slice(0, max);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 120;
}

function phoneDigits(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return null;
}

function originAllowed(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  let host = "";
  try {
    host = new URL(origin).host.toLowerCase();
  } catch (err) {
    return false;
  }
  const expected = String(req.headers.host || "").toLowerCase();
  if (host === expected) return true;
  if (host === "sunsetcoastwindows.com" || host === "www.sunsetcoastwindows.com") return true;
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return true;
  return false;
}

function todayPT() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
}

function plusDays(iso, days) {
  const date = new Date(iso + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function confirmationCode() {
  const day = todayPT().replace(/-/g, "");
  return "SCW-" + day + "-" + crypto.randomBytes(3).toString("hex").toUpperCase();
}

async function storeRecord(kind, record) {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    console.log(JSON.stringify({ scwLead: true, stored: "log", record: record }));
    return { blob: false, logged: true };
  }
  try {
    const { put } = await import("@vercel/blob");
    await put("leads/" + kind + "/" + record.id + ".json", JSON.stringify(record, null, 2), {
      access: "private",
      token: token,
      contentType: "application/json",
    });
    return { blob: true, logged: false };
  } catch (err) {
    console.error("Blob store failed; logging the lead instead.", err && err.message);
    console.log(JSON.stringify({ scwLead: true, stored: "log-after-blob-error", record: record }));
    return { blob: false, logged: true, blobError: true };
  }
}

async function forward(record) {
  const url = process.env.LEAD_WEBHOOK_URL;
  if (!url) return { webhook: false };
  const headers = { "content-type": "application/json" };
  if (process.env.LEAD_WEBHOOK_SECRET) headers["x-lead-secret"] = process.env.LEAD_WEBHOOK_SECRET;
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ source: "sunsetcoastwindows.com", kind: record.kind, record: record }),
      signal: AbortSignal.timeout(4000),
    });
    return { webhook: response.ok, webhookStatus: response.status };
  } catch (err) {
    console.error("Lead webhook failed.", err && err.message);
    return { webhook: false, webhookError: true };
  }
}

function activeLines(lines) {
  return (Array.isArray(lines) ? lines : []).filter((line) => line && line.productId);
}

function createHandler(kind) {
  return async function handler(req, res) {
    if (req.method !== "POST") return send(res, 405, { ok: false, error: "Method not allowed." });
    if (!originAllowed(req)) return send(res, 403, { ok: false, error: "Origin not allowed." });

    let body;
    try {
      body = await readBody(req);
    } catch (err) {
      return send(res, err.status || 400, { ok: false, error: err.message || "Bad request." });
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return send(res, 400, { ok: false, error: "Expected a JSON object." });
    }
    if (hasCardFields(body)) {
      return send(res, 400, { ok: false, error: "Do not send card numbers. Payment is not connected." });
    }
    if (clean(body.companyWebsite || (body.customer && body.customer.companyWebsite), 200)) {
      return send(res, 200, { ok: true, confirmationCode: "SCW-RECEIVED" });
    }

    const customerIn = body.customer || {};
    const customer = {
      name: clean(customerIn.name, 80),
      email: clean(customerIn.email, 120),
      phone: clean(customerIn.phone, 30),
      smsConsent: customerIn.smsConsent === true,
      address: clean(customerIn.address, 140),
      city: clean(customerIn.city, 60),
      zip: clean(customerIn.zip, 10).replace(/[^\d]/g, "").slice(0, 5),
      notes: clean(customerIn.notes || body.message, 2000),
    };
    const errors = [];
    if (customer.name.length < 2) errors.push("Enter your name.");
    if (!validEmail(customer.email)) errors.push("Enter a valid email.");
    const digits = phoneDigits(customer.phone);
    if (!digits) errors.push("Enter a 10-digit phone number.");
    else customer.phone = digits;
    if (!customer.smsConsent) errors.push("SMS consent must be checked. The box cannot be pre-checked.");

    const intent = clean(body.intent, 40) || kind;
    const lines = activeLines(body.lines);
    const isContact = kind === "estimate" && (intent === "contact" || intent === "question");
    let quote = null;
    if (!isContact) {
      if (!lines.length && intent !== "out-of-area") errors.push("Add at least one window.");
      if (lines.length) {
        const priced = priceCart(catalog.products, pricing, { lines: lines, addons: body.addons || {} });
        if (!priced.ok) errors.push.apply(errors, priced.errors);
        else quote = priced.quote;
      }
    } else if (customer.notes.length < 5) {
      errors.push("Tell us a little about what you need.");
    }

    const areaQuery = customer.zip || (body.serviceArea && (body.serviceArea.zip || body.serviceArea.query)) || "";
    const area = areaQuery ? checkServiceArea(serviceArea, String(areaQuery)) : { served: false, matchType: "empty", query: "", zip: null, label: "", places: [] };
    const areaPublic = {
      served: !!area.served,
      matchType: area.matchType,
      query: area.query || "",
      zip: area.zip,
      label: area.label,
      county: area.county,
    };

    if (kind === "order" || kind === "appointment") {
      if (!area.served) errors.push("That ZIP or city is outside the service area.");
      if (!/^\d{5}$/.test(customer.zip)) errors.push("Enter the 5-digit ZIP for the home.");
    }
    if (kind === "order") {
      if (customer.address.length < 4) errors.push("Enter the installation address.");
      if (customer.city.length < 2) errors.push("Enter the city.");
    }

    let appointment = null;
    if (kind === "appointment") {
      const incoming = body.appointment || {};
      const date = clean(incoming.date, 10);
      const timeWindow = clean(incoming.timeWindow, 40);
      const altDate = clean(incoming.altDate, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) errors.push("Pick a preferred date.");
      else if (date < todayPT() || date > plusDays(todayPT(), 120)) errors.push("Pick a date in the next four months.");
      if (site.timeWindows.indexOf(timeWindow) === -1) errors.push("Pick a listed time window.");
      if (altDate && !/^\d{4}-\d{2}-\d{2}$/.test(altDate)) errors.push("The second date is not valid.");
      appointment = { date: date, timeWindow: timeWindow, altDate: altDate };
    }

    if (errors.length) return send(res, 400, { ok: false, error: "Check the form.", errors: errors });

    const id = confirmationCode();
    const record = {
      id: id,
      kind: kind,
      intent: intent,
      receivedAt: new Date().toISOString(),
      customer: customer,
      serviceArea: areaPublic,
      quote: quote,
      appointment: appointment,
      clientTotalCents: Number.isFinite(body.clientTotalCents) ? body.clientTotalCents : null,
      page: clean(body.page, 120),
      payment: kind === "order" ? { status: "not_connected", processor: null } : null,
    };

    const stored = await storeRecord(kind, record);
    const hooked = await forward(record);
    console.log(JSON.stringify({ scwLeadDelivery: id, kind: kind, blob: stored.blob, webhook: hooked.webhook }));

    return send(res, 200, {
      ok: true,
      confirmationCode: id,
      totalCents: quote ? quote.totalCents : null,
      payment: record.payment,
      stored: stored.blob ? "blob" : "log",
    });
  };
}

module.exports = createHandler;
