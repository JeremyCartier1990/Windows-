(function () {
  "use strict";

  var root = document.getElementById("estimator");
  if (!root || !window.SCW || !window.SCWPricing || !window.SCWPreview) return;

  var catalog = window.SCW.catalog;
  var pricing = window.SCW.pricing;
  var products = catalog.products;
  var byId = {};
  products.forEach(function (product) {
    byId[product.id] = product;
  });

  var colorName = {};
  var gridName = {};
  var glassName = {};
  (catalog.frameColors || []).forEach(function (item) { colorName[item.id] = item.name; });
  (catalog.grids || []).forEach(function (item) { gridName[item.id] = item.name; });
  (catalog.glass || []).forEach(function (item) { glassName[item.id] = item.name; });

  function uid() {
    return Math.random().toString(36).slice(2, 8);
  }

  function blankLine(productId) {
    var product = productId ? byId[productId] : null;
    return {
      lineId: uid(),
      productId: product ? product.id : "",
      frameColor: "white",
      grid: "none",
      glass: product && product.glass && product.glass[0] ? product.glass[0] : "dual-low-e",
      qty: 1,
      widthIn: "",
      heightIn: "",
      measureForMe: false,
    };
  }

  var state = {
    area: null,
    lines: [blankLine()],
    addons: { removal: false, installMethod: "retrofit", stucco: false, permit: false },
  };

  var measureLine = 0;

  function money(cents) {
    return window.SCWPricing.formatUSD(cents);
  }

  function loadSession() {
    try {
      var raw = sessionStorage.getItem("scw-estimate");
      if (!raw) return;
      var saved = JSON.parse(raw);
      if (saved && Array.isArray(saved.lines) && saved.lines.length) state.lines = saved.lines;
      if (saved && saved.addons) state.addons = Object.assign(state.addons, saved.addons);
      if (saved && saved.area) state.area = saved.area;
    } catch (err) {}
  }

  function saveSession() {
    try {
      sessionStorage.setItem("scw-estimate", JSON.stringify({ lines: state.lines, addons: state.addons, area: state.area }));
    } catch (err) {}
  }

  function h(tag, props) {
    var node = document.createElement(tag);
    var children = Array.prototype.slice.call(arguments, 2);
    if (props) {
      Object.keys(props).forEach(function (key) {
        var value = props[key];
        if (value == null || value === false) return;
        if (key === "class") node.className = value;
        else if (key === "text") node.textContent = value;
        else node.setAttribute(key, value === true ? "" : String(value));
      });
    }
    children.forEach(function (child) {
      if (child == null || child === false) return;
      if (Array.isArray(child)) {
        child.forEach(function (nested) {
          if (nested) node.appendChild(nested);
        });
        return;
      }
      node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
    });
    return node;
  }

  function choiceButtons(line, kind, allowed, labels) {
    var wrap = h("div", { class: "choices", role: "group", "aria-label": kind });
    allowed.forEach(function (id) {
      var pressed = line[kind] === id;
      var button = h("button", {
        type: "button",
        class: "choice" + (pressed ? " is-on" : ""),
        "data-choice": kind,
        "data-value": id,
        "aria-pressed": pressed ? "true" : "false",
        text: labels[id] || id,
      });
      wrap.appendChild(button);
    });
    return wrap;
  }

  function renderLines() {
    var host = document.getElementById("lines");
    host.textContent = "";
    state.lines.forEach(function (line, index) {
      var product = byId[line.productId];
      var options = [h("option", { value: "", text: "Choose a window" })];
      products.forEach(function (item) {
        var opt = h("option", { value: item.id, text: item.name + " · " + tierLabel(item.tier) });
        if (item.id === line.productId) opt.setAttribute("selected", "");
        options.push(opt);
      });
      var preview = h("div", {
        class: "line-preview",
        "data-preview": "1",
        "data-uid": "line" + index + line.lineId,
        "data-type": product ? product.type : "picture",
        "data-shape": product && product.shape ? product.shape : "",
        "data-color": line.frameColor,
        "data-grid": line.grid,
        "data-panels": product && product.id === "patio-slider-3" ? "3" : "2",
        "data-label": product ? product.name : "Window preview",
      });
      var card = h(
        "article",
        { class: "line-card", "data-index": String(index) },
        h(
          "div",
          { class: "line-card-top" },
          h("h3", { text: "Window " + (index + 1) }),
          h("p", { class: "line-price", "data-line-price": String(index), text: "" }),
          state.lines.length > 1
            ? h("button", { type: "button", class: "text-btn", "data-action": "remove", text: "Remove" })
            : null
        ),
        h(
          "div",
          { class: "line-layout" },
          preview,
          h(
            "div",
            { class: "line-fields" },
            h("label", { class: "field" }, "Window", h("select", { name: "product" }, options)),
            product
              ? h("div", { class: "field" }, "Frame", choiceButtons(line, "frameColor", product.frameColors, colorName))
              : null,
            product
              ? h("div", { class: "field" }, "Grids", choiceButtons(line, "grid", product.grids, gridName))
              : null,
            product
              ? h("div", { class: "field" }, "Glass", choiceButtons(line, "glass", product.glass, glassName))
              : null,
            h(
              "div",
              { class: "dims" },
              h("label", { class: "field" }, "Qty", h("input", { name: "qty", type: "number", min: "1", max: "30", inputmode: "numeric", value: String(line.qty) })),
              h("label", { class: "field" }, "Width (in)", h("input", { name: "width", inputmode: "decimal", placeholder: "36", value: line.widthIn })),
              h("label", { class: "field" }, "Height (in)", h("input", { name: "height", inputmode: "decimal", placeholder: "60", value: line.heightIn }))
            ),
            h(
              "div",
              { class: "line-actions" },
              h("button", { type: "button", class: "btn btn-ghost", "data-action": "measure", text: "Measurement helper" }),
              h(
                "label",
                { class: "checkline" },
                h("input", { type: "checkbox", name: "measureForMe" }),
                h("span", { text: "Not sure — measure for me" })
              )
            ),
            h("p", { class: "line-note", "data-line-note": String(index) })
          )
        )
      );
      var unsure = card.querySelector("[name=measureForMe]");
      if (line.measureForMe) unsure.checked = true;
      host.appendChild(card);
    });
    window.SCWPreview.mountAll(host);
  }

  function tierLabel(id) {
    if (id === "good") return "Good";
    if (id === "better") return "Better";
    if (id === "best") return "Best";
    return id;
  }

  function syncFromDom() {
    var cards = document.querySelectorAll(".line-card");
    cards.forEach(function (card, index) {
      var line = state.lines[index];
      if (!line) return;
      var product = card.querySelector("[name=product]");
      var qty = card.querySelector("[name=qty]");
      var width = card.querySelector("[name=width]");
      var height = card.querySelector("[name=height]");
      var unsure = card.querySelector("[name=measureForMe]");
      line.productId = product ? product.value : "";
      line.qty = qty && qty.value ? Number(qty.value) : 1;
      line.widthIn = width ? width.value : "";
      line.heightIn = height ? height.value : "";
      line.measureForMe = !!(unsure && unsure.checked);
      ["frameColor", "grid", "glass"].forEach(function (kind) {
        var on = card.querySelector('[data-choice="' + kind + '"][aria-pressed="true"]');
        if (on) line[kind] = on.getAttribute("data-value");
      });
    });
    state.addons.removal = document.getElementById("addon-removal").checked;
    state.addons.stucco = document.getElementById("addon-stucco").checked;
    state.addons.permit = document.getElementById("addon-permit").checked;
    var method = document.querySelector("input[name=installMethod]:checked");
    state.addons.installMethod = method ? method.value : "retrofit";
  }

  function currentQuote() {
    syncFromDom();
    var active = [];
    var errors = [];
    state.lines.forEach(function (raw, index) {
      if (!raw.productId) return;
      var priced = window.SCWPricing.priceLine(byId[raw.productId], pricing, raw);
      if (!priced.ok) {
        priced.errors.forEach(function (message) {
          errors.push("Window " + (index + 1) + ": " + message);
        });
        return;
      }
      active.push({ index: index, line: priced.line });
    });
    if (!active.length && !errors.length) errors.push("Choose a window to begin.");
    if (errors.length) return { ok: false, errors: errors, partial: active };
    var cart = window.SCWPricing.priceCart(products, pricing, {
      lines: active.map(function (row) { return state.lines[row.index]; }),
      addons: state.addons,
    });
    if (!cart.ok) return cart;
    cart.quote.lines.forEach(function (line, i) {
      line._index = active[i].index;
    });
    return cart;
  }

  function optionPhrase(line) {
    return [colorName[line.frameColor] || line.frameColor, gridName[line.grid] || line.grid, glassName[line.glass] || line.glass].join(" · ");
  }

  function updateSummary() {
    var result = currentQuote();
    var box = document.getElementById("est-summary");
    var mobile = document.getElementById("mobile-total-amount");
    box.textContent = "";
    box.appendChild(h("p", { class: "summary-kicker", text: "Installed estimate" }));
    box.appendChild(h("h2", { text: "Your windows" }));

    if (!result.ok) {
      var pending = state.lines.some(function (line) { return line.productId; });
      box.appendChild(h("p", { class: "summary-hint", text: pending ? "Add a size to each window to see the total. Use the helper if you are measuring now." : "Choose a window to begin. Installation is included in the price." }));
      if (result.errors && result.errors.length && pending) {
        var list = h("ul", { class: "summary-errors" });
        result.errors.slice(0, 4).forEach(function (message) {
          list.appendChild(h("li", { text: message }));
        });
        box.appendChild(list);
      }
      if (mobile) mobile.textContent = "—";
      document.querySelectorAll("[data-line-price]").forEach(function (node) { node.textContent = ""; });
      saveSession();
      return;
    }

    var quote = result.quote;
    quote.lines.forEach(function (line) {
      var size = line.measureForMe && line.pricedFrom === "reference"
        ? "Planning size " + line.widthIn + " × " + line.heightIn + " in"
        : line.qty + " × " + trimNum(line.widthIn) + " × " + trimNum(line.heightIn) + " in";
      var block = h(
        "div",
        { class: "sum-line" },
        h("div", {}, h("strong", { text: line.name }), h("span", { text: size + " · " + optionPhrase(line) })),
        h("div", { class: "sum-split" }, h("span", { text: "Window" }), h("span", { text: money(line.materialCents) })),
        h("div", { class: "sum-split" }, h("span", { text: "Installation" }), h("span", { text: money(line.installCents) }))
      );
      box.appendChild(block);
    });

    if (quote.addons && quote.addons.length) {
      var addons = quote.addons.filter(function (row) { return row.cents || row.id === "retrofit"; });
      addons.forEach(function (row) {
        box.appendChild(
          h("div", { class: "sum-split addon" }, h("span", { text: row.label }), h("span", { text: row.cents ? money(row.cents) : "Included" }))
        );
      });
    }

    box.appendChild(
      h(
        "div",
        { class: "sum-total" },
        h("span", { text: "Total" }),
        h("strong", { id: "summary-total", text: money(quote.totalCents) })
      )
    );
    box.appendChild(h("p", { class: "summary-fine", text: "Includes installation. This is an estimate, not a contract. If you book a measurement, we keep this price as the starting point and confirm the final quote on site." }));
    if (mobile) mobile.textContent = money(quote.totalCents);

    document.querySelectorAll("[data-line-price]").forEach(function (node) { node.textContent = ""; });
    quote.lines.forEach(function (line) {
      var card = document.querySelector('.line-card[data-index="' + line._index + '"]');
      if (!card) return;
      var price = card.querySelector("[data-line-price]");
      var note = card.querySelector("[data-line-note]");
      if (price) price.textContent = money(line.lineCents);
      if (!note) return;
      if (line.measureForMe && line.pricedFrom === "reference") {
        note.textContent = "We’ll measure this opening. The price uses a typical " + trimNum(line.widthIn) + " × " + trimNum(line.heightIn) + " in size so you can plan. The final quote is confirmed after the visit.";
      } else if (line.measureForMe) {
        note.textContent = "You asked us to measure on site. This price uses the size you typed, and the final quote is confirmed after the visit.";
      } else {
        note.textContent = "We price the size you enter. If you measured in three places, use the smallest width and the smallest height.";
      }
    });
    saveSession();
    return quote;
  }

  function trimNum(value) {
    var n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    return String(Math.round(n * 1000) / 1000);
  }

  function refreshPreview(index) {
    var card = document.querySelector('.line-card[data-index="' + index + '"]');
    if (!card) return;
    var line = state.lines[index];
    var product = byId[line.productId];
    var slot = card.querySelector(".line-preview");
    window.SCWPreview.mount(slot, {
      uid: "live" + index + line.lineId,
      type: product ? product.type : "picture",
      shape: product ? product.shape : "",
      frameColor: line.frameColor,
      grid: line.grid,
      panels: product && product.id === "patio-slider-3" ? 3 : 2,
      label: product ? product.name : "Window preview",
    });
  }

  function setArea(result) {
    state.area = result;
    var status = document.getElementById("area-status");
    status.classList.remove("is-yes", "is-no");
    status.textContent = "";
    if (!result || result.matchType === "empty") {
      status.textContent = "Enter a ZIP or city to see if we install there.";
      return;
    }
    if (result.served) {
      status.classList.add("is-yes");
      var place = result.label || "this area";
      status.textContent = result.matchType === "county"
        ? "Yes — we serve " + place + "."
        : "Yes — we install in " + place + ".";
      var zipInput = document.querySelector("#form-order input[name=zip], #form-book input[name=zip]");
      document.querySelectorAll("#form-order input[name=zip], #form-book input[name=zip]").forEach(function (input) {
        if (result.zip && !input.value) input.value = result.zip;
      });
      if (zipInput && result.places && result.places[0] && !document.querySelector("#form-order input[name=city]").value) {
        document.querySelector("#form-order input[name=city]").value = result.places[0].city;
      }
    } else {
      status.classList.add("is-no");
      status.textContent = result.zip
        ? "ZIP " + result.zip + " is outside today’s service area. We cover Los Angeles County and nearby Orange and Ventura counties."
        : "That city is outside today’s service area. Try a ZIP, or send a note and we’ll tell you if we can help.";
    }
    saveSession();
  }

  function checkArea(query) {
    var result = window.SCWArea.checkServiceArea(window.SCW.serviceArea, query);
    setArea(result);
    var input = document.getElementById("est-area");
    if (input && query) input.value = query;
    return result;
  }

  function formError(form, messages) {
    var box = form.querySelector(".form-error");
    if (!box) return;
    box.textContent = "";
    if (!messages || !messages.length) {
      box.hidden = true;
      return;
    }
    box.hidden = false;
    messages.forEach(function (message) {
      box.appendChild(h("p", { text: message }));
    });
  }

  function readCustomer(form) {
    function val(name) {
      var field = form.querySelector("[name='" + name + "']");
      return field ? field.value.trim() : "";
    }
    var consent = form.querySelector("[name=smsConsent]");
    return {
      name: val("name"),
      email: val("email"),
      phone: val("phone"),
      smsConsent: !!(consent && consent.checked),
      address: val("address"),
      city: val("city"),
      zip: val("zip"),
      notes: val("notes"),
      companyWebsite: val("companyWebsite"),
    };
  }

  function showConfirmation(kind, payload, response) {
    var panel = document.getElementById("confirmation");
    var app = document.getElementById("estimator");
    var intro = document.querySelector(".page-hero");
    panel.hidden = false;
    app.hidden = true;
    if (intro) intro.hidden = true;
    panel.textContent = "";
    var title = kind === "order" ? "Order received" : kind === "appointment" ? "Measurement requested" : "Estimate saved";
    panel.appendChild(h("p", { class: "kicker", text: "Confirmation " + (response.confirmationCode || "") }));
    panel.appendChild(h("h1", { text: title }));
    if (kind === "appointment") {
      panel.appendChild(h("p", { class: "lead", text: "We’ll call or text to confirm the visit. The price you saw stays the starting point. It is an estimate, and the final quote is confirmed after we measure on site. No payment was collected." }));
    } else if (kind === "order") {
      panel.appendChild(h("p", { class: "lead", text: "We have the order and the installed estimate. Nothing has been charged. We’ll contact you to confirm sizes and timing before anything is ordered from the supplier." }));
    } else {
      panel.appendChild(h("p", { class: "lead", text: "We saved this estimate and will follow up. The number below includes installation and is not a contract." }));
    }
    if (response.totalCents != null) {
      panel.appendChild(h("p", { class: "confirm-total", text: money(response.totalCents) }));
      panel.appendChild(h("p", { class: "summary-fine", text: "Installed estimate total" }));
    }
    if (payload.appointment) {
      panel.appendChild(h("p", { text: "Requested " + payload.appointment.date + " · " + payload.appointment.timeWindow + "." }));
    }
    if (kind === "order") {
      var slot = h("div", { class: "pay-slot" });
      slot.appendChild(h("p", { class: "kicker", text: "Payment · coming soon" }));
      slot.appendChild(h("p", { text: window.SCW.site.payment.customerCopy }));
      panel.appendChild(slot);
    }
    panel.appendChild(h("a", { class: "btn", href: "/", text: "Back to the home page" }));
    window.scrollTo(0, 0);
  }

  async function submitForm(form, kind) {
    formError(form, []);
    syncFromDom();
    var customer = readCustomer(form);
    var messages = [];
    if (customer.companyWebsite) {
      showConfirmation(kind, {}, { confirmationCode: "SCW-RECEIVED", totalCents: null });
      return;
    }
    var priced = currentQuote();
    var needsCart = kind === "order" || kind === "appointment" || (kind === "estimate" && (!state.area || state.area.served));
    if (needsCart && !priced.ok) messages = messages.concat(priced.errors);
    if (!state.area) messages.push("Check your ZIP or city first.");
    if (state.area && !state.area.served && kind !== "estimate") {
      messages.push("Orders and measurement visits are limited to our service area.");
    }
    if (kind === "order") {
      if (!customer.address) messages.push("Enter the installation address.");
      if (!customer.city) messages.push("Enter the city.");
    }
    if (kind === "order" || kind === "appointment") {
      if (!/^\d{5}$/.test(customer.zip)) messages.push("Enter a 5-digit ZIP.");
    }
    var appointment = null;
    if (kind === "appointment") {
      appointment = {
        date: form.querySelector("[name=date]").value,
        timeWindow: form.querySelector("[name=timeWindow]").value,
        altDate: form.querySelector("[name=altDate]").value,
      };
      if (!appointment.date) messages.push("Pick a preferred date.");
      if (!appointment.timeWindow) messages.push("Pick a time window.");
    }
    if (!customer.name) messages.push("Enter your name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) messages.push("Enter a valid email.");
    var digits = customer.phone.replace(/\D/g, "");
    if (!(digits.length === 10 || (digits.length === 11 && digits.charAt(0) === "1"))) messages.push("Enter a 10-digit phone number.");
    if (!customer.smsConsent) messages.push("Check the box to agree to text messages, or call us instead.");
    if (messages.length) {
      formError(form, messages);
      return;
    }

    var endpoint = kind === "order" ? "/api/order" : kind === "appointment" ? "/api/appointment" : "/api/estimate";
    var body = {
      intent: state.area && state.area.served ? kind : "out-of-area",
      serviceArea: state.area,
      lines: state.lines,
      addons: state.addons,
      customer: customer,
      appointment: appointment,
      clientTotalCents: priced.ok ? priced.quote.totalCents : null,
      page: window.location.pathname,
      companyWebsite: "",
    };
    var button = form.querySelector("[type=submit]");
    var previous = button.textContent;
    button.disabled = true;
    button.textContent = "Sending…";
    try {
      var res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      var data = await res.json().catch(function () { return {}; });
      if (!res.ok || !data.ok) {
        formError(form, [data.error || "We couldn’t send that. Please try again."].concat(data.errors || []));
        button.disabled = false;
        button.textContent = previous;
        return;
      }
      showConfirmation(kind, body, data);
    } catch (err) {
      formError(form, ["We couldn’t reach the server. Please try again in a moment."]);
      button.disabled = false;
      button.textContent = previous;
    }
  }

  function openMeasure(index) {
    measureLine = index;
    var dialog = document.getElementById("measure-dialog");
    ["w1", "w2", "w3", "h1", "h2", "h3"].forEach(function (name) {
      var field = dialog.querySelector("[name=" + name + "]");
      if (field) field.value = "";
    });
    dialog.querySelector(".measure-result").textContent = "Enter all six measurements.";
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }

  function smallest(values) {
    var nums = values.map(Number).filter(function (n) { return Number.isFinite(n) && n > 0; });
    if (nums.length !== values.length) return null;
    return Math.min.apply(null, nums);
  }

  function updateMeasureReadout() {
    var dialog = document.getElementById("measure-dialog");
    var width = smallest(["w1", "w2", "w3"].map(function (name) { return dialog.querySelector("[name=" + name + "]").value; }));
    var height = smallest(["h1", "h2", "h3"].map(function (name) { return dialog.querySelector("[name=" + name + "]").value; }));
    var out = dialog.querySelector(".measure-result");
    if (width == null || height == null) {
      out.textContent = "Enter all three widths and all three heights. We’ll use the smallest of each.";
      return;
    }
    out.textContent = "Smallest opening: " + trimNum(width) + " in wide × " + trimNum(height) + " in high.";
  }

  document.getElementById("est-area-form").addEventListener("submit", function (event) {
    event.preventDefault();
    checkArea(document.getElementById("est-area").value);
  });

  document.getElementById("lines").addEventListener("click", function (event) {
    var choice = event.target.closest("[data-choice]");
    if (choice) {
      var card = choice.closest(".line-card");
      var index = Number(card.getAttribute("data-index"));
      var kind = choice.getAttribute("data-choice");
      state.lines[index][kind] = choice.getAttribute("data-value");
      card.querySelectorAll('[data-choice="' + kind + '"]').forEach(function (button) {
        var on = button === choice;
        button.classList.toggle("is-on", on);
        button.setAttribute("aria-pressed", on ? "true" : "false");
      });
      refreshPreview(index);
      updateSummary();
      return;
    }
    var action = event.target.closest("[data-action]");
    if (!action) return;
    var card = action.closest(".line-card");
    var index = Number(card.getAttribute("data-index"));
    if (action.getAttribute("data-action") === "remove") {
      syncFromDom();
      state.lines.splice(index, 1);
      renderLines();
      updateSummary();
    }
    if (action.getAttribute("data-action") === "measure") openMeasure(index);
  });

  document.getElementById("lines").addEventListener("change", function (event) {
    var card = event.target.closest(".line-card");
    if (!card) return;
    var index = Number(card.getAttribute("data-index"));
    if (event.target.name === "product") {
      syncFromDom();
      var product = byId[state.lines[index].productId];
      if (product) {
        if (product.frameColors.indexOf(state.lines[index].frameColor) === -1) state.lines[index].frameColor = product.frameColors[0];
        if (product.grids.indexOf(state.lines[index].grid) === -1) state.lines[index].grid = product.grids[0];
        if (product.glass.indexOf(state.lines[index].glass) === -1) state.lines[index].glass = product.glass[0];
      }
      renderLines();
      updateSummary();
      return;
    }
    if (event.target.name === "measureForMe") {
      syncFromDom();
      updateSummary();
      return;
    }
    updateSummary();
  });

  document.getElementById("lines").addEventListener("input", function (event) {
    if (event.target.name === "width" || event.target.name === "height" || event.target.name === "qty") updateSummary();
  });

  document.getElementById("add-line").addEventListener("click", function () {
    syncFromDom();
    state.lines.push(blankLine());
    renderLines();
    updateSummary();
    var cards = document.querySelectorAll(".line-card");
    if (cards.length) cards[cards.length - 1].scrollIntoView({ behavior: "smooth", block: "center" });
  });

  document.getElementById("addons").addEventListener("change", function () {
    updateSummary();
  });

  document.getElementById("measure-dialog").addEventListener("input", updateMeasureReadout);
  document.getElementById("measure-apply").addEventListener("click", function () {
    var dialog = document.getElementById("measure-dialog");
    var width = smallest(["w1", "w2", "w3"].map(function (name) { return dialog.querySelector("[name=" + name + "]").value; }));
    var height = smallest(["h1", "h2", "h3"].map(function (name) { return dialog.querySelector("[name=" + name + "]").value; }));
    if (width == null || height == null) {
      updateMeasureReadout();
      return;
    }
    var card = document.querySelector('.line-card[data-index="' + measureLine + '"]');
    card.querySelector("[name=width]").value = trimNum(width);
    card.querySelector("[name=height]").value = trimNum(height);
    card.querySelector("[name=measureForMe]").checked = false;
    state.lines[measureLine].measureForMe = false;
    if (typeof dialog.close === "function") dialog.close();
    updateSummary();
  });
  document.getElementById("measure-unsure").addEventListener("click", function () {
    var card = document.querySelector('.line-card[data-index="' + measureLine + '"]');
    card.querySelector("[name=measureForMe]").checked = true;
    state.lines[measureLine].measureForMe = true;
    var dialog = document.getElementById("measure-dialog");
    if (typeof dialog.close === "function") dialog.close();
    updateSummary();
  });

  ["form-save", "form-order", "form-book"].forEach(function (id) {
    var form = document.getElementById(id);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      var kind = form.getAttribute("data-kind");
      submitForm(form, kind);
    });
  });

  loadSession();
  var params = new URLSearchParams(window.location.search);
  if (params.get("product") && byId[params.get("product")]) {
    if (!state.lines.length) state.lines = [blankLine()];
    if (!state.lines[0].productId) state.lines[0] = blankLine(params.get("product"));
    else if (state.lines.every(function (line) { return line.productId !== params.get("product"); }) && state.lines.length === 1 && !state.lines[0].widthIn) {
      state.lines[0].productId = params.get("product");
    }
  }
  document.getElementById("addon-removal").checked = !!state.addons.removal;
  document.getElementById("addon-stucco").checked = !!state.addons.stucco;
  document.getElementById("addon-permit").checked = !!state.addons.permit;
  var method = document.querySelector('input[name=installMethod][value="' + (state.addons.installMethod || "retrofit") + '"]');
  if (method) method.checked = true;

  var areaQuery = params.get("area");
  if (areaQuery) checkArea(areaQuery);
  else if (state.area) setArea(state.area);

  var today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date());
  document.querySelectorAll("input[type=date]").forEach(function (input) {
    input.min = today;
  });
  var timeSelect = document.querySelector("#form-book select[name=timeWindow]");
  (window.SCW.site.timeWindows || []).forEach(function (label) {
    timeSelect.appendChild(h("option", { value: label, text: label }));
  });

  renderLines();
  updateSummary();
})();
