(function () {
  "use strict";
  document.documentElement.classList.add("js");

  var header = document.querySelector(".site-header");
  var toggle = document.querySelector(".nav-toggle");
  var nav = document.getElementById("site-nav");

  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
    var bar = document.querySelector(".scroll-progress");
    if (!bar) return;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = "scaleX(" + (max > 0 ? window.scrollY / max : 0) + ")";
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce && "IntersectionObserver" in window) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 }
    );
    document.querySelectorAll(".reveal").forEach(function (node) {
      io.observe(node);
    });
  } else {
    document.querySelectorAll(".reveal").forEach(function (node) {
      node.classList.add("is-in");
    });
  }

  document.querySelectorAll("[data-year]").forEach(function (node) {
    node.textContent = String(new Date().getFullYear());
  });

  function areaData() {
    return window.SCW && window.SCW.serviceArea;
  }

  function paintArea(form, result) {
    var out = form.querySelector(".area-result");
    if (!out) return;
    out.classList.remove("is-yes", "is-no");
    if (!result || result.matchType === "empty") {
      out.textContent = "";
      return;
    }
    if (result.served) {
      out.classList.add("is-yes");
      var where = result.label || "your area";
      var county = result.county ? result.county + " County" : "";
      var sentence = result.matchType === "county"
        ? "Yes. We serve " + where + "."
        : "Yes. We install in " + where + (county && result.label.indexOf(county.replace(" County", "")) === -1 ? " · " + county : "") + ".";
      out.textContent = "";
      var strong = document.createElement("strong");
      strong.textContent = sentence;
      out.appendChild(strong);
      var link = document.createElement("a");
      var query = result.zip || result.query;
      link.href = "/estimate?area=" + encodeURIComponent(query);
      link.textContent = "Start an estimate";
      out.appendChild(document.createTextNode(" "));
      out.appendChild(link);
    } else {
      out.classList.add("is-no");
      var no = document.createElement("strong");
      no.textContent = result.zip
        ? "Not in today’s service area for ZIP " + result.zip + "."
        : "We don’t recognize that city in our service area.";
      out.appendChild(no);
      var more = document.createElement("span");
      more.textContent = " We cover Los Angeles County and nearby Orange County and Ventura County.";
      out.appendChild(more);
      var contact = document.createElement("a");
      contact.href = "/about#contact";
      contact.textContent = "Ask us anyway";
      out.appendChild(document.createTextNode(" "));
      out.appendChild(contact);
    }
  }

  document.querySelectorAll("[data-area-check]").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!window.SCWArea || !areaData()) return;
      var input = form.querySelector("input[name='q']");
      var result = window.SCWArea.checkServiceArea(areaData(), input ? input.value : "");
      paintArea(form, result);
      try {
        sessionStorage.setItem("scw-area", JSON.stringify({ query: input.value, result: { served: result.served, label: result.label, zip: result.zip, matchType: result.matchType, county: result.county, query: result.query } }));
      } catch (err) {}
    });
  });

  function fillFromPrices() {
    if (!window.SCWPricing || !window.SCW || !window.SCW.catalog) return;
    var byId = {};
    window.SCW.catalog.products.forEach(function (product) {
      byId[product.id] = product;
    });
    document.querySelectorAll("[data-from-price]").forEach(function (node) {
      var product = byId[node.getAttribute("data-from-price")];
      if (!product) return;
      var cents = window.SCWPricing.fromPriceCents(product, window.SCW.pricing);
      if (cents == null) return;
      node.textContent = window.SCWPricing.formatUSD(cents);
    });
  }
  fillFromPrices();

  if (window.SCWPreview) window.SCWPreview.mountAll(document);

  var faqSearch = document.querySelector("[data-faq-filter]");
  if (faqSearch) {
    faqSearch.addEventListener("input", function () {
      var q = faqSearch.value.trim().toLowerCase();
      document.querySelectorAll(".faq details").forEach(function (item) {
        var text = item.textContent.toLowerCase();
        item.hidden = q.length > 1 && text.indexOf(q) === -1;
      });
    });
  }
})();
