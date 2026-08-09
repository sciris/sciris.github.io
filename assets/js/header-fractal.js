/* Header background: a Julia set drawn in fine ink filaments, with a network
   graph whose nodes sit on the fractal's boundary. Purely decorative: if this
   script does not run, the header falls back to its flat background colour. */
(function () {
  "use strict";

  var CANVAS_ID = "hero-fractal";

  // Julia set parameters. This value of c gives a dendritic set: all filament,
  // no solid interior, which is what makes it read as a network.
  var CR = -0.7269;
  var CI = 0.1889;
  var MAX_ITER = 150;
  var ESCAPE = 4.0; // squared radius

  var INK = [27, 58, 92]; // navy filaments
  var INK_ALPHA = 0.3; // alpha of the very densest filament pixels
  var NODE_COLOR = "#75A8D9";
  var NODE_COUNT = 44;
  var EDGE_DIST = 0.14; // as a fraction of canvas width
  var SCALE = 1.0; // render the fractal at this resolution, then upscale

  // Deterministic RNG, so the network looks the same on every page load.
  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };
  }

  // Smoothed escape time in [0, 1]: 0 = escapes immediately, 1 = never escapes.
  function escapeTime(zr, zi) {
    var n = 0;
    var r2 = zr * zr + zi * zi;
    while (n < MAX_ITER && r2 <= ESCAPE) {
      var t = zr * zr - zi * zi + CR;
      zi = 2 * zr * zi + CI;
      zr = t;
      r2 = zr * zr + zi * zi;
      n++;
    }
    if (n >= MAX_ITER) return 1;
    // Continuous (fractional) iteration count, to avoid visible banding.
    var smooth = n + 1 - Math.log(Math.log(Math.sqrt(r2))) / Math.LN2;
    return Math.max(0, Math.min(1, smooth / MAX_ITER));
  }

  // The complex-plane window shown. The width is pinned to the width of the
  // set itself and the height follows the canvas aspect ratio, so on a wide
  // header this is a horizontal slice through the middle of the set: filaments
  // right across the frame rather than one small blob in the centre.
  function viewport(w, h) {
    var halfWidth = 1.05;
    var halfHeight = Math.max(0.28, (halfWidth * h) / w);
    return { x0: -halfWidth, y0: -halfHeight, dx: (2 * halfWidth) / w, dy: (2 * halfHeight) / h };
  }

  function drawFractal(ctx, w, h) {
    var fw = Math.max(1, Math.round(w * SCALE));
    var fh = Math.max(1, Math.round(h * SCALE));
    var view = viewport(fw, fh);
    var img = ctx.createImageData(fw, fh);
    var data = img.data;
    for (var py = 0; py < fh; py++) {
      var zi = view.y0 + py * view.dy;
      for (var px = 0; px < fw; px++) {
        var zr = view.x0 + px * view.dx;
        var t = escapeTime(zr, zi);
        // Emphasise the boundary: only points that take many iterations to
        // escape get any ink at all, and the falloff is steep.
        var a = Math.pow(t, 2.8) * INK_ALPHA;
        var i = (py * fw + px) * 4;
        data[i] = INK[0];
        data[i + 1] = INK[1];
        data[i + 2] = INK[2];
        data[i + 3] = Math.round(a * 255);
      }
    }
    // Upscale the low-resolution render to fill the canvas, which also softens
    // the filaments into something subtle enough to sit behind text.
    if (fw === w && fh === h) {
      ctx.putImageData(img, 0, 0);
      return;
    }
    var tmp = document.createElement("canvas");
    tmp.width = fw;
    tmp.height = fh;
    tmp.getContext("2d").putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(tmp, 0, 0, w, h);
  }

  // Scatter nodes onto the fractal boundary: reject samples that are not on a
  // filament, so the network inherits the shape of the Julia set.
  function findNodes(w, h) {
    var rand = rng(20140107);
    var view = viewport(w, h);
    var nodes = [];
    for (var tries = 0; tries < 60000 && nodes.length < NODE_COUNT; tries++) {
      var px = rand() * w;
      var py = rand() * h;
      var t = escapeTime(view.x0 + px * view.dx, view.y0 + py * view.dy);
      if (t < 0.8) continue;
      var tooClose = false;
      for (var j = 0; j < nodes.length; j++) {
        var dx = nodes[j].x - px;
        var dy = nodes[j].y - py;
        if (dx * dx + dy * dy < (0.055 * w) * (0.055 * w)) { tooClose = true; break; }
      }
      if (!tooClose) nodes.push({ x: px, y: py, t: t });
    }
    return nodes;
  }

  function drawNetwork(ctx, w, h) {
    var nodes = findNodes(w, h);
    var maxDist = EDGE_DIST * w;

    ctx.strokeStyle = NODE_COLOR;
    ctx.lineWidth = 1;
    for (var i = 0; i < nodes.length; i++) {
      for (var j = i + 1; j < nodes.length; j++) {
        var dx = nodes[i].x - nodes[j].x;
        var dy = nodes[i].y - nodes[j].y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d > maxDist) continue;
        ctx.globalAlpha = 0.4 * (1 - d / maxDist);
        ctx.beginPath();
        ctx.moveTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(nodes[j].x, nodes[j].y);
        ctx.stroke();
      }
    }

    ctx.fillStyle = NODE_COLOR;
    for (var k = 0; k < nodes.length; k++) {
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.arc(nodes[k].x, nodes[k].y, 2.2 + 1.8 * nodes[k].t, 0, 2 * Math.PI);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function render() {
    var canvas = document.getElementById(CANVAS_ID);
    if (!canvas || !canvas.getContext) return;
    var w = canvas.offsetWidth;
    var h = canvas.offsetHeight;
    if (!w || !h) return;
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, w, h);
    drawFractal(ctx, w, h);
    drawNetwork(ctx, w, h);
  }

  var resizeTimer = null;
  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 200);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
  window.addEventListener("resize", onResize);
})();
