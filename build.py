#!/usr/bin/env python3
"""Build the Sunset Coast Windows site into public/.

Vercel is configured with no build command and output directory `public/`,
so run this locally and commit `public/` after you change data or templates.

    python3 build.py
"""
from __future__ import annotations

import hashlib
import html
import json
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"
DATA = ROOT / "data"
PUBLIC = ROOT / "public"
SITE_URL = "https://sunsetcoastwindows.com"

PAGES = [
    {
        "slug": "index",
        "out": "index.html",
        "path": "/",
        "title": "Sunset Coast Windows | Window Replacement in Greater Los Angeles",
        "description": "Replacement windows and patio doors for greater Los Angeles, with installation included in the online estimate. Los Angeles, Orange, and Ventura counties.",
        "active": "",
        "extra": [],
    },
    {
        "slug": "catalog",
        "out": "catalog.html",
        "path": "/catalog",
        "title": "Window Catalog | Sunset Coast Windows",
        "description": "Vinyl replacement windows and patio doors ordered through Beacon Building Products: single hung, double hung, sliders, casements, bays, and more.",
        "active": "CATALOG",
        "extra": ["catalog.js"],
    },
    {
        "slug": "estimate",
        "out": "estimate.html",
        "path": "/estimate",
        "title": "Instant Window Estimate | Sunset Coast Windows",
        "description": "Build an installed window estimate online. Add sizes, see the itemized total, then order or book an on-site measurement.",
        "active": "ESTIMATE",
        "extra": ["estimator.js"],
    },
    {
        "slug": "about",
        "out": "about.html",
        "path": "/about",
        "title": "About & Contact | Sunset Coast Windows",
        "description": "Sunset Coast Windows replaces windows across greater Los Angeles and orders product through Beacon Building Products.",
        "active": "ABOUT",
        "extra": [],
    },
    {
        "slug": "service-area",
        "out": "service-area.html",
        "path": "/service-area",
        "title": "Service Area | Sunset Coast Windows",
        "description": "We install replacement windows in Los Angeles County and nearby Orange County and Ventura County. Check your ZIP or city.",
        "active": "AREA",
        "extra": [],
    },
    {
        "slug": "privacy",
        "out": "privacy.html",
        "path": "/privacy",
        "title": "Privacy Policy | Sunset Coast Windows",
        "description": "How Sunset Coast Windows handles estimates, orders, and SMS consent.",
        "active": "",
        "extra": [],
    },
    {
        "slug": "terms",
        "out": "terms.html",
        "path": "/terms",
        "title": "Terms | Sunset Coast Windows",
        "description": "Terms for estimates, orders, measurements, and text messages from Sunset Coast Windows.",
        "active": "",
        "extra": [],
    },
]


def load(name: str) -> dict:
    return json.loads((DATA / name).read_text())


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:10]


def slugify(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def prices() -> dict:
    code = r"""
const { fromPriceCents, formatUSD } = require("./lib/pricing");
const catalog = require("./data/catalog.json");
const pricing = require("./data/pricing.json");
const out = {};
for (const product of catalog.products) {
  const cents = fromPriceCents(product, pricing);
  out[product.id] = formatUSD(cents);
}
process.stdout.write(JSON.stringify(out));
"""
    result = subprocess.run(["node", "-e", code], cwd=ROOT, check=True, capture_output=True, text=True)
    return json.loads(result.stdout)


def public_payload(site, catalog, pricing, area) -> str:
    def strip(doc):
        return {key: value for key, value in doc.items() if not str(key).startswith("_")}

    payload = {
        "site": strip(site),
        "catalog": strip(catalog),
        "pricing": strip(pricing),
        "serviceArea": strip(area),
    }
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=False)
    return raw.replace("<", "\\u003c")


