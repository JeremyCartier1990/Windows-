/**
 * Illustrated window previews. Colors, grids, and types are allow-listed.
 * Used on catalog cards and in the estimator so the homeowner sees the design.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SCWPreview = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var FRAMES = {
    white: { outer: "#f4f0ea", sash: "#fffcf8", line: "#d9d0c4", hardware: "#b7aa9c", glassStroke: "rgba(255,255,255,.65)" },
    almond: { outer: "#ead4b0", sash: "#f6e7cf", line: "#c9ae86", hardware: "#a78458", glassStroke: "rgba(255,255,255,.5)" },
    driftwood: { outer: "#b59a82", sash: "#cbb8a2", line: "#8d7360", hardware: "#6f5644", glassStroke: "rgba(255,255,255,.4)" },
    bronze: { outer: "#6e5140", sash: "#7d5e4b", line: "#3f2c22", hardware: "#f0e2d4", glassStroke: "rgba(255,255,255,.35)" },
    black: { outer: "#26292e", sash: "#34383f", line: "#101215", hardware: "#f3f1ee", glassStroke: "rgba(255,255,255,.3)" },
  };

  function frameOf(color) {
    return FRAMES[color] || FRAMES.white;
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[^a-z0-9_-]/gi, "");
  }

  function xml(value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function defs(id) {
    return (
      '<defs>' +
      '<linearGradient id="' + id + '-g" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="#d5eaf6"/>' +
      '<stop offset=".48" stop-color="#f8ead8"/>' +
      '<stop offset="1" stop-color="#f3b48a"/>' +
      "</linearGradient>" +
      '<linearGradient id="' + id + '-s" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#fff" stop-opacity=".55"/>' +
      '<stop offset=".45" stop-color="#fff" stop-opacity="0"/>' +
      "</linearGradient>" +
      "</defs>"
    );
  }

  function glass(id, x, y, w, h, rx) {
    return (
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx || 1) + '" fill="url(#' + id + '-g)"/>' +
      '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" rx="' + (rx || 1) + '" fill="url(#' + id + '-s)"/>'
    );
  }

  function gridLines(x, y, w, h, kind, stroke) {
    if (!kind || kind === "none" || w < 8 || h < 8) return "";
    var d = "";
    if (kind === "prairie") {
      var m = Math.min(w, h) * 0.16;
      return '<rect x="' + (x + m) + '" y="' + (y + m) + '" width="' + (w - m * 2) + '" height="' + (h - m * 2) + '" fill="none" stroke="' + stroke + '" stroke-width="1.3"/>';
    }
    var cols = w >= h ? 3 : 2;
    var rows = h > w * 0.85 ? 3 : 2;
    var i;
    for (i = 1; i < cols; i++) {
      var gx = x + (w * i) / cols;
      d += '<line x1="' + gx + '" y1="' + y + '" x2="' + gx + '" y2="' + (y + h) + '" stroke="' + stroke + '" stroke-width="1.25"/>';
    }
    for (i = 1; i < rows; i++) {
      var gy = y + (h * i) / rows;
      d += '<line x1="' + x + '" y1="' + gy + '" x2="' + (x + w) + '" y2="' + gy + '" stroke="' + stroke + '" stroke-width="1.25"/>';
    }
    return d;
  }

  function pane(id, x, y, w, h, grid, stroke) {
    return glass(id, x, y, w, h) + gridLines(x, y, w, h, grid, stroke);
  }

  function hardware(cx, cy, color, vertical) {
    if (vertical) {
      return '<rect x="' + (cx - 1.3) + '" y="' + (cy - 7) + '" width="2.6" height="14" rx="1.2" fill="' + color + '"/>';
    }
    return '<rect x="' + (cx - 7) + '" y="' + (cy - 1.3) + '" width="14" height="2.6" rx="1.2" fill="' + color + '"/>';
  }

  function renderWindow(opts) {
    opts = opts || {};
    var type = opts.type || "picture";
    var shape = opts.shape || "";
    var grid = opts.grid || "none";
    var f = frameOf(opts.frameColor);
    var id = "w" + esc(opts.uid || "0");
    var vb = "0 0 200 248";
    var body = "";

    if (type === "patio") {
      vb = "0 0 280 220";
      var panels = opts.panels === 3 ? 3 : 2;
      var gap = 8;
      var outerW = 280 - 16;
      var pw = (outerW - gap * (panels - 1)) / panels;
      body = '<rect x="4" y="8" width="272" height="204" rx="4" fill="' + f.outer + '"/>';
      for (var p = 0; p < panels; p++) {
        var x = 10 + p * (pw + gap);
        body += pane(id, x, 16, pw - 6, 180, grid, f.line);
        if (p === panels - 1) body += hardware(x + pw - 16, 106, f.hardware, true);
      }
    } else if (type === "bay-bow") {
      vb = "0 0 280 230";
      body =
        '<path d="M28 28 L70 14 H210 L252 28 V200 H28 Z" fill="' + f.outer + '"/>' +
        pane(id, 40, 36, 52, 150, grid, f.line) +
        pane(id, 100, 24, 80, 162, grid, f.line) +
        pane(id, 188, 36, 52, 150, grid, f.line);
    } else if (type === "garden") {
      vb = "0 0 220 200";
      body =
        '<path d="M30 30 H190 L206 78 V168 H14 V78 Z" fill="' + f.outer + '"/>' +
        pane(id, 40, 40, 140, 70, grid, f.line) +
        pane(id, 22, 86, 28, 70, "none", f.line) +
        pane(id, 170, 86, 28, 70, "none", f.line) +
        '<rect x="36" y="116" width="148" height="8" rx="2" fill="' + f.sash + '"/>';
    } else if (shape === "half-round" || type === "half-round") {
      vb = "0 0 220 140";
      body =
        '<path d="M20 120 A90 90 0 0 1 200 120 Z" fill="' + f.outer + '"/>' +
        '<path d="M34 118 A76 76 0 0 1 186 118 Z" fill="url(#' + id + '-g)"/>' +
        '<path d="M34 118 A76 76 0 0 1 186 118 Z" fill="url(#' + id + '-s)"/>' +
        (grid === "none"
          ? ""
          : '<path d="M110 42 V118 M62 70 Q110 48 158 70" fill="none" stroke="' + f.line + '" stroke-width="1.3"/>');
    } else if (shape === "arch") {
      vb = "0 0 180 220";
      body =
        '<path d="M18 70 A72 72 0 0 1 162 70 V200 H18 Z" fill="' + f.outer + '"/>' +
        '<path d="M32 78 A58 56 0 0 1 148 78 V186 H32 Z" fill="url(#' + id + '-g)"/>' +
        '<path d="M32 78 A58 56 0 0 1 148 78 V186 H32 Z" fill="url(#' + id + '-s)"/>' +
        gridLines(32, 90, 116, 96, grid, f.line);
    } else if (type === "circle") {
      vb = "0 0 200 200";
      body =
        '<circle cx="100" cy="100" r="86" fill="' + f.outer + '"/>' +
        '<circle cx="100" cy="100" r="70" fill="url(#' + id + '-g)"/>' +
        '<circle cx="100" cy="100" r="70" fill="url(#' + id + '-s)"/>';
    } else {
      var x = 28;
      var y = 18;
      var w = 144;
      var h = 208;
      body = '<rect x="' + (x - 8) + '" y="' + (y - 8) + '" width="' + (w + 16) + '" height="' + (h + 16) + '" rx="4" fill="' + f.outer + '"/>';
      if (type === "single-hung") {
        body += pane(id, x, y, w, 78, grid, f.line);
        body += '<rect x="' + (x - 4) + '" y="' + (y + 74) + '" width="' + (w + 8) + '" height="10" rx="1" fill="' + f.sash + '"/>';
        body += pane(id, x, y + 86, w, 112, grid, f.line);
        body += hardware(x + w / 2, y + 86, f.hardware, false);
      } else if (type === "double-hung") {
        body += pane(id, x, y, w, 96, grid, f.line);
        body += '<rect x="' + (x - 4) + '" y="' + (y + 92) + '" width="' + (w + 8) + '" height="10" rx="1" fill="' + f.sash + '"/>';
        body += pane(id, x, y + 104, w, 96, grid, f.line);
        body += hardware(x + w / 2, y + 104, f.hardware, false);
      } else if (type === "slider") {
        var half = (w - 8) / 2;
        body += pane(id, x, y, half, h, grid, f.line);
        body += pane(id, x + half + 8, y, half, h, grid, f.line);
        body += hardware(x + half + 4, y + h / 2, f.hardware, true);
      } else if (type === "casement") {
        body += pane(id, x, y, w, h, grid, f.line);
        body += hardware(x + w - 14, y + h / 2, f.hardware, true);
        body += '<path d="M' + (x + 8) + " " + (y + 10) + " V" + (y + h - 10) + '" stroke="' + f.line + '" stroke-width="2" fill="none"/>';
      } else if (type === "awning") {
        body += pane(id, x, y, w, h, grid, f.line);
        body += '<path d="M' + (x + 8) + " " + (y + 12) + " H" + (x + w - 8) + '" stroke="' + f.line + '" stroke-width="2"/>';
        body += hardware(x + w / 2, y + h - 16, f.hardware, false);
      } else {
        body += pane(id, x, y, w, h, grid, f.line);
      }
    }

    return (
      '<svg viewBox="' + vb + '" role="img" aria-label="' + xml(opts.label || "Window preview") + '">' +
      defs(id) +
      body +
      "</svg>"
    );
  }

  function mount(el, opts) {
    if (!el) return;
    el.innerHTML = renderWindow(opts);
  }

  function mountAll(rootNode) {
    var scope = rootNode || (typeof document !== "undefined" ? document : null);
    if (!scope) return;
    var nodes = scope.querySelectorAll("[data-preview]");
    Array.prototype.forEach.call(nodes, function (node) {
      mount(node, {
        uid: node.getAttribute("data-uid") || node.getAttribute("data-product") || "card",
        type: node.getAttribute("data-type"),
        shape: node.getAttribute("data-shape"),
        frameColor: node.getAttribute("data-color") || "white",
        grid: node.getAttribute("data-grid") || "none",
        panels: Number(node.getAttribute("data-panels") || 2),
        label: node.getAttribute("data-label") || "Window",
      });
    });
  }

  return { renderWindow: renderWindow, mount: mount, mountAll: mountAll, FRAMES: FRAMES };
});
