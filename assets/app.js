/* ============================================================
   CROS Benchmark — rendering
   Plain SVG, no dependencies. Every chart reads its colors from
   the CSS custom properties, so a theme change just re-renders.
   ============================================================ */
(function () {
  "use strict";

  var DATA = typeof CROS_DATA !== "undefined" ? CROS_DATA : null;
  if (!DATA) return;

  var MODELS = DATA.models.slice();
  var SVG_NS = "http://www.w3.org/2000/svg";
  var THEME_KEY = "cros-theme";

  /* ---------------- small helpers ---------------- */

  function el(name, attrs, text) {
    var node = document.createElementNS(SVG_NS, name);
    for (var k in attrs) {
      if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
    }
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function tokens(node) {
    var cs = getComputedStyle(node);
    function t(name) { return cs.getPropertyValue(name).trim(); }
    return {
      series: t("--series-1"),
      grid: t("--grid"),
      axis: t("--axis"),
      muted: t("--text-muted"),
      secondary: t("--text-secondary"),
      primary: t("--text-primary"),
      surface: t("--surface"),
    };
  }

  function num(v) {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }

  var measureCanvas = document.createElement("canvas").getContext("2d");
  function textWidth(str, font) {
    measureCanvas.font = font;
    return measureCanvas.measureText(str).width;
  }

  function truncate(str, maxWidth, font) {
    if (textWidth(str, font) <= maxWidth) return str;
    var out = str;
    while (out.length > 1 && textWidth(out + "…", font) > maxWidth) {
      out = out.slice(0, -1);
    }
    return out + "…";
  }

  function niceTicks(max, count) {
    var raw = max / count;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    var ticks = [];
    for (var v = 0; v <= max + 1e-9; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    return ticks;
  }

  /* ---------------- tooltip ---------------- */

  function makeTooltip(card) {
    var tip = document.createElement("div");
    tip.className = "tooltip";
    tip.setAttribute("role", "status");
    var name = document.createElement("div");
    name.className = "tt-name";
    var key = document.createElement("span");
    key.className = "tt-key";
    var nameText = document.createElement("span");
    name.appendChild(key);
    name.appendChild(nameText);
    var value = document.createElement("div");
    value.className = "tt-value";
    var meta = document.createElement("div");
    meta.className = "tt-meta";
    tip.appendChild(name);
    tip.appendChild(value);
    tip.appendChild(meta);
    card.appendChild(tip);

    return {
      show: function (anchor, content) {
        nameText.textContent = content.name;
        value.textContent = content.value;
        meta.textContent = content.meta || "";
        meta.style.display = content.meta ? "" : "none";
        var a = anchor.getBoundingClientRect();
        var c = card.getBoundingClientRect();
        var left = a.left + a.width / 2 - c.left;
        var pad = 8;
        left = Math.max(78, Math.min(c.width - 78, left));
        tip.style.left = left + "px";
        tip.style.top = a.top - c.top - pad + "px";
        tip.setAttribute("data-visible", "true");
      },
      hide: function () { tip.removeAttribute("data-visible"); },
    };
  }

  /* ---------------- horizontal bar chart ---------------- */

  function barChart(mount, opts) {
    var card = mount.closest(".card");
    var tip = mount._tip || (mount._tip = makeTooltip(card));
    var c = tokens(mount);
    var width = Math.max(280, mount.clientWidth || 640);

    var labelFont = "13px " + getComputedStyle(document.body).fontFamily;
    var rowH = opts.rowH || 38, barH = 18, topPad = 6, axisBand = 38;
    var items = opts.items;

    var longest = 0;
    items.forEach(function (it) { longest = Math.max(longest, textWidth(it.label, labelFont)); });
    var labelW = Math.min(Math.max(longest + 20, 92), Math.round(width * 0.46));
    var valueW = 44;
    var plotW = Math.max(60, width - labelW - valueW);
    var height = topPad + items.length * rowH + axisBand;

    var max = opts.max;
    var ticks = opts.ticks || niceTicks(max, 4);
    var scale = function (v) { return (v / max) * plotW; };

    mount.textContent = "";
    var svg = el("svg", {
      width: width, height: height, viewBox: "0 0 " + width + " " + height,
      role: "group", "aria-label": opts.ariaLabel,
    });

    var plotBottom = topPad + items.length * rowH;

    /* gridlines + ticks */
    ticks.forEach(function (t) {
      var x = labelW + scale(t);
      svg.appendChild(el("line", {
        x1: x, x2: x, y1: topPad, y2: plotBottom,
        stroke: t === 0 ? c.axis : c.grid, "stroke-width": 1, "shape-rendering": "crispEdges",
      }));
      svg.appendChild(el("text", {
        x: x, y: plotBottom + 17, "text-anchor": "middle",
        "font-size": 11, fill: c.muted, "font-variant-numeric": "tabular-nums",
      }, num(t)));
    });

    if (opts.axisLabel) {
      svg.appendChild(el("text", {
        x: labelW, y: height - 4, "text-anchor": "start", "font-size": 11, fill: c.muted,
      }, opts.axisLabel));
    }

    /* bars */
    items.forEach(function (it, i) {
      var y = topPad + i * rowH + (rowH - barH) / 2;
      var w = Math.max(2, scale(it.value));
      var r = Math.min(4, w);
      var g = el("g", { tabindex: "0", role: "img",
        "aria-label": it.label + ": " + num(it.value) + " " + opts.unit });

      var bar = el("path", {
        d: "M" + labelW + "," + y +
           " H" + (labelW + w - r) +
           " A" + r + "," + r + " 0 0 1 " + (labelW + w) + "," + (y + r) +
           " V" + (y + barH - r) +
           " A" + r + "," + r + " 0 0 1 " + (labelW + w - r) + "," + (y + barH) +
           " H" + labelW + " Z",
        fill: c.series,
      });

      g.appendChild(el("text", {
        x: labelW - 12, y: y + barH / 2 + 4.5, "text-anchor": "end",
        "font-size": 13, fill: c.primary,
      }, truncate(it.label, labelW - 14, labelFont)));

      g.appendChild(bar);

      g.appendChild(el("text", {
        x: labelW + w + 8, y: y + barH / 2 + 4.5, "text-anchor": "start",
        "font-size": 12.5, fill: c.secondary, "font-weight": 500,
      }, num(it.value)));

      var anchor = el("rect", {
        x: labelW + w - 1, y: y, width: 2, height: barH, fill: "transparent",
      });
      g.appendChild(anchor);

      var hit = el("rect", {
        x: 0, y: topPad + i * rowH, width: width, height: rowH, fill: "transparent",
      });
      g.appendChild(hit);

      function show() {
        tip.show(anchor, { name: it.label, value: num(it.value) + opts.valueSuffix, meta: it.meta });
      }
      g.addEventListener("pointerenter", show);
      g.addEventListener("focus", show);
      g.addEventListener("pointerleave", tip.hide);
      g.addEventListener("blur", tip.hide);

      svg.appendChild(g);
    });

    mount.appendChild(svg);
  }

  /* ---------------- scatter ---------------- */

  function scatter(mount, opts) {
    var card = mount.closest(".card");
    var tip = mount._tip || (mount._tip = makeTooltip(card));
    var c = tokens(mount);
    var width = Math.max(280, mount.clientWidth || 520);
    var narrow = width < 460;
    var height = Math.max(narrow ? 300 : 260, Math.min(360, Math.round(width * 0.72)));

    var m = { top: 14, right: 18, bottom: 46, left: 44 };
    var plotW = width - m.left - m.right;
    var plotH = height - m.top - m.bottom;

    var isLog = opts.xScale === "log";
    var xd = opts.xDomain;
    var lo = isLog ? Math.log10(xd[0]) : xd[0];
    var hi = isLog ? Math.log10(xd[1]) : xd[1];
    function sx(v) {
      var t = ((isLog ? Math.log10(v) : v) - lo) / (hi - lo);
      return m.left + t * plotW;
    }
    var yd = opts.yDomain;
    function sy(v) { return m.top + (1 - (v - yd[0]) / (yd[1] - yd[0])) * plotH; }

    mount.textContent = "";
    var svg = el("svg", {
      width: width, height: height, viewBox: "0 0 " + width + " " + height,
      role: "group", "aria-label": opts.ariaLabel,
    });

    /* grid */
    opts.yTicks.forEach(function (t) {
      var y = sy(t);
      svg.appendChild(el("line", {
        x1: m.left, x2: m.left + plotW, y1: y, y2: y,
        stroke: c.grid, "stroke-width": 1, "shape-rendering": "crispEdges",
      }));
      svg.appendChild(el("text", {
        x: m.left - 9, y: y + 4, "text-anchor": "end", "font-size": 11, fill: c.muted,
        "font-variant-numeric": "tabular-nums",
      }, num(t)));
    });
    opts.xTicks.forEach(function (t) {
      var x = sx(t);
      svg.appendChild(el("line", {
        x1: x, x2: x, y1: m.top, y2: m.top + plotH,
        stroke: c.grid, "stroke-width": 1, "shape-rendering": "crispEdges",
      }));
      svg.appendChild(el("text", {
        x: x, y: m.top + plotH + 18, "text-anchor": "middle", "font-size": 11, fill: c.muted,
        "font-variant-numeric": "tabular-nums",
      }, num(t)));
    });

    /* axis rules */
    svg.appendChild(el("line", {
      x1: m.left, x2: m.left + plotW, y1: m.top + plotH, y2: m.top + plotH,
      stroke: c.axis, "stroke-width": 1, "shape-rendering": "crispEdges",
    }));
    svg.appendChild(el("line", {
      x1: m.left, x2: m.left, y1: m.top, y2: m.top + plotH,
      stroke: c.axis, "stroke-width": 1, "shape-rendering": "crispEdges",
    }));

    /* axis titles */
    svg.appendChild(el("text", {
      x: m.left + plotW / 2, y: height - 6, "text-anchor": "middle",
      "font-size": 11.5, fill: c.muted,
    }, opts.xLabel));
    var yTitle = el("text", {
      x: 0, y: 0, "text-anchor": "middle", "font-size": 11.5, fill: c.muted,
      transform: "translate(11," + (m.top + plotH / 2) + ") rotate(-90)",
    }, opts.yLabel);
    svg.appendChild(yTitle);

    /* labels: try right, left, above, below; keep inside the plot, avoid overlaps */
    var labelSize = narrow ? 11 : 11.5;
    var labelFont = labelSize + "px " + getComputedStyle(document.body).fontFamily;
    var placed = [];
    function overlaps(a, b) {
      return !(a.x2 < b.x1 - 3 || a.x1 > b.x2 + 3 || a.y2 < b.y1 - 2 || a.y1 > b.y2 + 2);
    }

    var pts = opts.points.slice().sort(function (a, b) { return b.y - a.y; });

    pts.forEach(function (p) {
      var px = sx(p.x), py = sy(p.y);
      var w = textWidth(p.label, labelFont);
      var right = { anchor: "start", x: px + 11, y: py + 4 };
      var left = { anchor: "end", x: px - 11, y: py + 4 };
      var candidates = px > m.left + plotW * 0.68
        ? [left, right, { anchor: "middle", x: px, y: py - 12 }, { anchor: "middle", x: px, y: py + 19 }]
        : [right, left, { anchor: "middle", x: px, y: py - 12 }, { anchor: "middle", x: px, y: py + 19 }];
      var chosen = null;
      for (var i = 0; i < candidates.length; i++) {
        var cand = candidates[i];
        var x1 = cand.anchor === "start" ? cand.x : cand.anchor === "end" ? cand.x - w : cand.x - w / 2;
        var box = { x1: x1, x2: x1 + w, y1: cand.y - 10, y2: cand.y + 3 };
        if (box.x1 < 2 || box.x2 > width - 2 || box.y1 < 0 || box.y2 > m.top + plotH + 4) continue;
        var clash = placed.some(function (b) { return overlaps(box, b); });
        if (!clash) { chosen = cand; placed.push(box); break; }
      }
      if (!chosen) {
        chosen = candidates[0];
        var fx = chosen.x, fbox = { x1: fx, x2: fx + w, y1: chosen.y - 10, y2: chosen.y + 3 };
        while (placed.some(function (b) { return overlaps(fbox, b); }) && fbox.y2 < m.top + plotH) {
          chosen.y += 13; fbox.y1 += 13; fbox.y2 += 13;
        }
        placed.push(fbox);
      }
      p._label = chosen;
      p._px = px;
      p._py = py;
    });

    /* leader line when a label had to move off its default spot */
    pts.forEach(function (p) {
      var L = p._label;
      var far = Math.abs(L.y - (p._py + 4)) > 6;
      if (far) {
        svg.appendChild(el("line", {
          x1: p._px, y1: p._py, x2: L.anchor === "end" ? L.x + 3 : L.x - 3, y2: L.y - 3,
          stroke: c.axis, "stroke-width": 1,
        }));
      }
    });

    /* dots */
    pts.forEach(function (p) {
      var g = el("g", { tabindex: "0", role: "img", "aria-label": p.aria });
      var dot = el("circle", {
        cx: p._px, cy: p._py, r: 5, fill: c.series, stroke: c.surface, "stroke-width": 2,
      });
      g.appendChild(el("text", {
        x: p._label.x, y: p._label.y, "text-anchor": p._label.anchor,
        "font-size": labelSize, fill: c.secondary,
        stroke: c.surface, "stroke-width": 3.5, "stroke-linejoin": "round", "paint-order": "stroke",
      }, p.label));
      g.appendChild(dot);
      g.appendChild(el("circle", { cx: p._px, cy: p._py, r: 14, fill: "transparent" }));

      function show() { tip.show(dot, { name: p.label, value: p.tipValue, meta: p.tipMeta }); }
      g.addEventListener("pointerenter", show);
      g.addEventListener("focus", show);
      g.addEventListener("pointerleave", tip.hide);
      g.addEventListener("blur", tip.hide);
      svg.appendChild(g);
    });

    mount.appendChild(svg);
  }

  /* ---------------- page content ---------------- */

  function byScore(a, b) { return b.score - a.score; }
  function maxOf(key) { return Math.max.apply(null, MODELS.map(function (m) { return m[key]; })); }
  function minBy(key) {
    return MODELS.reduce(function (a, b) { return b[key] < a[key] ? b : a; });
  }
  function maxBy(key) {
    return MODELS.reduce(function (a, b) { return b[key] > a[key] ? b : a; });
  }

  function effortLabel(m) { return m.effort + " effort"; }

  function renderStats() {
    var best = maxBy("score"), fastest = minBy("time"), cheapest = minBy("cost");
    var stats = [
      { label: "Models evaluated", value: String(MODELS.length), sub: DATA.meta.tasks + " task in the suite so far" },
      { label: "Top CROS score", value: num(best.score), sub: best.name + " · " + effortLabel(best) },
      { label: "Fastest run", value: num(fastest.time), sub: fastest.name + " · time index" },
      { label: "Lowest cost", value: num(cheapest.cost), sub: cheapest.name + " · cost index" },
    ];
    var host = document.getElementById("kpis");
    host.textContent = "";
    stats.forEach(function (s) {
      var d = document.createElement("div");
      d.className = "stat";
      var l = document.createElement("div"); l.className = "label"; l.textContent = s.label;
      var v = document.createElement("div"); v.className = "value"; v.textContent = s.value;
      var b = document.createElement("div"); b.className = "sub"; b.textContent = s.sub;
      d.appendChild(l); d.appendChild(v); d.appendChild(b);
      host.appendChild(d);
    });
  }

  function renderHighlights() {
    var host = document.getElementById("highlights");
    if (!host) return;

    var ranked = MODELS.slice().sort(byScore);
    var best = ranked[0], second = ranked[1];
    var cheapest = minBy("cost"), priciest = maxBy("cost");
    var fastest = minBy("time"), slowest = maxBy("time");

    function times(a, b) {
      var r = a / b;
      return (r >= 10 ? Math.round(r) : Math.round(r * 10) / 10) + "×";
    }

    var rows = [
      {
        term: "Top score",
        parts: [
          [best.name, true], [" leads at ", false], [num(best.score), true],
          second ? ", " + num(Math.round((best.score - second.score) * 10) / 10) +
            " ahead of " + second.name + "." : ".",
        ],
      },
      {
        term: "Cheapest run",
        parts: [
          [cheapest.name, true], [" costs the least — index ", false], [num(cheapest.cost), true],
          [" against " + num(priciest.cost) + " for " + priciest.name + " — and still scores " +
            num(cheapest.score) + ".", false],
        ],
      },
      {
        term: "Fastest run",
        parts: [
          [fastest.name, true], [" finishes soonest — time index ", false], [num(fastest.time), true],
          [" against " + num(slowest.time) + " for " + slowest.name +
            ", scoring " + num(fastest.score) + ".", false],
        ],
      },
      {
        term: "The spread",
        parts: [
          [num(Math.round((best.score - ranked[ranked.length - 1].score) * 10) / 10) + " points", true],
          [" separate first from last on quality, while cost spans " +
            times(priciest.cost, cheapest.cost) + " and time " +
            times(slowest.time, fastest.time) + ".", false],
        ],
      },
    ];

    host.textContent = "";
    rows.forEach(function (row) {
      var wrap = document.createElement("div");
      var dt = document.createElement("dt");
      dt.textContent = row.term;
      var dd = document.createElement("dd");
      row.parts.forEach(function (part) {
        if (typeof part === "string") { dd.appendChild(document.createTextNode(part)); return; }
        if (part[1]) {
          var strong = document.createElement("strong");
          strong.textContent = part[0];
          dd.appendChild(strong);
        } else {
          dd.appendChild(document.createTextNode(part[0]));
        }
      });
      wrap.appendChild(dt);
      wrap.appendChild(dd);
      host.appendChild(wrap);
    });
  }

  /* ---------------- leaderboard table ---------------- */

  var sortState = { key: "score", dir: "desc" };

  function renderTable() {
    var tbody = document.getElementById("leaderboard-body");
    var rankOf = {};
    MODELS.slice().sort(byScore).forEach(function (m, i) { rankOf[m.id] = i + 1; });

    var maxScore = 100, maxTime = maxOf("time"), maxCost = maxOf("cost");
    var rows = MODELS.slice().sort(function (a, b) {
      var d = a[sortState.key] < b[sortState.key] ? -1 : a[sortState.key] > b[sortState.key] ? 1 : 0;
      if (sortState.key === "name") d = a.name.localeCompare(b.name);
      return sortState.dir === "desc" ? -d : d;
    });

    tbody.textContent = "";
    rows.forEach(function (m) {
      var tr = document.createElement("tr");

      var rank = document.createElement("td");
      rank.className = "rank";
      rank.textContent = rankOf[m.id];
      tr.appendChild(rank);

      var name = document.createElement("td");
      name.className = "model";
      name.textContent = m.name;
      tr.appendChild(name);

      var eff = document.createElement("td");
      eff.className = "effort";
      var badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = m.effort;
      eff.appendChild(badge);
      tr.appendChild(eff);

      [["score", maxScore], ["time", maxTime], ["cost", maxCost]].forEach(function (pair) {
        var td = document.createElement("td");
        td.className = "metric";
        var cell = document.createElement("div");
        cell.className = "metric-cell";
        var bar = document.createElement("div");
        bar.className = "metric-bar";
        var fill = document.createElement("span");
        fill.style.width = Math.max(2, (m[pair[0]] / pair[1]) * 100) + "%";
        bar.appendChild(fill);
        var val = document.createElement("span");
        val.className = "metric-value";
        val.textContent = num(m[pair[0]]);
        cell.appendChild(bar);
        cell.appendChild(val);
        td.appendChild(cell);
        tr.appendChild(td);
      });

      tbody.appendChild(tr);
    });

    document.querySelectorAll("th[data-key]").forEach(function (th) {
      var active = th.getAttribute("data-key") === sortState.key;
      if (active) th.setAttribute("aria-sort", sortState.dir === "desc" ? "descending" : "ascending");
      else th.removeAttribute("aria-sort");
      var arrow = th.querySelector(".arrow");
      if (arrow) arrow.textContent = active ? (sortState.dir === "desc" ? "↓" : "↑") : "↓";
    });
  }

  function wireTable() {
    document.querySelectorAll("th[data-key] .sort-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.parentElement.getAttribute("data-key");
        if (sortState.key === key) {
          sortState.dir = sortState.dir === "desc" ? "asc" : "desc";
        } else {
          sortState.key = key;
          sortState.dir = key === "name" ? "asc" : key === "score" ? "desc" : "asc";
        }
        renderTable();
      });
    });
  }

  /* ---------------- charts ---------------- */

  function drawCharts() {
    var scoreItems = MODELS.slice().sort(byScore).map(function (m) {
      return { label: m.name, value: m.score, meta: effortLabel(m) };
    });
    barChart(document.getElementById("chart-score"), {
      items: scoreItems, max: 100, ticks: [0, 25, 50, 75, 100], rowH: 48,
      unit: "out of 100", valueSuffix: " / 100",
      ariaLabel: "CROS score by model, higher is better, out of 100",
      axisLabel: "CROS score (0–100)",
    });

    var timeItems = MODELS.slice().sort(function (a, b) { return a.time - b.time; }).map(function (m) {
      return { label: m.name, value: m.time, meta: effortLabel(m) };
    });
    barChart(document.getElementById("chart-time"), {
      items: timeItems, max: 100, ticks: [0, 25, 50, 75, 100],
      unit: "time index", valueSuffix: " time index",
      ariaLabel: "Normalized time spent by model, lower is better",
      axisLabel: "Time index (lower is better)",
    });

    var costMax = Math.ceil(maxOf("cost") / 25) * 25;
    var costItems = MODELS.slice().sort(function (a, b) { return a.cost - b.cost; }).map(function (m) {
      return { label: m.name, value: m.cost, meta: effortLabel(m) };
    });
    barChart(document.getElementById("chart-cost"), {
      items: costItems, max: costMax,
      ticks: [0, 0.25, 0.5, 0.75, 1].map(function (f) { return costMax * f; }),
      unit: "cost index", valueSuffix: " cost index",
      ariaLabel: "Normalized cost by model, lower is better",
      axisLabel: "Cost index (lower is better)",
    });

    var yTicks = [84, 88, 92, 96, 100];
    scatter(document.getElementById("chart-cost-quality"), {
      points: MODELS.map(function (m) {
        return {
          label: m.name, x: m.cost, y: m.score,
          tipValue: num(m.score) + " / 100",
          tipMeta: "Cost index " + num(m.cost) + " · " + effortLabel(m),
          aria: m.name + ": score " + num(m.score) + ", cost index " + num(m.cost),
        };
      }),
      xScale: "log", xDomain: [0.7, 150], xTicks: [1, 3, 10, 30, 100],
      yDomain: [84, 100], yTicks: yTicks,
      xLabel: "Cost index — log scale (lower is better) →",
      yLabel: "CROS score →",
      ariaLabel: "CROS score versus normalized cost for each model",
    });

    scatter(document.getElementById("chart-time-quality"), {
      points: MODELS.map(function (m) {
        return {
          label: m.name, x: m.time, y: m.score,
          tipValue: num(m.score) + " / 100",
          tipMeta: "Time index " + num(m.time) + " · " + effortLabel(m),
          aria: m.name + ": score " + num(m.score) + ", time index " + num(m.time),
        };
      }),
      xScale: "linear", xDomain: [0, 110], xTicks: [0, 25, 50, 75, 100],
      yDomain: [84, 100], yTicks: yTicks,
      xLabel: "Time index (lower is better) →",
      yLabel: "CROS score →",
      ariaLabel: "CROS score versus normalized time spent for each model",
    });
  }

  /* ---------------- theme ---------------- */

  function wireTheme() {
    var btn = document.getElementById("theme-toggle");
    if (!btn) return;

    function current() {
      var stamped = document.documentElement.getAttribute("data-theme");
      if (stamped) return stamped;
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    function sync() {
      var isDark = current() === "dark";
      btn.setAttribute("aria-label", isDark ? "Switch to light theme" : "Switch to dark theme");
      btn.setAttribute("aria-pressed", String(isDark));
      var sun = /** @type {HTMLElement} */ (btn.querySelector(".icon-sun"));
      var moon = /** @type {HTMLElement} */ (btn.querySelector(".icon-moon"));
      if (sun) sun.style.display = isDark ? "none" : "";
      if (moon) moon.style.display = isDark ? "" : "none";
    }
    btn.addEventListener("click", function () {
      var next = current() === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage may be blocked */ }
      sync();
      drawCharts();
    });
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (!document.documentElement.getAttribute("data-theme")) { sync(); drawCharts(); }
    });
    sync();
  }

  /* ---------------- boot ---------------- */

  function setText(id, text) {
    var node = document.getElementById(id);
    if (node) node.textContent = text;
  }

  function boot() {
    setText("meta-updated", DATA.meta.updated);
    setText("meta-status", DATA.meta.status);
    setText("meta-tasks", DATA.meta.tasks + (DATA.meta.tasks === 1 ? " task" : " tasks"));
    setText("meta-models", MODELS.length + " models");
    setText("footer-updated", DATA.meta.updated);

    renderStats();
    renderHighlights();
    wireTable();
    renderTable();
    drawCharts();
    wireTheme();

    var frame;
    var lastWidth = window.innerWidth;
    window.addEventListener("resize", function () {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      clearTimeout(frame);
      frame = setTimeout(drawCharts, 120);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
