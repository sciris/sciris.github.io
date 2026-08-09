/* Header background: pencil-sketched clouds drifting slowly across the page.
   Each cloud is drawn once onto its own offscreen canvas (so the graphite
   texture stays put instead of shimmering) and then blitted at a moving
   position. Purely decorative: if this script does not run, or the visitor
   prefers reduced motion, the header still looks fine. */
(function () {
  "use strict";

  var CANVAS_ID = "hero-clouds";

  var GRAPHITE = "70, 82, 98";
  var CLOUD_COUNT = 7;
  var SPEED_MIN = 4; // pixels per second
  var SPEED_MAX = 11;

  // Deterministic RNG, so the sky is laid out the same way on every load.
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---- Pencil strokes -------------------------------------------------- */

  // Draw a polyline the way a pencil would: several overlapping passes, each
  // wandering slightly off the true line and each covering only part of it, so
  // the ends feather out and the middle picks up extra graphite.
  function pencilStroke(ctx, pts, rand, opts) {
    if (pts.length < 2) return;
    var passes = opts.passes || 3;
    var jitter = opts.jitter == null ? 1.1 : opts.jitter;
    var alpha = opts.alpha == null ? 0.16 : opts.alpha;
    var width = opts.width == null ? 1.1 : opts.width;

    for (var p = 0; p < passes; p++) {
      // Each pass wanders on its own slow wave, plus a little grain.
      var f1 = lerp(0.06, 0.16, rand());
      var f2 = lerp(0.2, 0.5, rand());
      var ph1 = rand() * Math.PI * 2;
      var ph2 = rand() * Math.PI * 2;
      var amp = jitter * lerp(0.5, 1.3, rand());

      // Cover a random run of the line rather than all of it.
      var span = Math.round(pts.length * lerp(0.55, 1.0, rand()));
      var start = Math.floor(rand() * (pts.length - span + 1));
      var end = Math.min(pts.length, start + span);

      ctx.beginPath();
      for (var i = start; i < end; i++) {
        var prev = pts[i === 0 ? 0 : i - 1];
        var pt = pts[i];
        var dx = pt.x - prev.x;
        var dy = pt.y - prev.y;
        var len = Math.sqrt(dx * dx + dy * dy) || 1;
        // Offset perpendicular to the line's direction.
        var nx = -dy / len;
        var ny = dx / len;
        var off = amp * (Math.sin(i * f1 + ph1) + 0.45 * Math.sin(i * f2 + ph2)) + (rand() - 0.5) * 0.5;
        var x = pt.x + nx * off;
        var y = pt.y + ny * off;
        if (i === start) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(" + GRAPHITE + "," + (alpha * lerp(0.7, 1.15, rand())).toFixed(3) + ")";
      ctx.lineWidth = width * lerp(0.8, 1.2, rand());
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();
    }
  }

  /* ---- Cloud shape ----------------------------------------------------- */

  // A cloud is a row of heavily overlapping puffs sitting on a flat base. Its
  // outline is the boundary of their union: sample each puff and drop the
  // samples that fall inside another puff, or below the base line. The puffs
  // are stepped along by little more than one radius each, so neighbours
  // always overlap and the union reads as one billowing shape.
  function cloudPuffs(rand, width, height) {
    var puffs = [];
    var base = height * 0.88;
    var inset = height * 0.3;
    var x = inset;
    var stop = width - inset;
    while (x < stop && puffs.length < 9) {
      var t = (x - inset) / Math.max(1, stop - inset);
      // Bigger puffs in the middle of the cloud, smaller at the shoulders.
      var bulk = 0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, t));
      var r = height * lerp(0.3, 0.48, rand()) * bulk;
      var cy = base - r * lerp(0.68, 0.98, rand());
      puffs.push({ x: x, y: cy, r: r });
      x += r * lerp(0.95, 1.3, rand());
    }
    return { puffs: puffs, base: base };
  }

  // Where the union of the puffs meets the flat base.
  function baseExtent(shape) {
    var left = Infinity;
    var right = -Infinity;
    for (var i = 0; i < shape.puffs.length; i++) {
      var c = shape.puffs[i];
      var dy = shape.base - c.y;
      if (Math.abs(dy) >= c.r) continue;
      var half = Math.sqrt(c.r * c.r - dy * dy);
      left = Math.min(left, c.x - half);
      right = Math.max(right, c.x + half);
    }
    return { left: left, right: right };
  }

  function insideOther(puffs, skip, x, y) {
    for (var i = 0; i < puffs.length; i++) {
      if (i === skip) continue;
      var dx = x - puffs[i].x;
      var dy = y - puffs[i].y;
      if (dx * dx + dy * dy < puffs[i].r * puffs[i].r * 0.985) return true;
    }
    return false;
  }

  // The visible arcs of the union boundary, as a list of polylines.
  function outlineArcs(shape) {
    var arcs = [];
    for (var i = 0; i < shape.puffs.length; i++) {
      var c = shape.puffs[i];
      var steps = Math.max(28, Math.round(c.r * 1.6));
      var run = [];
      for (var s = 0; s <= steps; s++) {
        var a = (s / steps) * Math.PI * 2;
        var x = c.x + Math.cos(a) * c.r;
        var y = c.y + Math.sin(a) * c.r;
        var hidden = y > shape.base || insideOther(shape.puffs, i, x, y);
        if (hidden) {
          if (run.length > 3) arcs.push(run);
          run = [];
        } else {
          run.push({ x: x, y: y });
        }
      }
      if (run.length > 3) arcs.push(run);
    }
    return arcs;
  }

  function cloudPath(ctx, shape) {
    ctx.beginPath();
    for (var i = 0; i < shape.puffs.length; i++) {
      var c = shape.puffs[i];
      ctx.moveTo(c.x + c.r, c.y);
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    }
  }

  // Diagonal hatching along the underside, the way you would shade a cloud.
  function shadeUnderside(ctx, shape, rand, width, height) {
    ctx.save();
    cloudPath(ctx, shape);
    ctx.clip();
    var step = 5;
    for (var x = -height; x < width + height; x += step) {
      var pts = [
        { x: x, y: shape.base + 2 },
        { x: x + height * 0.55, y: shape.base - height * 0.55 },
      ];
      // Only the strokes nearest the base, fading out as they climb.
      pencilStroke(ctx, [pts[0], { x: lerp(pts[0].x, pts[1].x, 0.5), y: lerp(pts[0].y, pts[1].y, 0.5) }], rand, {
        passes: 1,
        jitter: 0.6,
        alpha: 0.1,
        width: 1,
      });
    }
    ctx.restore();
  }

  function drawCloud(rand, width, height, dpr) {
    var canvas = document.createElement("canvas");
    canvas.width = Math.ceil(width * dpr);
    canvas.height = Math.ceil(height * dpr);
    var ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    var shape = cloudPuffs(rand, width, height);
    shadeUnderside(ctx, shape, rand, width, height);

    var arcs = outlineArcs(shape);
    for (var i = 0; i < arcs.length; i++) {
      pencilStroke(ctx, arcs[i], rand, { passes: 3, jitter: 1.2, alpha: 0.42, width: 1.15 });
    }

    // The flat base, drawn lighter and broken up so it reads as a soft edge.
    var ext = baseExtent(shape);
    if (ext.left < ext.right) {
      var basePts = [];
      for (var b = 0; b <= 40; b++) {
        basePts.push({ x: lerp(ext.left, ext.right, b / 40), y: shape.base });
      }
      pencilStroke(ctx, basePts, rand, { passes: 2, jitter: 1.5, alpha: 0.26, width: 1 });
    }

    return canvas;
  }

  /* ---- The sky --------------------------------------------------------- */

  var clouds = [];
  var canvas, ctx, cssW, cssH, dpr;
  var lastTime = 0;
  var animating = false;

  function build() {
    var rand = rng(20140107);
    clouds = [];
    var span = cssW + 260; // clouds wrap around a band wider than the header
    for (var i = 0; i < CLOUD_COUNT; i++) {
      // A mix of near (large, faster, darker) and far (small, slower, fainter).
      var depth = rand();
      var h = lerp(56, 118, depth) * (cssH / 290);
      var w = h * lerp(2.4, 3.4, rand());
      clouds.push({
        sprite: drawCloud(rand, w, h, dpr),
        w: w,
        h: h,
        x: (i / CLOUD_COUNT) * span + rand() * 60 - 130,
        y: lerp(-h * 0.15, cssH * 0.72, rand()),
        speed: lerp(SPEED_MIN, SPEED_MAX, depth),
        alpha: lerp(0.45, 1, depth),
      });
    }
    clouds.sort(function (a, b) { return a.alpha - b.alpha; });
  }

  function paint() {
    ctx.clearRect(0, 0, cssW, cssH);
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      ctx.globalAlpha = c.alpha;
      ctx.drawImage(c.sprite, c.x, c.y, c.w, c.h);
    }
    ctx.globalAlpha = 1;
  }

  function step(now) {
    if (!animating) return;
    var dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
    lastTime = now;
    for (var i = 0; i < clouds.length; i++) {
      var c = clouds[i];
      c.x += c.speed * dt;
      if (c.x > cssW + 130) c.x = -c.w - 130;
    }
    paint();
    requestAnimationFrame(step);
  }

  function setup() {
    canvas = document.getElementById(CANVAS_ID);
    if (!canvas || !canvas.getContext) return;
    cssW = canvas.offsetWidth;
    cssH = canvas.offsetHeight;
    if (!cssW || !cssH) return;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    paint();

    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!still && !animating) {
      animating = true;
      lastTime = 0;
      requestAnimationFrame(step);
    }
  }

  var resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!canvas) return;
      if (canvas.offsetWidth === cssW && canvas.offsetHeight === cssH) return;
      setup();
    }, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setup);
  } else {
    setup();
  }
  window.addEventListener("resize", onResize);
})();
