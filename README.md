# Sunset Coast Windows

Marketing site and online estimator for Sunset Coast Windows (`sunsetcoastwindows.com`), a window replacement company serving greater Los Angeles. It follows the same deployment shape as Pacific Coast Roofs: a Python build writes a static site into `public/`, and Node serverless functions in `api/` receive leads.

Vercel project settings, matching that pattern:

- Framework: **Other**
- Output directory: **`public`**
- Build command: **empty** (there is no `build` script in `package.json`)
- Node.js: **18 or newer** (`package.json` `engines`)

`vercel.json` sets `outputDirectory` to `public`, `buildCommand` to null, clean URLs, and rewrites for the main pages. Commit `public/` after every change. Vercel does not run `build.py`.

## Layout

| Path | Role |
| --- | --- |
| `src/pages/` | Page content |
| `src/partials/` | Header, footer, SMS consent block |
| `src/css/styles.css` | Styles |
| `src/js/` | Catalog, estimator, window illustrations |
| `src/images/` | Photos, favicon, Open Graph image |
| `lib/pricing.js` | Customer-price math (shared by the site and the API) |
| `lib/area.js` | ZIP and city lookup |
| `data/pricing.json` | **Placeholder** customer prices |
| `data/catalog.json` | Window lines, options, and sizes |
| `data/service-area.json` | Served ZIPs and cities |
| `data/site.json` | Name, placeholder phone and email, time windows |
| `api/` | `POST /api/estimate`, `/api/order`, `/api/appointment` |
| `public/` | Built site. This is what Vercel serves |
| `build.py` | Writes `public/` |

```bash
python3 build.py
node scripts/dev-server.mjs
```

The dev server serves `public/` at `http://127.0.0.1:4173` and runs the real API routes. Extensionless paths (`/catalog`) and `.html` paths both work locally.

Checks:

```bash
node scripts/test-pricing.mjs
node scripts/test-area.mjs
node scripts/test-api.mjs
```

## Edit the service area

`data/service-area.json` is the only list. A ZIP or city is served when it appears there. The file covers Los Angeles County and nearby Orange County and Ventura County. Each place has `city`, `county`, `zips`, optional `aliases` (neighborhoods such as `venice`), and `featured` (shown on the home page).

Add a ZIP to the right city, or add a place. Then run `python3 build.py` and commit `public/`. San Bernardino, Riverside, and Santa Barbara are intentionally absent.

## Edit the catalog

`data/catalog.json` describes each window: type, tier (good / better / best), design, vinyl frame, allowed colors, grids, glass, and min/max size. `beaconListing` records what showed up on Beacon / QXO’s public catalog. `confirmWithBranch: true` means the line is from a brand Beacon distributes, and the exact series should be confirmed before it is ordered.

Customer prices are **not** in the catalog. They live in `data/pricing.json`, keyed by the same product id.

## Edit prices

`data/pricing.json` holds **placeholder Los Angeles retail numbers**. Jeremy must replace every figure with the real customer price.

Calculate supplier cost and markup offline. Paste **only the customer price** into this file. Do not put supplier cost or markup in the repo. The site and the API only read customer prices, and the pages never display cost or margin.

The formula in `lib/pricing.js`:

- United inches = width + height
- Window price = base + (per united inch × united inches) + frame color + grid + glass, rounded to the nearest dollar
- Installation is included, priced per window by size bracket (window, bay, or door)
- Retrofit / insert install is the base installation price
- Optional add-ons: old-window removal and disposal, full-frame instead of retrofit, stucco patch, permit coordination (once per project)

A “from” price on the catalog is that formula at the product’s reference size, white frame, no grids, standard Low-E, retrofit install, no other add-ons.

## What the estimator does

1. ZIP or city check against `data/service-area.json`
2. One or more windows, with a drawing that follows type, color, and grids
3. Quantity and width × height in inches
4. Measurement helper: three widths and three heights, and the smallest of each is used
5. “Not sure, measure for me” prices a typical size and flags the line for an on-site measure
6. Itemized total, installation included
7. **Order online** — contact, address, and a marked payment slot. No card fields. Nothing is charged
8. **Book a measurement** — keeps the estimate. The copy states the price is an estimate and the final quote is confirmed after the visit

## Lead API

| Route | When |
| --- | --- |
| `POST /api/estimate` | Save an estimate, or the contact form (`intent: "contact"`) |
| `POST /api/order` | Order submission |
| `POST /api/appointment` | Measurement visit |

Each route checks the payload, requires the SMS consent box to be checked, recomputes the price on the server, and refuses card fields. The response includes `confirmationCode` and, for priced jobs, `totalCents`. Orders also return `payment.status: "not_connected"`.

### Environment variables

Names only. Set them in the Vercel project. Do not commit values.

| Name | Purpose |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | When present, each submission is stored as a private object with `@vercel/blob` under `leads/<kind>/<id>.json`. When absent, the submission is accepted and written to the function log. |
| `LEAD_WEBHOOK_URL` | When present, each submission is forwarded as JSON (`source`, `kind`, `record`) so it can land in n8n, SARA, or anything else that accepts a POST. |
| `LEAD_WEBHOOK_SECRET` | Optional. Sent as the `X-Lead-Secret` header when `LEAD_WEBHOOK_URL` is set. |

A failed blob or webhook does not fail the customer’s request. The form still returns a confirmation code.

### Payment hook

`#payment-slot` on the order form is the empty place for a later deposit step (for example Stripe). Do not add raw card inputs. Create the charge server-side and mount the provider’s element in that slot.

## Placeholder vs real

**Real**

- Page structure, service-area behavior, and the cities and ZIPs in `data/service-area.json`
- Catalog line names that cite a Beacon / QXO public listing (`beaconListing`, `confirmWithBranch: false`)
- The pricing formula and the fact that installation is included
- SMS consent language, Privacy Policy, and Terms

**Placeholder — replace before relying on the live site**

- Every number in `data/pricing.json` (customer prices only; no cost or markup)
- Frame-color lists in `data/catalog.json` where a series’ real palette differs
- Lines with `confirmWithBranch: true` (confirm the series with the Beacon branch)
- Phone `(213) 555-0148`
- Email `estimates@sunsetcoastwindows.com`
- Hours (Mon–Sat 8:00 AM – 6:00 PM)
- Showroom street address (not set; the site says greater Los Angeles)
- Workmanship warranty length (the site says the term is on the contract; it does not advertise a specific number of years)
- Contractor license number (intentionally omitted until one is issued)
- Photos are generated for this site, not job photos

The phone, email, hours, and address are marked with a “Placeholder” chip on the site.
