/**
 * Customer-price math for Sunset Coast Windows.
 *
 * PLACEHOLDER PRICES: every dollar figure comes from data/pricing.json, which
 * holds stand-in Los Angeles retail numbers. Jeremy must replace those with
 * real customer prices (supplier cost + markup, calculated offline). Never put
 * supplier cost or markup in this repo or on the site — this module only
 * reads and returns the customer price.
 *
 * Formula (all money in integer cents, then rounded to the nearest dollar
 * per window so an itemized total adds up exactly):
 *
 *   united inches = width + height
 *   material each = round_to_dollar(
 *        base
 *      + perUnitedInch * united inches
 *      + frame color adder
 *      + grid adder
 *      + glass adder
 *   )
 *   install each  = bracket for that united-inch size and install class
 *                    (window, bay, or door)
 *   line          = (material each + install each) * quantity
 *   add-ons       = per-window charges * total quantity, plus per-project charges
 *   total         = lines + add-ons
 *
 * Installation is always included in the total. Retrofit / insert install is
 * the base install price. Full-frame, stucco, removal, and permits are add-ons.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SCWPricing = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function nearestDollarCents(cents) {
    if (!Number.isFinite(cents)) return 0;
    return Math.round(cents / 100) * 100;
  }

  function formatUSD(cents) {
    const n = Number.isFinite(cents) ? Math.round(cents / 100) : 0;
    const sign = n < 0 ? "-" : "";
    return sign + "$" + Math.abs(n).toLocaleString("en-US");
  }

  function parseInches(value) {
    if (value === null || value === undefined || value === "") return null;
    const n = typeof value === "number" ? value : Number(String(value).trim());
    if (!Number.isFinite(n)) return null;
    return Math.round(n * 1000) / 1000;
  }

  function indexProducts(products) {
    const map = Object.create(null);
    (products || []).forEach(function (product) {
      map[product.id] = product;
    });
    return map;
  }

  function optionCents(table, id) {
    if (!id) return { ok: true, cents: 0 };
    if (!table || !Object.prototype.hasOwnProperty.call(table, id)) {
      return { ok: false, cents: 0 };
    }
    const cents = table[id];
    if (!Number.isFinite(cents) || cents < 0) return { ok: false, cents: 0 };
    return { ok: true, cents: cents };
  }

  function installEachCents(pricing, installClass, unitedInches) {
    const table = (pricing.installation || {})[installClass] || pricing.installation.window;
    if (!table || !table.length) return 0;
    const sorted = table.slice().sort(function (a, b) {
      return a.maxUnitedInches - b.maxUnitedInches;
    });
    for (let i = 0; i < sorted.length; i++) {
      if (unitedInches <= sorted[i].maxUnitedInches) return sorted[i].perWindowCents;
    }
    return sorted[sorted.length - 1].perWindowCents;
  }

  function priceLine(product, pricing, line) {
    const errors = [];
    if (!product) {
      errors.push("Choose a window for each line.");
      return { ok: false, errors: errors };
    }
    const spec = (pricing.products || {})[product.id];
    if (!spec) {
      errors.push("No price is set for " + product.name + ".");
      return { ok: false, errors: errors };
    }

    const limits = product.limits || {};
    const measureForMe = !!line.measureForMe;
    let width = parseInches(line.widthIn);
    let height = parseInches(line.heightIn);
    let pricedFrom = "entered";
    if (measureForMe && (width === null || height === null)) {
      width = product.reference.widthIn;
      height = product.reference.heightIn;
      pricedFrom = "reference";
    }
    if (width === null || height === null) {
      errors.push("Enter width and height in inches, or choose “measure for me”.");
    } else {
      if (width < limits.minWidth || width > limits.maxWidth) {
        errors.push(
          product.name +
            " width must be between " +
            limits.minWidth +
            " and " +
            limits.maxWidth +
            " inches."
        );
      }
      if (height < limits.minHeight || height > limits.maxHeight) {
        errors.push(
          product.name +
            " height must be between " +
            limits.minHeight +
            " and " +
            limits.maxHeight +
            " inches."
        );
      }
    }

    const qty = Number(line.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 30) {
      errors.push("Quantity must be a whole number from 1 to 30.");
    }

    const color = line.frameColor || "white";
    const grid = line.grid || "none";
    const glass = line.glass || "dual-low-e";
    if ((product.frameColors || []).indexOf(color) === -1) {
      errors.push("That frame color is not available on " + product.name + ".");
    }
    if ((product.grids || []).indexOf(grid) === -1) {
      errors.push("That grid style is not available on " + product.name + ".");
    }
    if ((product.glass || []).indexOf(glass) === -1) {
      errors.push("That glass option is not available on " + product.name + ".");
    }

    const colorOpt = optionCents(pricing.frameColors, color);
    const gridOpt = optionCents(pricing.grids, grid);
    const glassOpt = optionCents(pricing.glass, glass);
    if (!colorOpt.ok || !gridOpt.ok || !glassOpt.ok) {
      errors.push("A selected option has no customer price configured.");
    }
    if (errors.length) return { ok: false, errors: errors };

    const united = width + height;
    const raw =
      spec.baseCents +
      Math.round(spec.perUnitedInchCents * united) +
      colorOpt.cents +
      gridOpt.cents +
      glassOpt.cents;
    const materialEachCents = nearestDollarCents(raw);
    const installEachCentsValue = installEachCents(
      pricing,
      product.installClass || "window",
      united
    );

    return {
      ok: true,
      errors: [],
      line: {
        productId: product.id,
        name: product.name,
        brand: product.brand,
        type: product.type,
        tier: product.tier,
        qty: qty,
        widthIn: width,
        heightIn: height,
        frameColor: color,
        grid: grid,
        glass: glass,
        measureForMe: measureForMe,
        pricedFrom: pricedFrom,
        unitedInches: Math.round(united * 1000) / 1000,
        materialEachCents: materialEachCents,
        installEachCents: installEachCentsValue,
        materialCents: materialEachCents * qty,
        installCents: installEachCentsValue * qty,
        lineCents: (materialEachCents + installEachCentsValue) * qty,
      },
    };
  }

  function priceAddons(pricing, addons, totalQty) {
    const src = pricing.addons || {};
    const selected = addons || {};
    const detail = [];
    function push(id, label, cents) {
      if (!cents) {
        detail.push({ id: id, label: label, cents: 0 });
        return;
      }
      detail.push({ id: id, label: label, cents: cents });
    }

    if (selected.removal) {
      push(
        "removal",
        src.removal.label,
        src.removal.perUnitCents * totalQty
      );
    }
    const method = selected.installMethod === "full-frame" ? "full-frame" : "retrofit";
    if (method === "full-frame") {
      push(
        "full-frame",
        src.fullFrame.label,
        src.fullFrame.perUnitCents * totalQty
      );
    } else {
      push("retrofit", src.retrofit.label, 0);
    }
    if (selected.stucco) {
      push("stucco", src.stucco.label, src.stucco.perUnitCents * totalQty);
    }
    if (selected.permit) {
      push("permit", src.permit.label, src.permit.perProjectCents);
    }

    const cents = detail.reduce(function (sum, row) {
      return sum + row.cents;
    }, 0);
    return { installMethod: method, detail: detail, cents: cents };
  }

  /**
   * Price a cart.
   * products: catalog product array
   * pricing: data/pricing.json
   * cart: { lines: [...], addons: { removal, installMethod, stucco, permit } }
   */
  function priceCart(products, pricing, cart) {
    const byId = indexProducts(products);
    const linesIn = (cart && cart.lines) || [];
    const errors = [];
    if (!linesIn.length) errors.push("Add at least one window.");
    if (linesIn.length > 25) errors.push("An estimate can include up to 25 lines.");

    const lines = [];
    linesIn.forEach(function (raw, index) {
      const product = raw && raw.productId ? byId[raw.productId] : null;
      if (raw && raw.productId && !product) {
        errors.push("Line " + (index + 1) + " uses an unknown window.");
        return;
      }
      const priced = priceLine(product, pricing, raw || {});
      if (!priced.ok) {
        priced.errors.forEach(function (message) {
          errors.push("Line " + (index + 1) + ": " + message);
        });
        return;
      }
      const line = priced.line;
      line.lineId = raw.lineId || "line-" + (index + 1);
      lines.push(line);
    });

    if (errors.length) return { ok: false, errors: errors, quote: null };

    const materialCents = lines.reduce(function (s, l) {
      return s + l.materialCents;
    }, 0);
    const installCents = lines.reduce(function (s, l) {
      return s + l.installCents;
    }, 0);
    const totalQty = lines.reduce(function (s, l) {
      return s + l.qty;
    }, 0);
    const addons = priceAddons(pricing, cart.addons, totalQty);
    const totalCents = materialCents + installCents + addons.cents;

    return {
      ok: true,
      errors: [],
      quote: {
        lines: lines,
        materialCents: materialCents,
        installCents: installCents,
        addons: addons.detail,
        addonsCents: addons.cents,
        installMethod: addons.installMethod,
        totalQty: totalQty,
        totalCents: totalCents,
      },
    };
  }

  /** Installed "from" price at the product's reference size, standard options, no add-ons. */
  function fromPriceCents(product, pricing) {
    const priced = priceLine(product, pricing, {
      productId: product.id,
      widthIn: product.reference.widthIn,
      heightIn: product.reference.heightIn,
      qty: 1,
      frameColor: "white",
      grid: "none",
      glass: (product.glass || [])[0] || "dual-low-e",
      measureForMe: false,
    });
    if (!priced.ok) return null;
    return priced.line.lineCents;
  }

  return {
    nearestDollarCents: nearestDollarCents,
    formatUSD: formatUSD,
    parseInches: parseInches,
    priceLine: priceLine,
    priceCart: priceCart,
    fromPriceCents: fromPriceCents,
    installEachCents: installEachCents,
  };
});
