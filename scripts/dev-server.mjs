/**
 * Local static server plus the real /api handlers.
 *   node scripts/dev-server.mjs
 * Serves public/ and posts estimates, orders, and appointments through api/.
 */
import { createRequire } from "module";
import { createServer } from "http";
import { readFile } from "fs/promises";
import { extname, join, normalize } from "path";

const require = createRequire(import.meta.url);
const root = join(import.meta.dirname, "..", "public");
const handlers = {
  "/api/estimate": require("../api/estimate.js"),
  "/api/order": require("../api/order.js"),
  "/api/appointment": require("../api/appointment.js"),
};
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
};

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  if (handlers[url.pathname]) {
    try {
      req.body = await readBody(req);
    } catch (err) {
      res.statusCode = 400;
      res.end(JSON.stringify({ ok: false, error: "Send JSON." }));
      return;
    }
    return handlers[url.pathname](req, res);
  }
  let pathname = decodeURIComponent(url.pathname);
  if (pathname.includes("..")) {
    res.statusCode = 400;
    res.end("Bad path");
    return;
  }
  if (pathname.endsWith("/")) pathname += "index.html";
  const candidates = [pathname, pathname + ".html"];
  for (const candidate of candidates) {
    const file = normalize(join(root, candidate));
    if (!file.startsWith(root)) continue;
    try {
      const data = await readFile(file);
      res.setHeader("Content-Type", types[extname(file)] || "application/octet-stream");
      res.end(data);
      return;
    } catch (err) {
      /* try the next candidate */
    }
  }
  const missing = await readFile(join(root, "404.html"));
  res.statusCode = 404;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.end(missing);
});

const port = Number(process.env.PORT || 4173);
server.listen(port, "127.0.0.1", () => {
  console.log("Sunset Coast Windows http://127.0.0.1:" + port);
});
