/* MiniMap — mapa de tiles ligero en vanilla JS (sin librerías externas).
   Reemplaza a Leaflet para que la app no dependa de ningún CDN de librerías.
   Solo necesita internet para las imágenes de OpenStreetMap (como cualquier mapa). */
(function (global) {
  "use strict";

  var TILE = 256;
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function project(lat, lon, z) {
    var ws = TILE * Math.pow(2, z);
    var x = (lon + 180) / 360 * ws;
    var s = clamp(Math.sin(lat * Math.PI / 180), -0.9999, 0.9999);
    var y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * ws;
    return { x: x, y: y };
  }
  function unproject(x, y, z) {
    var ws = TILE * Math.pow(2, z);
    var lon = x / ws * 360 - 180;
    var n = Math.PI - 2 * Math.PI * y / ws;
    var lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    return { lat: lat, lon: lon };
  }

  function MiniMap(el, opts) {
    opts = opts || {};
    this.el = el;
    this.center = { lat: opts.center ? opts.center[0] : -38, lon: opts.center ? opts.center[1] : -71 };
    this.zoom = opts.zoom || 4;
    this.minZoom = opts.minZoom || 3;
    this.maxZoom = opts.maxZoom || 17;
    this.markers = [];
    this._popupId = null;
    this._build();
    this._wire();
    this.render();
  }

  MiniMap.prototype._build = function () {
    var el = this.el, self = this;
    el.style.position = "relative";
    el.style.overflow = "hidden";
    el.style.background = "#aadaff";
    el.style.cursor = "grab";
    el.style.userSelect = "none";
    el.innerHTML = "";

    this.tiles = document.createElement("div");
    this.tiles.className = "minimap-tiles";
    this.mk = document.createElement("div");
    this.mk.className = "minimap-markers";
    this.popup = document.createElement("div");
    this.popup.className = "minimap-popup";
    this.popup.style.display = "none";

    var attr = document.createElement("div");
    attr.className = "minimap-attr";
    attr.innerHTML = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

    var zc = document.createElement("div");
    zc.className = "minimap-zoom";
    var bplus = document.createElement("button"); bplus.type = "button"; bplus.textContent = "+"; bplus.setAttribute("aria-label", "Acercar");
    var bminus = document.createElement("button"); bminus.type = "button"; bminus.textContent = "−"; bminus.setAttribute("aria-label", "Alejar");
    bplus.addEventListener("click", function (e) { e.stopPropagation(); self.setZoom(self.zoom + 1); });
    bminus.addEventListener("click", function (e) { e.stopPropagation(); self.setZoom(self.zoom - 1); });
    zc.appendChild(bplus); zc.appendChild(bminus);

    el.appendChild(this.tiles);
    el.appendChild(this.mk);
    el.appendChild(this.popup);
    el.appendChild(attr);
    el.appendChild(zc);
  };

  MiniMap.prototype._wire = function () {
    var self = this, dragging = false, sx = 0, sy = 0;
    this.el.addEventListener("mousedown", function (e) {
      dragging = true; sx = e.clientX; sy = e.clientY; self._dx = 0; self._dy = 0;
      self.el.style.cursor = "grabbing";
    });
    window.addEventListener("mousemove", function (e) {
      if (!dragging) return;
      self._dx = e.clientX - sx; self._dy = e.clientY - sy;
      self.tiles.style.transform = "translate(" + self._dx + "px," + self._dy + "px)";
      self.mk.style.transform = "translate(" + self._dx + "px," + self._dy + "px)";
    });
    window.addEventListener("mouseup", function () {
      if (!dragging) return;
      dragging = false; self.el.style.cursor = "grab";
      var dx = self._dx || 0, dy = self._dy || 0; self._dx = 0; self._dy = 0;
      self.tiles.style.transform = ""; self.mk.style.transform = "";
      if (dx || dy) self._panBy(-dx, -dy);
    });
    this.el.addEventListener("wheel", function (e) {
      e.preventDefault();
      self.setZoom(self.zoom + (e.deltaY < 0 ? 1 : -1));
    }, { passive: false });

    // Táctil: paneo con un dedo
    var tsx = 0, tsy = 0, tdx = 0, tdy = 0, tdrag = false;
    this.el.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      tdrag = true; tsx = e.touches[0].clientX; tsy = e.touches[0].clientY; tdx = 0; tdy = 0;
    }, { passive: true });
    this.el.addEventListener("touchmove", function (e) {
      if (!tdrag || e.touches.length !== 1) return;
      tdx = e.touches[0].clientX - tsx; tdy = e.touches[0].clientY - tsy;
      self.tiles.style.transform = "translate(" + tdx + "px," + tdy + "px)";
      self.mk.style.transform = "translate(" + tdx + "px," + tdy + "px)";
    }, { passive: true });
    this.el.addEventListener("touchend", function () {
      if (!tdrag) return; tdrag = false;
      self.tiles.style.transform = ""; self.mk.style.transform = "";
      if (tdx || tdy) self._panBy(-tdx, -tdy);
    });

    window.addEventListener("resize", function () { self.render(); });
  };

  MiniMap.prototype._origin = function () {
    var w = this.el.clientWidth, h = this.el.clientHeight;
    var c = project(this.center.lat, this.center.lon, this.zoom);
    return { x: c.x - w / 2, y: c.y - h / 2, w: w, h: h };
  };

  MiniMap.prototype._panBy = function (dxWorld, dyWorld) {
    var c = project(this.center.lat, this.center.lon, this.zoom);
    this.center = unproject(c.x + dxWorld, c.y + dyWorld, this.zoom);
    this.render();
  };

  MiniMap.prototype.setZoom = function (z) {
    z = clamp(Math.round(z), this.minZoom, this.maxZoom);
    if (z === this.zoom) return;
    this.zoom = z; this.render();
  };
  MiniMap.prototype.setView = function (center, zoom) {
    if (center) this.center = { lat: center[0], lon: center[1] };
    if (zoom != null) this.zoom = clamp(Math.round(zoom), this.minZoom, this.maxZoom);
    this.render();
  };
  MiniMap.prototype.flyTo = function (center, zoom) { this.setView(center, zoom); };

  MiniMap.prototype.clearMarkers = function () {
    this.markers = []; this.mk.innerHTML = ""; this.closePopup();
  };
  MiniMap.prototype.addMarker = function (m) {
    var wrap = document.createElement("div");
    wrap.className = "minimap-marker";
    wrap.innerHTML = m.html;
    var rec = { id: m.id, lat: m.lat, lon: m.lon, el: wrap, popupHtml: m.popupHtml, onDetail: m.onDetail };
    var self = this;
    wrap.addEventListener("click", function (e) {
      e.stopPropagation();
      self.openPopup(m.id);
    });
    this.markers.push(rec);
    this.mk.appendChild(wrap);
    this._placeMarker(rec);
    return rec;
  };
  MiniMap.prototype._placeMarker = function (rec) {
    var o = this._origin();
    var p = project(rec.lat, rec.lon, this.zoom);
    var left = p.x - o.x, top = p.y - o.y;
    rec.el.style.left = left + "px";
    rec.el.style.top = top + "px";
    rec.el.style.display = (left > -30 && left < o.w + 30 && top > -40 && top < o.h + 10) ? "block" : "none";
  };

  MiniMap.prototype.render = function () {
    var o = this._origin(), ws = Math.pow(2, this.zoom);
    this.tiles.style.transform = "";
    this.tiles.innerHTML = "";
    var x0 = Math.floor(o.x / TILE), x1 = Math.floor((o.x + o.w) / TILE);
    var y0 = Math.floor(o.y / TILE), y1 = Math.floor((o.y + o.h) / TILE);
    for (var ty = y0; ty <= y1; ty++) {
      if (ty < 0 || ty >= ws) continue;
      for (var tx = x0; tx <= x1; tx++) {
        var wtx = ((tx % ws) + ws) % ws;
        var img = document.createElement("img");
        img.className = "minimap-tile";
        img.src = "https://tile.openstreetmap.org/" + this.zoom + "/" + wtx + "/" + ty + ".png";
        img.style.left = (tx * TILE - o.x) + "px";
        img.style.top = (ty * TILE - o.y) + "px";
        img.draggable = false;
        img.alt = "";
        this.tiles.appendChild(img);
      }
    }
    this.mk.style.transform = "";
    for (var i = 0; i < this.markers.length; i++) this._placeMarker(this.markers[i]);
    if (this._popupId != null) this._positionPopup();
  };

  MiniMap.prototype._find = function (id) {
    for (var i = 0; i < this.markers.length; i++) if (this.markers[i].id === id) return this.markers[i];
    return null;
  };
  MiniMap.prototype.openPopup = function (id) {
    var rec = this._find(id);
    if (!rec) return;
    this._popupId = id;
    this.popup.innerHTML = rec.popupHtml || "";
    this.popup.style.display = "block";
    var btn = this.popup.querySelector("[data-detalle]");
    if (btn) btn.addEventListener("click", function (e) { e.stopPropagation(); if (rec.onDetail) rec.onDetail(); });
    this._positionPopup();
  };
  MiniMap.prototype.closePopup = function () { this._popupId = null; this.popup.style.display = "none"; };
  MiniMap.prototype._positionPopup = function () {
    var rec = this._find(this._popupId);
    if (!rec) { this.closePopup(); return; }
    var o = this._origin();
    var p = project(rec.lat, rec.lon, this.zoom);
    this.popup.style.left = (p.x - o.x) + "px";
    this.popup.style.top = (p.y - o.y - 24) + "px";
  };

  global.MiniMap = MiniMap;
})(window);