def catalog_cards(catalog: dict, price_labels: dict) -> str:
    tiers = {item["id"]: item["name"] for item in catalog["tiers"]}
    cards = []
    for product in catalog["products"]:
        confirm = (
            '<p class="confirm-note">We confirm this series with Beacon before it is ordered.</p>'
            if product.get("confirmWithBranch")
            else ""
        )
        panels = "3" if product["id"] == "patio-slider-3" else "2"
        cards.append(
            f"""<article class="pcard" id="{html.escape(product['id'])}" data-type="{html.escape(product['type'])}" data-tier="{html.escape(product['tier'])}" data-design="{html.escape(product['design'])}" data-material="{html.escape(product['material'])}">
  <a class="pcard-visual" href="/estimate?product={html.escape(product['id'])}" tabindex="-1" aria-hidden="true">
    <div data-preview data-uid="{html.escape(product['id'])}" data-product="{html.escape(product['id'])}" data-type="{html.escape(product['type'])}" data-shape="{html.escape(product.get('shape') or '')}" data-color="white" data-grid="colonial" data-panels="{panels}" data-label="{html.escape(product['name'])}"></div>
  </a>
  <div class="pcard-body">
    <div><span class="pill pill-{html.escape(product['tier'])}">{html.escape(tiers.get(product['tier'], product['tier']))}</span> <span class="pill">Vinyl</span></div>
    <h2><a href="/estimate?product={html.escape(product['id'])}">{html.escape(product['name'])}</a></h2>
    <p class="meta">{html.escape(product['brand'])} · {html.escape(product['line'])}</p>
    <p>{html.escape(product['description'])}</p>
    {confirm}
    <p class="price">From {html.escape(price_labels[product['id']])} <small>installed</small></p>
    <a class="btn btn-small" href="/estimate?product={html.escape(product['id'])}">Add to estimate</a>
  </div>
</article>"""
        )
    return "\n".join(cards)


def city_chips(area: dict) -> str:
    chips = []
    for place in area["places"]:
        if not place.get("featured"):
            continue
        chips.append(
            f'<a href="/service-area#{slugify(place["city"])}">{html.escape(place["city"])}</a>'
        )
    return "\n".join(chips)


def city_groups(area: dict) -> str:
    blocks = []
    order = ["Los Angeles", "Orange", "Ventura"]
    names = {item["id"]: item["name"] for item in area["counties"]}
    for county in order:
        places = sorted(
            [place for place in area["places"] if place["county"] == county],
            key=lambda place: place["city"],
        )
        items = "\n".join(
            f'<li id="{slugify(place["city"])}"><a href="/estimate?area={html.escape(place["city"])}">{html.escape(place["city"])}</a></li>'
            for place in places
        )
        blocks.append(f"<section><h2>{html.escape(names.get(county, county))}</h2><ul>{items}</ul></section>")
    return "\n".join(blocks)


def schema(description: str) -> str:
    data = {
        "@context": "https://schema.org",
        "@type": "HomeAndConstructionBusiness",
        "name": "Sunset Coast Windows",
        "url": SITE_URL,
        "image": SITE_URL + "/images/og.jpg",
        "telephone": "+1-213-555-0148",
        "email": "estimates@sunsetcoastwindows.com",
        "description": description,
        "priceRange": "$$",
        "address": {
            "@type": "PostalAddress",
            "addressLocality": "Los Angeles",
            "addressRegion": "CA",
            "addressCountry": "US",
        },
        "areaServed": [
            {"@type": "AdministrativeArea", "name": "Los Angeles County"},
            {"@type": "AdministrativeArea", "name": "Orange County"},
            {"@type": "AdministrativeArea", "name": "Ventura County"},
        ],
        "openingHours": ["Mo-Sa 08:00-18:00"],
        "makesOffer": {
            "@type": "Offer",
            "itemOffered": {"@type": "Service", "name": "Window replacement and installation"},
        },
    }
    return json.dumps(data, ensure_ascii=False).replace("<", "\\u003c")


