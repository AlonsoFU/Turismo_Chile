/* Turismo Chile — Mapa interactivo de parques nacionales y reservas */
(function () {
  "use strict";

  const state = {
    lugares: [],
    tipos: {},
    filtroTexto: "",
    tiposActivos: new Set(),
    markers: new Map(), // id -> Leaflet marker
    seleccionado: null,
    visitados: new Set(), // ids de lugares marcados como visitados
    filtroEstado: "todos", // todos | pendientes | visitados
  };

  const LS_KEY = "turismo_chile_visitados_v1";

  let map;

  /* ---------- Pasaporte: lugares visitados (localStorage) ---------- */
  function cargarVisitados() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) JSON.parse(raw).forEach((id) => state.visitados.add(id));
    } catch (e) {
      /* localStorage no disponible: se ignora */
    }
  }
  function guardarVisitados() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify([...state.visitados]));
    } catch (e) {
      /* se ignora */
    }
  }
  function esVisitado(id) {
    return state.visitados.has(id);
  }
  function toggleVisitado(id) {
    if (state.visitados.has(id)) state.visitados.delete(id);
    else state.visitados.add(id);
    guardarVisitados();
  }
  function refrescarTodo() {
    renderMarkers();
    render();
  }

  /* ---------- Inicialización ---------- */
  init();

  async function init() {
    initMapa();

    try {
      const res = await fetch("data/lugares.json");
      if (!res.ok) throw new Error("HTTP " + res.status);
      const data = await res.json();
      state.lugares = data.lugares || [];
      state.tipos = (data.meta && data.meta.tipos) || {};
      state.tiposActivos = new Set(Object.keys(state.tipos));
    } catch (err) {
      document.getElementById("placesList").innerHTML =
        '<li style="padding:16px;color:#c0392b">No se pudieron cargar los datos (' +
        err.message +
        "). Ejecuta el proyecto desde un servidor local (ver README).</li>";
      return;
    }

    cargarVisitados();
    renderFiltros();
    renderEstadoFilter();
    renderMarkers();
    render();
    wireEvents();
  }

  /* ---------- Mapa (opcional: si Leaflet no carga, la app sigue funcionando) ---------- */
  function initMapa() {
    if (typeof L === "undefined") {
      const wrap = document.getElementById("map");
      if (wrap) {
        wrap.innerHTML =
          '<div style="display:flex;align-items:center;justify-content:center;height:100%;' +
          'padding:24px;text-align:center;color:#52606d;font-size:0.9rem">' +
          "No se pudo cargar la librería del mapa (Leaflet). " +
          "Revisa tu conexión a internet y recarga.<br>La lista y las fichas siguen disponibles a la izquierda." +
          "</div>";
      }
      return;
    }
    map = L.map("map", { zoomControl: true }).setView([-38, -71], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
  }

  /* ---------- Eventos globales ---------- */
  function wireEvents() {
    document.getElementById("search").addEventListener("input", (e) => {
      state.filtroTexto = normaliza(e.target.value.trim());
      render();
    });
    document.getElementById("detailClose").addEventListener("click", cerrarDetalle);
    document.getElementById("toggleSidebar").addEventListener("click", () => {
      document.getElementById("sidebar").classList.toggle("hidden");
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") cerrarDetalle();
    });
  }

  /* ---------- Filtros por tipo ---------- */
  function renderFiltros() {
    const cont = document.getElementById("typeFilters");
    cont.innerHTML = "";
    const conDatos = new Set(state.lugares.map((l) => l.tipo));
    Object.entries(state.tipos).forEach(([clave, info]) => {
      if (!conDatos.has(clave)) return; // solo tipos con al menos un lugar
      const chip = document.createElement("button");
      chip.className = "chip";
      chip.style.color = info.color;
      chip.setAttribute("aria-pressed", "true");
      chip.innerHTML =
        '<span class="dot" style="background:' + info.color + '"></span>' + info.etiqueta;
      chip.addEventListener("click", () => {
        if (state.tiposActivos.has(clave)) state.tiposActivos.delete(clave);
        else state.tiposActivos.add(clave);
        chip.setAttribute("aria-pressed", state.tiposActivos.has(clave) ? "true" : "false");
        renderMarkers();
        render();
      });
      cont.appendChild(chip);
    });
  }

  /* ---------- Filtro por estado (pasaporte) ---------- */
  function renderEstadoFilter() {
    const cont = document.getElementById("estadoFilter");
    if (!cont) return;
    const opciones = [
      ["todos", "Todos"],
      ["pendientes", "Pendientes"],
      ["visitados", "Visitados"],
    ];
    cont.innerHTML = "";
    opciones.forEach(([clave, etiqueta]) => {
      const b = document.createElement("button");
      b.className = "estado-chip";
      b.setAttribute("aria-pressed", state.filtroEstado === clave ? "true" : "false");
      b.textContent = etiqueta;
      b.addEventListener("click", () => {
        state.filtroEstado = clave;
        renderEstadoFilter();
        refrescarTodo();
      });
      cont.appendChild(b);
    });
  }

  /* ---------- Filtrado ---------- */
  function lugaresFiltrados() {
    const t = state.filtroTexto;
    return state.lugares.filter((l) => {
      if (!state.tiposActivos.has(l.tipo)) return false;
      if (state.filtroEstado === "visitados" && !esVisitado(l.id)) return false;
      if (state.filtroEstado === "pendientes" && esVisitado(l.id)) return false;
      if (!t) return true;
      const pueblos = (l.pueblos_cercanos || []).map((p) => p.nombre).join(" ");
      const heno = normaliza([l.nombre, l.region, l.descripcion, pueblos].join(" "));
      return heno.includes(t);
    });
  }

  /* ---------- Marcadores ---------- */
  function renderMarkers() {
    if (!map) return;
    state.markers.forEach((m) => map.removeLayer(m));
    state.markers.clear();

    const visibles = lugaresFiltrados();
    visibles.forEach((l) => {
      const color = (state.tipos[l.tipo] && state.tipos[l.tipo].color) || "#2e7d32";
      const vis = esVisitado(l.id);
      const icon = L.divIcon({
        className: "",
        html:
          '<div class="marker-pin' +
          (vis ? " marker-pin--visited" : "") +
          '" style="background:' +
          color +
          '">' +
          (vis ? '<span class="marker-check">✓</span>' : "") +
          "</div>",
        iconSize: [22, 22],
        iconAnchor: [11, 22],
        popupAnchor: [0, -20],
      });
      const marker = L.marker(l.coordenadas, { icon }).addTo(map);
      marker.bindPopup(
        '<div class="popup__name">' +
          escapeHtml(l.nombre) +
          '</div><div class="popup__type">' +
          (state.tipos[l.tipo] ? state.tipos[l.tipo].etiqueta : "") +
          " · " +
          escapeHtml(l.region) +
          '</div><div class="popup__btn" data-detalle="' +
          l.id +
          '">Ver detalle →</div>'
      );
      marker.on("popupopen", (e) => {
        const btn = e.popup.getElement().querySelector("[data-detalle]");
        if (btn) btn.addEventListener("click", () => abrirDetalle(l.id));
      });
      state.markers.set(l.id, marker);
    });
  }

  /* ---------- Lista + stats ---------- */
  function render() {
    const visibles = lugaresFiltrados();
    const lista = document.getElementById("placesList");
    lista.innerHTML = "";

    if (visibles.length === 0) {
      lista.innerHTML = '<li style="padding:16px;color:#52606d">Sin resultados.</li>';
    }

    visibles
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
      .forEach((l) => {
        const color = (state.tipos[l.tipo] && state.tipos[l.tipo].color) || "#2e7d32";
        const vis = esVisitado(l.id);
        const li = document.createElement("li");
        li.className =
          "place-card" +
          (state.seleccionado === l.id ? " active" : "") +
          (vis ? " visitado" : "");
        li.style.borderLeftColor = color;
        li.innerHTML =
          '<div class="place-card__top">' +
          '<p class="place-card__name">' +
          escapeHtml(l.nombre) +
          "</p>" +
          '<button class="visit-btn' +
          (vis ? " on" : "") +
          '" title="' +
          (vis ? "Marcado como visitado" : "Marcar como visitado") +
          '" aria-label="Marcar como visitado">✓</button>' +
          "</div>" +
          '<div class="place-card__meta">' +
          "<span>" +
          escapeHtml(l.region) +
          "</span>" +
          '<span class="rating">★ ' +
          (l.evaluacion ? l.evaluacion.puntaje.toFixed(1) : "–") +
          "</span>" +
          "</div>" +
          '<div class="place-card__meta" style="margin-top:6px">' +
          '<span class="place-card__badge" style="background:' +
          color +
          '">' +
          (state.tipos[l.tipo] ? state.tipos[l.tipo].etiqueta : "") +
          "</span>" +
          "<span>" +
          (l.senderos && l.senderos.length
            ? l.senderos.length + " senderos"
            : (l.actividades ? l.actividades.length : 0) + " actividades") +
          "</span>" +
          "</div>";
        li.addEventListener("click", () => {
          if (map) {
            map.flyTo(l.coordenadas, 9, { duration: 0.8 });
            const m = state.markers.get(l.id);
            if (m) m.openPopup();
          }
          abrirDetalle(l.id);
        });
        const vb = li.querySelector(".visit-btn");
        if (vb) {
          vb.addEventListener("click", (e) => {
            e.stopPropagation();
            toggleVisitado(l.id);
            if (state.filtroEstado === "todos") {
              // actualización en el sitio: no reconstruye la lista (mantiene el scroll)
              const on = esVisitado(l.id);
              li.classList.toggle("visitado", on);
              vb.classList.toggle("on", on);
              vb.title = on ? "Marcado como visitado" : "Marcar como visitado";
              renderMarkers();
              renderProgress();
            } else {
              // con filtro Visitados/Pendientes el ítem puede salir de la vista
              refrescarTodo();
            }
          });
        }
        lista.appendChild(li);
      });

    // stats (data-driven: un contador por cada tipo con resultados)
    document.getElementById("stats").innerHTML = Object.entries(state.tipos)
      .map(([clave, info]) => {
        const n = visibles.filter((l) => l.tipo === clave).length;
        if (!n) return "";
        return (
          "<span>" + (info.icono || "") + " " + n + " " + (info.plural || info.etiqueta) + "</span>"
        );
      })
      .join("");
    document.getElementById("footerCount").textContent =
      visibles.length + " lugares mostrados";

    renderProgress();
  }

  /* ---------- Barra de progreso (pasaporte) ---------- */
  function renderProgress() {
    const cont = document.getElementById("progress");
    if (!cont) return;
    const total = state.lugares.length;
    const visitadosTotal = state.lugares.filter((l) => esVisitado(l.id)).length;
    const pct = total ? Math.round((visitadosTotal / total) * 100) : 0;

    const tiposHtml = Object.entries(state.tipos)
      .map(([clave, info]) => {
        const list = state.lugares.filter((l) => l.tipo === clave);
        if (!list.length) return "";
        const v = list.filter((l) => esVisitado(l.id)).length;
        return (
          "<span>" +
          (info.icono || "") +
          " " +
          v +
          "/" +
          list.length +
          " " +
          (info.plural || info.etiqueta) +
          "</span>"
        );
      })
      .join("");

    cont.innerHTML =
      '<div class="progress__head">' +
      '<span class="progress__title">🧭 Mi pasaporte</span>' +
      '<span class="progress__count">' +
      visitadosTotal +
      " de " +
      total +
      " (" +
      pct +
      "%)" +
      (visitadosTotal
        ? ' · <button class="progress__reset" id="progressReset">reiniciar</button>'
        : "") +
      "</span>" +
      "</div>" +
      '<div class="progress__bar"><div class="progress__fill" style="width:' +
      pct +
      '%"></div></div>' +
      '<div class="progress__types">' +
      tiposHtml +
      "</div>";

    const reset = document.getElementById("progressReset");
    if (reset) {
      reset.addEventListener("click", () => {
        if (confirm("¿Borrar todos los lugares marcados como visitados?")) {
          state.visitados.clear();
          guardarVisitados();
          refrescarTodo();
        }
      });
    }
  }

  /* ---------- Panel de detalle ---------- */
  function abrirDetalle(id) {
    const l = state.lugares.find((x) => x.id === id);
    if (!l) return;
    state.seleccionado = id;

    const color = (state.tipos[l.tipo] && state.tipos[l.tipo].color) || "#2e7d32";
    const ev = l.evaluacion || {};

    const facts = [
      ["Región", l.region],
      ["Superficie", l.superficie_ha ? formatNum(l.superficie_ha) + " ha" : "–"],
      ["Altitud", l.altitud_m ? l.altitud_m + " m" : "–"],
      ["Creación", l.creado || "–"],
      ["Mejor época", ev.mejor_epoca || "–"],
      ["Acceso", ev.dificultad_acceso || "–"],
      ["Entrada", l.entrada_pagada ? "Pagada" : "Liberada"],
      ["Evaluación", ev.puntaje ? "★ " + ev.puntaje.toFixed(1) + " / 5" : "–"],
    ].filter((f) => f[1] && f[1] !== "–"); // oculta datos no aplicables

    const senderos = (l.senderos || [])
      .map((s) => {
        const dif = difClase(s.dificultad);
        return (
          '<div class="trail"><div class="trail__name">' +
          escapeHtml(s.nombre) +
          '</div><div class="trail__meta">' +
          '<span class="tag">📏 ' + escapeHtml(String(s.distancia_km)) + " km</span>" +
          '<span class="tag">⏱ ' + escapeHtml(s.duracion) + "</span>" +
          '<span class="tag ' + dif + '">⛰ ' + escapeHtml(s.dificultad) + "</span>" +
          '<span class="tag">' + escapeHtml(s.tipo) + "</span>" +
          "</div></div>"
        );
      })
      .join("");

    const pueblos = (l.pueblos_cercanos || [])
      .map((p) => {
        const badge = p.tours_disponibles
          ? '<span class="tours-badge">🚐 ~' + p.tours_estimados + " tours</span>"
          : '<span class="tours-badge tours-badge--none">Sin tours regulares</span>';
        return (
          '<div class="town"><div class="town__head">' +
          '<span class="town__name">📍 ' + escapeHtml(p.nombre) + "</span>" +
          '<span class="town__dist">' + escapeHtml(String(p.distancia_km)) + " km · " + escapeHtml(p.tiempo_estimado) + "</span>" +
          "</div>" +
          '<div class="town__desc">' + escapeHtml(p.descripcion || "") + "</div>" +
          '<div class="town__tours">' + badge + "</div></div>"
        );
      })
      .join("");

    const actividades = (l.actividades || [])
      .map((a) => '<span class="tag">' + escapeHtml(a) + "</span>")
      .join(" ");

    document.getElementById("detailContent").innerHTML =
      '<div class="detail__hero" style="background:linear-gradient(135deg,' +
      color +
      "," +
      shade(color) +
      ')">' +
      '<div class="detail__type">' +
      (state.tipos[l.tipo] ? state.tipos[l.tipo].etiqueta : "") +
      "</div>" +
      '<h2 class="detail__title">' + escapeHtml(l.nombre) + "</h2>" +
      '<div class="detail__region">📍 ' + escapeHtml(l.region) + "</div>" +
      '<button id="visitToggle" class="visit-toggle' +
      (esVisitado(l.id) ? " is-visited" : "") +
      '">' +
      (esVisitado(l.id) ? "✓ Visitado" : "+ Marcar como visitado") +
      "</button>" +
      "</div>" +
      '<div class="detail__body">' +
      '<p class="detail__desc">' + escapeHtml(l.descripcion) + "</p>" +
      '<div class="detail__facts">' +
      facts
        .map(
          (f) =>
            '<div class="fact"><div class="fact__label">' +
            f[0] +
            '</div><div class="fact__value">' +
            escapeHtml(String(f[1])) +
            "</div></div>"
        )
        .join("") +
      "</div>" +
      (actividades
        ? '<div class="section-title">🎒 Actividades</div><div class="trail__meta">' +
          actividades +
          "</div>"
        : "") +
      (senderos
        ? '<div class="section-title">🥾 Senderos (' +
          l.senderos.length +
          ")</div>" +
          senderos
        : "") +
      (pueblos
        ? '<div class="section-title">🏘️ Pueblos de acceso y tours</div>' + pueblos
        : "") +
      (l.sitio_web
        ? '<a class="detail__link" href="' +
          escapeAttr(l.sitio_web) +
          '" target="_blank" rel="noopener">Más información en CONAF →</a>'
        : "") +
      "</div>";

    const detail = document.getElementById("detail");
    detail.hidden = false;
    detail.scrollTop = 0;

    const vt = document.getElementById("visitToggle");
    if (vt) {
      vt.addEventListener("click", () => {
        toggleVisitado(l.id);
        const on = esVisitado(l.id);
        vt.classList.toggle("is-visited", on);
        vt.textContent = on ? "✓ Visitado" : "+ Marcar como visitado";
        refrescarTodo(); // actualiza tarjetas, marcadores y progreso
      });
    }

    render(); // refresca "active" en la lista
  }

  function cerrarDetalle() {
    document.getElementById("detail").hidden = true;
    state.seleccionado = null;
    render();
  }

  /* ---------- Utilidades ---------- */
  function normaliza(str) {
    return String(str)
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, ""); // quita tildes/diacríticos
  }

  function difClase(dif) {
    const d = (dif || "").toLowerCase();
    if (d.startsWith("baja")) return "tag--dif-baja";
    if (d.startsWith("alta")) return "tag--dif-alta";
    return "tag--dif-media";
  }

  function formatNum(n) {
    return n.toLocaleString("es-CL");
  }

  function shade(hex) {
    // oscurece ligeramente un color hex para el degradado
    const c = hex.replace("#", "");
    const num = parseInt(c, 16);
    let r = (num >> 16) - 25;
    let g = ((num >> 8) & 0x00ff) - 25;
    let b = (num & 0x0000ff) - 25;
    r = Math.max(0, r); g = Math.max(0, g); b = Math.max(0, b);
    return "rgb(" + r + "," + g + "," + b + ")";
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function escapeAttr(str) {
    return escapeHtml(str).replace(/'/g, "&#39;");
  }
})();
