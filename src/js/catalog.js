(function () {
  "use strict";
  var grid = document.getElementById("catalog-grid");
  if (!grid) return;

  var empty = document.getElementById("catalog-empty");
  var buttons = document.querySelectorAll("[data-filter]");
  var state = { type: "all", tier: "all", design: "all", material: "all" };

  var params = new URLSearchParams(window.location.search);
  ["type", "tier", "design", "material"].forEach(function (key) {
    var value = params.get(key);
    if (value) state[key] = value;
  });

  function apply() {
    var shown = 0;
    grid.querySelectorAll(".pcard").forEach(function (card) {
      var ok = true;
      ["type", "tier", "design", "material"].forEach(function (key) {
        if (state[key] !== "all" && card.getAttribute("data-" + key) !== state[key]) ok = false;
      });
      card.hidden = !ok;
      if (ok) shown += 1;
    });
    if (empty) empty.hidden = shown !== 0;
    buttons.forEach(function (button) {
      var key = button.getAttribute("data-filter");
      var on = state[key] === button.getAttribute("data-value");
      button.classList.toggle("is-on", on);
      button.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  buttons.forEach(function (button) {
    button.addEventListener("click", function () {
      state[button.getAttribute("data-filter")] = button.getAttribute("data-value");
      apply();
    });
  });

  apply();
  if (window.SCWPreview) window.SCWPreview.mountAll(grid);
})();
