/* Header background: pencil-sketched clouds drifting slowly across the page.
   Each cloud is drawn once onto its own offscreen canvas (so the graphite
   texture stays put instead of shimmering) and then blitted at a moving
   position. Purely decorative: if this script does not run, or the visitor
   prefers reduced motion, the header still looks fine. */
(function () {
  "use strict";

  var CANVAS_CLASS = "sky-canvas";

  // Pencil and paper colours come from the stylesheet, so the light and dark
  // themes can each set their own; readTheme() picks up the current pair.
  var GRAPHITE = "70, 82, 98";
  var FILL = "rgba(255, 255, 255, 0.78)";

  function readTheme() {
    var css = window.getComputedStyle(document.documentElement);
    var ink = css.getPropertyValue("--cloud-ink").trim();
    var fill = css.getPropertyValue("--cloud-fill").trim();
    if (ink) GRAPHITE = ink;
    if (fill) FILL = fill;
  }

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

      // Cover a random run of the line rather than all of it, unless the
      // caller needs the line to start where it starts (the lobe lines have
      // to meet the skyline).
      var span = opts.full ? pts.length : Math.round(pts.length * lerp(0.55, 1.0, rand()));
      var start = opts.full ? 0 : Math.floor(rand() * (pts.length - span + 1));
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

  // Keep the top of an arc and a variable run of it below: the line should
  // start at the notch where two puffs meet on the skyline and trail down into
  // the body of the cloud, not float in the middle of it. Drawn all the way
  // round it would read as a ring stamped on the cloud.
  function trimArc(run, rand) {
    var ordered = run[0].y <= run[run.length - 1].y ? run : run.slice().reverse();
    var keep = Math.round(ordered.length * lerp(0.3, 0.85, rand()));
    if (keep < 6) return null;
    return ordered.slice(0, keep);
  }

  // Push an arc off its circle: a slow radial wobble plus a vertical squash,
  // so no two lobes are the same shape and none of them is a clean circle.
  function deformArc(run, centre, rand) {
    var p1 = rand() * Math.PI * 2;
    var p2 = rand() * Math.PI * 2;
    var a1 = lerp(0.06, 0.16, rand());
    var a2 = lerp(0.03, 0.09, rand());
    var squash = lerp(0.78, 1.0, rand());
    var out = [];
    for (var i = 0; i < run.length; i++) {
      var dx = run[i].x - centre.x;
      var dy = run[i].y - centre.y;
      var ang = Math.atan2(dy, dx);
      var wob = 1 + a1 * Math.sin(2 * ang + p1) + a2 * Math.sin(3 * ang + p2);
      out.push({ x: centre.x + dx * wob, y: centre.y + dy * wob * squash });
    }
    return out;
  }

  // Where two neighbouring puffs overlap, the smaller one's arc *inside* the
  // larger is the line you would draw to show one lobe bulging in front of the
  // other. Only a stretch of it is kept, wobbled off true: these interior
  // lines should suggest depth, not outline a row of balloons.
  function lobeArcs(shape, rand) {
    var arcs = [];
    for (var i = 0; i < shape.puffs.length - 1; i++) {
      var a = shape.puffs[i];
      var b = shape.puffs[i + 1];
      var dx = b.x - a.x;
      var dy = b.y - a.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      // Skip pairs that barely touch, or where one swallows the other whole.
      if (d >= a.r + b.r || d <= Math.abs(a.r - b.r) * 1.05) continue;
      // Leave some overlaps undrawn, so the lobes do not march in step.
      if (rand() < 0.28) continue;

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
          push(arcs, run, small, rand);
          run = [];
        }
      }
      push(arcs, run, small, rand);
    }
    return arcs;
  }

  function push(arcs, run, centre, rand) {
    if (run.length <= 10) return;
    var trimmed = trimArc(run, rand);
    if (trimmed) arcs.push(deformArc(trimmed, centre, rand));
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
    var lobes = lobeArcs(shape, rand);
    for (var j = 0; j < lobes.length; j++) {
      pencilStroke(ctx, lobes[j], rand, { passes: 1, jitter: 0.8, alpha: 0.22, width: 1, full: true });
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

  // Each .sky-canvas on the page gets its own sky. They share one animation
  // frame loop rather than each running their own.
  function Sky(canvas, seed) {
    this.canvas = canvas;
    this.seed = seed;
    this.clouds = [];
    // data-flip turns the sky upside down; data-drift="rtl" sends it the
    // other way. The footer uses both.
    this.flip = canvas.hasAttribute("data-flip");
    this.dir = canvas.getAttribute("data-drift") === "rtl" ? -1 : 1;
  }

  Sky.prototype.setup = function () {
    var canvas = this.canvas;
    this.cssW = canvas.offsetWidth;
    this.cssH = canvas.offsetHeight;
    if (!this.cssW || !this.cssH) return;
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(this.cssW * dpr);
    canvas.height = Math.round(this.cssH * dpr);
    this.ctx = canvas.getContext("2d");
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.build(dpr);
    this.paint();
  };

  Sky.prototype.build = function (dpr) {
    var rand = rng(this.seed);
    var scale = Math.max(0.75, this.cssH / 290);
    var clouds = [];

    for (var l = 0; l < LAYERS.length; l++) {
      var layer = LAYERS[l];
      var midH = ((layer.minH + layer.maxH) / 2) * scale;
      var midW = midH * 2.9;
      // Space them barely more than a cloud apart, so the sky stays busy
      // without the clouds merging into one continuous bank.
      var spacing = midW * layer.gap;
      var band = this.cssW + midW * 2;
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
          y: lerp(layer.top, layer.bottom, rand()) * this.cssH,
          speed: layer.speed,
          alpha: layer.alpha * lerp(0.85, 1, rand()),
        });
      }
    }
    clouds.sort(function (a, b) { return a.alpha - b.alpha; });
    this.clouds = clouds;
  };

  Sky.prototype.advance = function (dt) {
    for (var i = 0; i < this.clouds.length; i++) {
      var c = this.clouds[i];
      c.x += c.speed * dt * this.dir;
      // Wrapping by exactly one band keeps each layer evenly spaced forever.
      if (c.x > c.band - c.w) c.x -= c.band;
      else if (c.x < -c.w) c.x += c.band;
    }
  };

  Sky.prototype.paint = function () {
    if (!this.ctx) return;
    var ctx = this.ctx;
    ctx.clearRect(0, 0, this.cssW, this.cssH);
    ctx.save();
    if (this.flip) {
      ctx.translate(0, this.cssH);
      ctx.scale(1, -1);
    }
    for (var i = 0; i < this.clouds.length; i++) {
      var c = this.clouds[i];
      ctx.globalAlpha = c.alpha;
      ctx.drawImage(c.sprite, c.x, c.y, c.w, c.h);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
  };

  var skies = [];
  var lastTime = 0;
  var animating = false;

  function step(now) {
    if (!animating) return;
    var dt = lastTime ? Math.min(0.05, (now - lastTime) / 1000) : 0;
    lastTime = now;
    for (var i = 0; i < skies.length; i++) {
      skies[i].advance(dt);
      skies[i].paint();
    }
    requestAnimationFrame(step);
  }

  function setupAll() {
    readTheme();
    for (var i = 0; i < skies.length; i++) skies[i].setup();

    var still = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!still && !animating && skies.length) {
      animating = true;
      lastTime = 0;
      requestAnimationFrame(step);
    }
  }

  function init() {
    var canvases = document.querySelectorAll("." + CANVAS_CLASS);
    for (var i = 0; i < canvases.length; i++) {
      // A different seed per sky, so the header and the footer differ.
      skies.push(new Sky(canvases[i], 20140107 + i * 7919));
    }
    setupAll();
  }

  var resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      for (var i = 0; i < skies.length; i++) {
        var s = skies[i];
        if (s.canvas.offsetWidth !== s.cssW || s.canvas.offsetHeight !== s.cssH) {
          setupAll();
          return;
        }
      }
    }, 200);
  }

  // Redraw in the current theme's colours (called by the light/dark switch).
  window.scirisSky = { refresh: setupAll };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  window.addEventListener("resize", onResize);
})();
