/* Header background: pencil-sketched clouds drifting slowly across the page.
   Each cloud is drawn once onto its own offscreen canvas (so the graphite
   texture stays put instead of shimmering) and then blitted at a moving
   position. Purely decorative: if this script does not run, or the visitor
   prefers reduced motion, the header still looks fine. */
(function () {
  "use strict";

  var CANVAS_ID = "hero-clouds";

  var GRAPHITE = "70, 82, 98";
  var FILL = "rgba(255, 255, 255, 0.78)";

  // Clouds are laid out in depth layers. Within a layer every cloud moves at
  // the same speed and they are evenly spaced around a wrap-around band, so
  // the spacing never drifts apart and there is always another one coming.
  var LAYERS = [
    { minH: 34, maxH: 52, speed: 4.5, alpha: 0.5, top: -0.05, bottom: 0.35, gap: 1.05 },
    { minH: 52, maxH: 78, speed: 7.5, alpha: 0.78, top: 0.1, bottom: 0.6, gap: 1.15 },
    { minH: 78, maxH: 116, speed: 11, alpha: 1, top: 0.28, bottom: 0.8, gap: 1.3 },
  ];

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

  // A cloud is a row of heavily overlapping puffs sitting on a flat base. The
  // puffs are stepped along by little more than one radius each, so neighbours
  // always overlap and their union reads as one billowing shape.
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

  // The silhouette: the runs of each puff's circle that are on the outside of
  // the union and above the base.
  function outlineArcs(shape) {
    var arcs = [];
    for (var i = 0; i < shape.puffs.length; i++) {
      var c = shape.puffs[i];
      var steps = Math.max(30, Math.round(c.r * 1.8));
      var run = [];
      for (var s = 0; s <= steps; s++) {
        var a = (s / steps) * Math.PI * 2;
        var x = c.x + Math.cos(a) * c.r;
        var y = c.y + Math.sin(a) * c.r;
        if (!insideOther(shape.puffs, i, x, y) && y <= shape.base) {
          run.push({ x: x, y: y });
        } else {
          if (run.length > 3) arcs.push(run);
          run = [];
        }
      }
      if (run.length > 3) arcs.push(run);
    }
    return arcs;
  }

  // Where two neighbouring puffs overlap, the smaller one's arc *inside* the
  // larger is the crescent you would draw to show one lobe bulging in front of
  // the other. These interior lines are what stop the cloud reading as a flat
  // outline: they give it front-to-back depth.
  function lobeArcs(shape) {
    var arcs = [];
    for (var i = 0; i < shape.puffs.length - 1; i++) {
      var a = shape.puffs[i];
      var b = shape.puffs[i + 1];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      // Skip pairs that barely touch, or where one swallows the other whole.
      if (d >= a.r + b.r || d <= Math.abs(a.r - b.r) * 1.05) continue;

      var small = a.r <= b.r ? a : b;
      var big = a.r <= b.r ? b : a;
      // Start sampling on the far side of the small puff, so the run that
      // falls inside the big one comes out in one piece rather than split
      // across the seam.
      var a0 = Math.atan2(big.y - small.y, big.x - small.x) + Math.PI;
      var steps = Math.max(48, Math.round(small.r * 2));
      var run = [];
      for (var s = 0; s <= steps; s++) {
        var ang = a0 + (s / steps) * Math.PI * 2;
        var x = small.x + Math.cos(ang) * small.r;
        var y = small.y + Math.sin(ang) * small.r;
        var ddx = x - big.x;
        var ddy = y - big.y;
        var inside = ddx * ddx + ddy * ddy < big.r * big.r;
        if (inside && y < shape.base - small.r * 0.05) {
          run.push({ x: x, y: y });
        } else {
          if (run.length > 8) arcs.push(run);
          run = [];
        }
      }
      if (run.length > 8) arcs.push(run);
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

  // Returns { canvas, w, h }: the sprite, and the size to draw it at. The
  // sprite is padded, because the outermost puffs bulge past the nominal
  // width and the tallest one past the nominal top.
  function drawCloud(rand, width, height, dpr) {
    var pad = height * 0.25;
    var w = width + pad * 2;
    var h = height + pad;

    var canvas = document.createElement("canvas");
    canvas.width = Math.ceil(w * dpr);
    canvas.height = Math.ceil(h * dpr);
    var ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.translate(pad, pad);

    var shape = cloudPuffs(rand, width, height);

    // Translucent white body, clipped off at the flat base. Filling all the
    // puffs as a single path means the overlaps do not stack up and darken.
    ctx.save();
    ctx.beginPath();
    ctx.rect(-pad, -pad, w, shape.base + pad);
    ctx.clip();
    cloudPath(ctx, shape);
    ctx.fillStyle = FILL;
    ctx.fill();
    ctx.restore();

    // Interior lobes first, so the silhouette drawn over them stays crisp.
    var lobes = lobeArcs(shape);
    for (var j = 0; j < lobes.length; j++) {
      pencilStroke(ctx, lobes[j], rand, { passes: 2, jitter: 0.9, alpha: 0.2, width: 1 });
    }

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

    return { canvas: canvas, w: w, h: h };
  }

  /* ---- The sky --------------------------------------------------------- */

  var clouds = [];
  var canvas, ctx, cssW, cssH, dpr;
  var lastTime = 0;
  var animating = false;

  function build() {
    var rand = rng(20140107);
    var scale = Math.max(0.75, cssH / 290);
    clouds = [];

    for (var l = 0; l < LAYERS.length; l++) {
      var layer = LAYERS[l];
      var midH = ((layer.minH + layer.maxH) / 2) * scale;
      var midW = midH * 2.9;
      // Space them barely more than a cloud apart, so the sky stays busy
      // without the clouds merging into one continuous bank.
      var spacing = midW * layer.gap;
      var band = cssW + midW * 2;
      var count = Math.max(3, Math.round(band / spacing));
      var slot = band / count;

      for (var i = 0; i < count; i++) {
        var h = lerp(layer.minH, layer.maxH, rand()) * scale;
        var w = h * lerp(2.4, 3.4, rand());
        var sprite = drawCloud(rand, w, h, dpr);
        clouds.push({
          sprite: sprite.canvas,
          w: sprite.w,
          h: sprite.h,
          band: band,
          // Even slots, nudged a little so the row does not look ruled.
          x: i * slot + (rand() - 0.5) * slot * 0.4 - midW,
          y: lerp(layer.top, layer.bottom, rand()) * cssH,
          speed: layer.speed,
          alpha: layer.alpha * lerp(0.85, 1, rand()),
        });
      }
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
      // Wrapping by exactly one band keeps each layer evenly spaced forever.
      if (c.x > c.band - c.w) c.x -= c.band;
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
