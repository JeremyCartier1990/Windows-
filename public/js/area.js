/**
 * Service-area lookup. The editable list lives in data/service-area.json
 * (ZIP codes and cities for Los Angeles County plus nearby Orange County
 * and Ventura County). This module only answers "is this query served?"
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SCWArea = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\./g, "")
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\b(california|city of|the)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function namesFor(place) {
    return [place.city].concat(place.aliases || []).map(normalize).filter(Boolean);
  }

  function uniquePlaces(list) {
    const seen = Object.create(null);
    const out = [];
    (list || []).forEach(function (place) {
      const key = place.county + "|" + place.city;
      if (seen[key]) return;
      seen[key] = true;
      out.push(place);
    });
    return out;
  }

  function summarize(places) {
    const names = uniquePlaces(places).map(function (place) {
      return place.city;
    });
    if (!names.length) return "";
    if (names.length === 1) return names[0];
    if (names.length === 2) return names[0] + " and " + names[1];
    return names.slice(0, 3).join(", ") + (names.length > 3 ? ", and nearby" : "");
  }

  /**
   * @returns {{
   *   served: boolean,
   *   matchType: string,
   *   query: string,
   *   zip: string|null,
   *   places: object[],
   *   county: string|null,
   *   label: string
   * }}
   */
  function checkServiceArea(data, query) {
    const original = String(query || "").trim();
    const compact = original.replace(/\s+/g, "");
    const zipMatch = compact.match(/^(\d{5})(?:-\d{4})?$/);

    if (zipMatch) {
      const zip = zipMatch[1];
      const hits = (data.places || []).filter(function (place) {
        return (place.zips || []).indexOf(zip) !== -1;
      });
      return {
        served: hits.length > 0,
        matchType: "zip",
        query: original,
        zip: zip,
        places: hits,
        county: hits.length === 1 ? hits[0].county : null,
        label: summarize(hits),
      };
    }

    const q = normalize(original);
    if (!q) {
      return {
        served: false,
        matchType: "empty",
        query: original,
        zip: null,
        places: [],
        county: null,
        label: "",
      };
    }

    const counties = data.counties || [];
    for (let i = 0; i < counties.length; i++) {
      const county = counties[i];
      const labels = [county.name].concat(county.aliases || []).map(normalize);
      if (labels.indexOf(q) !== -1) {
        const places = (data.places || []).filter(function (place) {
          return normalize(place.county) === normalize(county.id) || place.county === county.id;
        });
        return {
          served: true,
          matchType: "county",
          query: original,
          zip: null,
          places: places,
          county: county.id,
          label: county.name,
        };
      }
    }

    const exact = [];
    const partial = [];
    (data.places || []).forEach(function (place) {
      const names = namesFor(place);
      if (names.indexOf(q) !== -1) exact.push(place);
      else if (q.length >= 4 && names.some(function (name) { return name.indexOf(q) === 0; })) {
        partial.push(place);
      }
    });

    const hits = exact.length ? exact : partial;
    return {
      served: hits.length > 0,
      matchType: exact.length ? "city" : hits.length ? "partial" : "none",
      query: original,
      zip: null,
      places: uniquePlaces(hits),
      county: hits.length === 1 ? hits[0].county : null,
      label: summarize(hits),
    };
  }

  return {
    normalize: normalize,
    checkServiceArea: checkServiceArea,
    summarize: summarize,
  };
});