def render_page(page, content, tokens, css_v, js_versions, payload) -> str:
    active = {key: "" for key in ("CATALOG", "ESTIMATE", "AREA", "ABOUT")}
    if page["active"]:
        active[page["active"]] = "is-active"
    header = (SRC / "partials" / "header.html").read_text()
    footer = (SRC / "partials" / "footer.html").read_text()
    for key, value in active.items():
        header = header.replace("{{ACTIVE_" + key + "}}", value)
    body = content
    for key, value in tokens.items():
        body = body.replace("{{" + key + "}}", value)
    scripts = [
        f'<script src="/js/pricing.js?v={js_versions["pricing.js"]}"></script>',
        f'<script src="/js/area.js?v={js_versions["area.js"]}"></script>',
        f'<script src="/js/preview.js?v={js_versions["preview.js"]}"></script>',
        f"<script>window.SCW={payload};</script>",
        f'<script src="/js/site.js?v={js_versions["site.js"]}"></script>',
    ]
    for name in page["extra"]:
        scripts.append(f'<script src="/js/{name}?v={js_versions[name]}"></script>')
    canonical = SITE_URL if page["path"] == "/" else SITE_URL + page["path"]
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(page["title"])}</title>
<meta name="description" content="{html.escape(page["description"])}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Sunset Coast Windows">
<meta property="og:title" content="{html.escape(page["title"])}">
<meta property="og:description" content="{html.escape(page["description"])}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{SITE_URL}/images/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0c1c33">
<link rel="icon" href="/images/favicon.svg" type="image/svg+xml">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/styles.css?v={css_v}">
<script type="application/ld+json">{schema(page["description"])}</script>
</head>
<body>
{header}
<main id="main">
{body}
</main>
{footer}
{os_join(scripts)}
</body>
</html>
"""


def os_join(lines) -> str:
    return "\n".join(lines)


def main() -> None:
    site = load("site.json")
    catalog = load("catalog.json")
    pricing = load("pricing.json")
    area = load("service-area.json")
    price_labels = prices()
    if PUBLIC.exists():
        shutil.rmtree(PUBLIC)
    (PUBLIC / "css").mkdir(parents=True)
    (PUBLIC / "js").mkdir()
    (PUBLIC / "images").mkdir()
    shutil.copy(SRC / "css" / "styles.css", PUBLIC / "css" / "styles.css")
    shutil.copy(ROOT / "lib" / "pricing.js", PUBLIC / "js" / "pricing.js")
    shutil.copy(ROOT / "lib" / "area.js", PUBLIC / "js" / "area.js")
    for name in ("preview.js", "site.js", "catalog.js", "estimator.js"):
        shutil.copy(SRC / "js" / name, PUBLIC / "js" / name)
    for image in (SRC / "images").iterdir():
        if image.is_file():
            shutil.copy(image, PUBLIC / "images" / image.name)

    css_v = sha(PUBLIC / "css" / "styles.css")
    js_versions = {path.name: sha(path) for path in (PUBLIC / "js").iterdir()}
    payload = public_payload(site, catalog, pricing, area)
    consent = (SRC / "partials" / "consent.html").read_text().strip()
    tokens = {
        "CATALOG_CARDS": catalog_cards(catalog, price_labels),
        "CITY_CHIPS": city_chips(area),
        "CITY_GROUPS": city_groups(area),
        "SMS_CONSENT": consent,
    }
    for product_id, label in price_labels.items():
        tokens["PRICE:" + product_id] = label

    for page in PAGES:
        content = (SRC / "pages" / f"{page['slug']}.html").read_text()
        html_out = render_page(page, content, tokens, css_v, js_versions, payload)
        (PUBLIC / page["out"]).write_text(html_out)

    (PUBLIC / "robots.txt").write_text(
        "User-agent: *\nAllow: /\nSitemap: https://sunsetcoastwindows.com/sitemap.xml\n"
    )
    urls = "\n".join(
        f"  <url><loc>{SITE_URL if page['path'] == '/' else SITE_URL + page['path']}</loc></url>"
        for page in PAGES
    )
    (PUBLIC / "sitemap.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + urls
        + "\n</urlset>\n"
    )
    (PUBLIC / "site.webmanifest").write_text(
        json.dumps(
            {
                "name": "Sunset Coast Windows",
                "short_name": "Sunset Coast",
                "start_url": "/",
                "display": "standalone",
                "background_color": "#fbf7f1",
                "theme_color": "#0c1c33",
                "icons": [{"src": "/images/favicon.svg", "sizes": "any", "type": "image/svg+xml"}],
            },
            indent=2,
        )
        + "\n"
    )
    not_found = next(page for page in PAGES if page["slug"] == "index")
    missing = render_page(
        {
            **not_found,
            "title": "Page not found | Sunset Coast Windows",
            "description": "That page is not on Sunset Coast Windows.",
            "path": "/404",
            "active": "",
            "extra": [],
        },
        """<section class="page-hero container"><p class="kicker">404</p><h1>That page drifted out with the tide.</h1><p>Try the catalog or start an estimate.</p><p><a class="btn" href="/">Home</a> <a class="btn btn-ghost" href="/catalog">Catalog</a></p></section>""",
        tokens,
        css_v,
        js_versions,
        payload,
    )
    (PUBLIC / "404.html").write_text(missing)
    print(f"Built {len(PAGES)} pages into {PUBLIC}")


if __name__ == "__main__":
    main()
