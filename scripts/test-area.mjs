import { createRequire } from "module";
import assert from "assert";

const require = createRequire(import.meta.url);
const { checkServiceArea } = require("../lib/area.js");
const data = require("../data/service-area.json");

function yes(query) {
  const result = checkServiceArea(data, query);
  assert.strictEqual(result.served, true, query + " should be served, got " + JSON.stringify(result));
}
function no(query) {
  const result = checkServiceArea(data, query);
  assert.strictEqual(result.served, false, query + " should be outside the area");
}

["90291", "91101", "92651", "93001", "90210", "91355", "93550", "90802", "92618", "91360", "93065", "90401", "90266"].forEach(yes);
["92408", "91701", "91709", "92336", "92501", "92101", "93101", "93013", "94105", "10001"].forEach(no);
yes("Pasadena");
yes("hollywood");
yes("Venice");
yes("Irvine");
yes("Orange");
yes("Orange County");
yes("Ventura County");
yes("LA");
no("San Bernardino");
no("Santa Barbara");
no("Riverside");

const orange = checkServiceArea(data, "Orange");
assert.strictEqual(orange.matchType, "city");
assert.strictEqual(orange.label, "Orange");
const county = checkServiceArea(data, "Orange County");
assert.strictEqual(county.matchType, "county");

const zips = new Set();
for (const place of data.places) {
  assert.ok(place.city && place.county && place.zips.length, place.city);
  for (const zip of place.zips) {
    assert.match(zip, /^\d{5}$/);
    zips.add(zip);
  }
}
assert.ok(zips.size > 300, "expected a broad ZIP list");
console.log("area ok", data.places.length, "places", zips.size, "zips");
