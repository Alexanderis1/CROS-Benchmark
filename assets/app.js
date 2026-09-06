/* ============================================================
   CROS Benchmark — rendering
   Plain SVG, no dependencies. Every chart reads its colors from
   the CSS custom properties, so a theme change just re-renders.

   Two tracks come out of assets/data.js:
     EXEC  execution runs — score, time, cost
     PLAN  planning runs  — six graded metrics, normalized here
   ============================================================ */
(function () {
  "use strict";

  var DATA = typeof CROS_DATA !== "undefined" ? CROS_DATA : null;
  if (!DATA) return;

  var EXEC = DATA.execution.models.slice();
  var METRICS = DATA.planning.metrics.slice();

  /* A planning row keeps its raw points and gains, per metric, a value
     normalized to 0–100, plus the total score (the raw points added up). */
  var PLAN = DATA.planning.models.map(function (m) {
    var scores = {}, total = 0;
    METRICS.forEach(function (met) {
      var pts = m.points[met.key] || 0;
      total += pts;
      scores[met.key] = Math.round((pts / met.weight) * 100);
    });
    return { id: m.id, name: m.name, effort: m.effort, points: m.points, scores: scores, score: total };
  });

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

  function html(name, className, text) {
    var node = document.createElement(name);
    if (className) node.className = className;
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

  /* A 0–100 axis window that holds every value with half a step of air,
     snapped to the step, so the ticks land on round numbers. */
  function niceDomain(values, step) {
    var min = Math.min.apply(null, values), max = Math.max.apply(null, values);
    var lo = Math.max(0, Math.floor((min - step / 2) / step) * step);
    var hi = Math.min(100, Math.ceil((max + step / 2) / step) * step);
    if (hi <= lo) hi = lo + step;
    var ticks = [];
    for (var v = lo; v <= hi + 1e-9; v += step) ticks.push(v);
    return { domain: [lo, hi], ticks: ticks };
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

  /* ---------------- data access ---------------- */

  /* One accessor for both tracks: a planning row answers a metric key
     from its normalized scores, anything else comes off the row itself. */
  function val(m, key) {
    return m.scores && Object.prototype.hasOwnProperty.call(m.scores, key) ? m.scores[key] : m[key];
  }
  function desc(key) { return function (a, b) { return val(b, key) - val(a, key); }; }
  function asc(key) { return function (a, b) { return val(a, key) - val(b, key); }; }
  function maxOf(list, key) { return Math.max.apply(null, list.map(function (m) { return val(m, key); })); }
  function minBy(list, key) {
    return list.reduce(function (a, b) { return val(b, key) < val(a, key) ? b : a; });
  }
  function maxBy(list, key) {
    return list.reduce(function (a, b) { return val(b, key) > val(a, key) ? b : a; });
  }
  function metricByKey(key) {
    return METRICS.filter(function (met) { return met.key === key; })[0] || null;
  }
  function effortLabel(m) { return m.effort + " effort"; }
  function pointsLabel(m, met) { return m.points[met.key] + " of " + met.weight + " points"; }

  function modelCount() {
    var ids = {};
    EXEC.forEach(function (m) { ids[m.id] = true; });
    PLAN.forEach(function (m) { ids[m.id] = true; });
    return Object.keys(ids).length;
  }

  /* ---------------- page content ---------------- */

  function renderStats() {
    var sameSet = EXEC.length === PLAN.length && PLAN.every(function (p) {
      return EXEC.some(function (e) { return e.id === p.id; });
    });
    var tasks = DATA.execution.tasks + DATA.planning.tasks;

    var stats = [
      { label: "Models evaluated", value: String(modelCount()),
        sub: sameSet ? "the same models on both tracks" : EXEC.length + " execution · " + PLAN.length + " planning" },
      { label: "Tasks in the suite", value: String(tasks),
        sub: DATA.execution.tasks + " execution · " + DATA.planning.tasks + " planning" },
    ];
    if (EXEC.length) {
      var bestExec = maxBy(EXEC, "score");
      stats.push({ label: "Top execution score", value: num(bestExec.score), sub: bestExec.name + " · " + effortLabel(bestExec) });
    }
    if (PLAN.length) {
      var bestPlan = maxBy(PLAN, "score");
      stats.push({ label: "Top planning score", value: num(bestPlan.score), sub: bestPlan.name + " · " + effortLabel(bestPlan) });
    }
    if (EXEC.length) {
      var fastest = minBy(EXEC, "time"), cheapest = minBy(EXEC, "cost");
      stats.push({ label: "Fastest run", value: num(fastest.time), sub: fastest.name + " · time index" });
      stats.push({ label: "Lowest cost", value: num(cheapest.cost), sub: cheapest.name + " · cost index" });
    }

    var host = document.getElementById("kpis");
    host.textContent = "";
    stats.forEach(function (s) {
      var d = html("div", "stat");
      d.appendChild(html("div", "label", s.label));
      d.appendChild(html("div", "value", s.value));
      d.appendChild(html("div", "sub", s.sub));
      host.appendChild(d);
    });
  }

  /* rows: [{ term, parts }], a part is [text, bold] or a plain string */
  function renderDefinitions(hostId, rows) {
    var host = document.getElementById(hostId);
    if (!host) return;
    host.textContent = "";
    rows.forEach(function (row) {
      var wrap = document.createElement("div");
      var dd = document.createElement("dd");
      row.parts.forEach(function (part) {
        if (typeof part === "string") { dd.appendChild(document.createTextNode(part)); return; }
        if (part[1]) dd.appendChild(html("strong", null, part[0]));
        else dd.appendChild(document.createTextNode(part[0]));
      });
      wrap.appendChild(html("dt", null, row.term));
      wrap.appendChild(dd);
      host.appendChild(wrap);
    });
  }

  function renderExecutionHighlights() {
    if (!EXEC.length) return;
    var ranked = EXEC.slice().sort(desc("score"));
    var best = ranked[0], second = ranked[1];
    var cheapest = minBy(EXEC, "cost"), priciest = maxBy(EXEC, "cost");
    var fastest = minBy(EXEC, "time"), slowest = maxBy(EXEC, "time");

    function times(a, b) {
      var r = a / b;
      return (r >= 10 ? Math.round(r) : Math.round(r * 10) / 10) + "×";
    }

    renderDefinitions("highlights", [
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
    ]);
  }

  function renderPlanningHighlights() {
    if (!PLAN.length) return;
    var ranked = PLAN.slice().sort(desc("score"));
    var best = ranked[0], second = ranked[1];
    var rows = [{
      term: "Top score",
      parts: [
        [best.name, true], [" leads at ", false], [num(best.score), true],
        second ? ", " + num(best.score - second.score) + " ahead of " + second.name + "." : ".",
      ],
    }];

    var acc = metricByKey("accuracy");
    if (acc) {
      var a = maxBy(PLAN, acc.key);
      rows.push({
        term: "Most accurate",
        parts: [
          [a.name, true], [" has the most findings that survive a check against the code — ", false],
          [num(val(a, acc.key)), true], [" (" + pointsLabel(a, acc) + ").", false],
        ],
      });
    }

    var hal = metricByKey("hallucination");
    if (hal) {
      var h = maxBy(PLAN, hal.key);
      rows.push({
        term: "Fewest invented claims",
        parts: [
          [h.name, true], [" scores ", false], [num(val(h, hal.key)), true],
          [" on hallucination, where a high value means little or nothing was made up.", false],
        ],
      });
    }

    var widest = METRICS.map(function (met) {
      var hi = maxBy(PLAN, met.key), lo = minBy(PLAN, met.key);
      return { met: met, hi: hi, lo: lo, spread: val(hi, met.key) - val(lo, met.key) };
    }).sort(function (a, b) { return b.spread - a.spread; })[0];
    if (widest) {
      rows.push({
        term: "Widest gap",
        parts: [
          [widest.met.label, true], [" separates the field most — ", false],
          [num(widest.spread) + " points", true],
          [" between " + widest.hi.name + " (" + num(val(widest.hi, widest.met.key)) + ") and " +
            widest.lo.name + " (" + num(val(widest.lo, widest.met.key)) + ").", false],
        ],
      });
    }

    renderDefinitions("highlights-planning", rows);
  }

  /* One small bar chart per metric, built from the data so a new metric
     needs no HTML change. */
  function renderMetricCards() {
    var host = document.getElementById("metric-grid");
    if (!host) return;
    host.textContent = "";
    METRICS.forEach(function (met) {
      var card = html("div", "card card-metric");
      var head = html("div", "card-head");
      var h3 = html("h3", null, met.label + " ");
      h3.appendChild(html("span", "weight", met.weight + " of 100 points"));
      head.appendChild(h3);
      head.appendChild(html("p", null, met.about));
      var mount = html("div", "chart");
      mount.id = "chart-metric-" + met.key;
      var foot = html("div", "card-foot");
      foot.appendChild(html("span", null, "Normalized to 100 · higher is better"));
      card.appendChild(head);
      card.appendChild(mount);
      card.appendChild(foot);
      host.appendChild(card);
    });
  }

  function renderMetricList() {
    var host = document.getElementById("metric-list");
    if (host) {
      host.textContent = "";
      METRICS.forEach(function (met) {
        var li = document.createElement("li");
        li.appendChild(html("strong", null, met.label));
        li.appendChild(document.createTextNode(" (" + met.weight + " points) — " + met.about));
        host.appendChild(li);
      });
    }
    var line = document.getElementById("weights-line");
    if (line) {
      var total = 0;
      line.textContent = METRICS.map(function (met) {
        total += met.weight;
        return met.label + " " + met.weight;
      }).join(" · ") + " — " + total + " in all.";
    }
  }

  /* ---------------- leaderboard tables ---------------- */

  function barCell(key, max) {
    return function (m) {
      var td = html("td", "metric");
      var cell = html("div", "metric-cell");
      var bar = html("div", "metric-bar");
      var fill = document.createElement("span");
      fill.style.width = Math.max(2, (val(m, key) / max) * 100) + "%";
      bar.appendChild(fill);
      cell.appendChild(bar);
      cell.appendChild(html("span", "metric-value", num(val(m, key))));
      td.appendChild(cell);
      return td;
    };
  }

  function pointsCell(met) {
    return function (m) {
      var td = html("td", "num score-cell");
      td.appendChild(html("span", "norm", num(val(m, met.key))));
      td.appendChild(html("span", "pts", m.points[met.key] + "/" + met.weight));
      return td;
    };
  }

  /* spec: { table, rows, rankBy, columns: [{ key, dir, render, label? }] }
     A column with a label gets its heading added to the table; the rest
     are declared in the HTML. */
  function makeTable(spec) {
    var table = document.querySelector(spec.table);
    if (!table) return;
    var tbody = table.querySelector("tbody");
    var headRow = table.querySelector("thead tr");
    var state = { key: spec.rankBy, dir: "desc" };

    var rankOf = {};
    spec.rows.slice().sort(desc(spec.rankBy)).forEach(function (m, i) { rankOf[m.id] = i + 1; });

    spec.columns.forEach(function (col) {
      if (!col.label) return;
      var th = html("th", "num");
      th.setAttribute("scope", "col");
      th.setAttribute("data-key", col.key);
      var btn = html("button", "sort-btn", col.label + " ");
      btn.type = "button";
      var arrow = html("span", "arrow", "↓");
      arrow.setAttribute("aria-hidden", "true");
      btn.appendChild(arrow);
      th.appendChild(btn);
      headRow.appendChild(th);
    });

    function defaultDir(key) {
      if (key === "name") return "asc";
      var col = spec.columns.filter(function (c) { return c.key === key; })[0];
      return (col && col.dir) || "desc";
    }

    function render() {
      var rows = spec.rows.slice().sort(function (a, b) {
        var d = state.key === "name" ? a.name.localeCompare(b.name) : val(a, state.key) - val(b, state.key);
        return state.dir === "desc" ? -d : d;
      });

      tbody.textContent = "";
      rows.forEach(function (m) {
        var tr = document.createElement("tr");
        tr.appendChild(html("td", "rank", String(rankOf[m.id])));
        tr.appendChild(html("td", "model", m.name));
        var eff = html("td", "effort");
        eff.appendChild(html("span", "badge", m.effort));
        tr.appendChild(eff);
        spec.columns.forEach(function (col) { tr.appendChild(col.render(m)); });
        tbody.appendChild(tr);
      });

      table.querySelectorAll("th[data-key]").forEach(function (th) {
        var active = th.getAttribute("data-key") === state.key;
        if (active) th.setAttribute("aria-sort", state.dir === "desc" ? "descending" : "ascending");
        else th.removeAttribute("aria-sort");
        var arrow = th.querySelector(".arrow");
        if (arrow) arrow.textContent = active ? (state.dir === "desc" ? "↓" : "↑") : "↓";
      });
    }

    table.querySelectorAll("th[data-key] .sort-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var key = btn.parentElement.getAttribute("data-key");
        if (state.key === key) {
          state.dir = state.dir === "desc" ? "asc" : "desc";
        } else {
          state.key = key;
          state.dir = defaultDir(key);
        }
        render();
      });
    });

    render();
  }

  function renderTables() {
    makeTable({
      table: "#table-execution", rows: EXEC, rankBy: "score",
      columns: [
        { key: "score", dir: "desc", render: barCell("score", 100) },
        { key: "time", dir: "asc", render: barCell("time", maxOf(EXEC, "time")) },
        { key: "cost", dir: "asc", render: barCell("cost", maxOf(EXEC, "cost")) },
      ],
    });
    makeTable({
      table: "#table-planning", rows: PLAN, rankBy: "score",
      columns: [{ key: "score", dir: "desc", render: barCell("score", 100) }].concat(
        METRICS.map(function (met) {
          return { key: met.key, dir: "desc", label: met.short || met.label, render: pointsCell(met) };
        })
      ),
    });
  }

  /* ---------------- charts ---------------- */

  function drawExecutionCharts() {
    var scoreItems = EXEC.slice().sort(desc("score")).map(function (m) {
      return { label: m.name, value: m.score, meta: effortLabel(m) };
    });
    barChart(document.getElementById("chart-score"), {
      items: scoreItems, max: 100, ticks: [0, 25, 50, 75, 100], rowH: 48,
      unit: "out of 100", valueSuffix: " / 100",
      ariaLabel: "CROS Execution score by model, higher is better, out of 100",
      axisLabel: "CROS Execution score (0–100)",
    });

    var timeItems = EXEC.slice().sort(asc("time")).map(function (m) {
      return { label: m.name, value: m.time, meta: effortLabel(m) };
    });
    barChart(document.getElementById("chart-time"), {
      items: timeItems, max: 100, ticks: [0, 25, 50, 75, 100],
      unit: "time index", valueSuffix: " time index",
      ariaLabel: "Normalized time spent by model, lower is better",
      axisLabel: "Time index (lower is better)",
    });

    var costMax = Math.ceil(maxOf(EXEC, "cost") / 25) * 25;
    var costItems = EXEC.slice().sort(asc("cost")).map(function (m) {
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
      points: EXEC.map(function (m) {
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
      yLabel: "Execution score →",
      ariaLabel: "CROS Execution score versus normalized cost for each model",
    });

    scatter(document.getElementById("chart-time-quality"), {
      points: EXEC.map(function (m) {
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
      yLabel: "Execution score →",
      ariaLabel: "CROS Execution score versus normalized time spent for each model",
    });
  }

  function drawPlanningCharts() {
    var totalItems = PLAN.slice().sort(desc("score")).map(function (m) {
      return { label: m.name, value: m.score, meta: effortLabel(m) };
    });
    barChart(document.getElementById("chart-planning"), {
      items: totalItems, max: 100, ticks: [0, 25, 50, 75, 100], rowH: 48,
      unit: "out of 100", valueSuffix: " / 100",
      ariaLabel: "CROS Planning score by model, higher is better, out of 100",
      axisLabel: "CROS Planning score (0–100)",
    });

    METRICS.forEach(function (met) {
      var mount = document.getElementById("chart-metric-" + met.key);
      if (!mount) return;
      var items = PLAN.slice().sort(desc(met.key)).map(function (m) {
        return { label: m.name, value: val(m, met.key), meta: pointsLabel(m, met) + " · " + effortLabel(m) };
      });
      barChart(mount, {
        items: items, max: 100, ticks: [0, 50, 100], rowH: 32,
        unit: "out of 100", valueSuffix: " / 100",
        ariaLabel: met.label + " by model, normalized to 100, higher is better",
      });
    });

    /* the same model on both tracks, paired by id */
    var both = PLAN.map(function (p) {
      var e = EXEC.filter(function (m) { return m.id === p.id; })[0];
      return e ? { plan: p, exec: e } : null;
    }).filter(Boolean);
    var mount = document.getElementById("chart-plan-exec");
    if (!mount || !both.length) return;

    var xDom = niceDomain(both.map(function (b) { return b.exec.score; }), 4);
    var yDom = niceDomain(both.map(function (b) { return b.plan.score; }), 10);
    scatter(mount, {
      points: both.map(function (b) {
        var eff = b.plan.effort === b.exec.effort
          ? effortLabel(b.plan)
          : b.exec.effort + " / " + b.plan.effort + " effort";
        return {
          label: b.plan.name, x: b.exec.score, y: b.plan.score,
          tipValue: num(b.plan.score) + " planning",
          tipMeta: "Execution " + num(b.exec.score) + " · " + eff,
          aria: b.plan.name + ": planning score " + num(b.plan.score) + ", execution score " + num(b.exec.score),
        };
      }),
      xScale: "linear", xDomain: xDom.domain, xTicks: xDom.ticks,
      yDomain: yDom.domain, yTicks: yDom.ticks,
      xLabel: "Execution score →",
      yLabel: "Planning score →",
      ariaLabel: "CROS Planning score versus CROS Execution score for each model",
    });
  }

  function drawCharts() {
    if (EXEC.length) drawExecutionCharts();
    if (PLAN.length) drawPlanningCharts();
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
    var tasks = DATA.execution.tasks + DATA.planning.tasks;

    setText("meta-updated", DATA.meta.updated);
    setText("meta-status", DATA.meta.status);
    setText("meta-tasks", tasks + (tasks === 1 ? " task" : " tasks"));
    setText("meta-models", modelCount() + " models");
    setText("footer-updated", DATA.meta.updated);

    renderStats();
    renderExecutionHighlights();
    renderPlanningHighlights();
    renderMetricCards();
    renderMetricList();
    renderTables();
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
