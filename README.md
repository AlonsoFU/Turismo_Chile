# 🇨🇱 Turismo Chile — Mapa interactivo de Parques Nacionales y Reservas

Aplicación web que muestra en un **mapa interactivo** los parques nacionales y reservas naturales de Chile, con información práctica para planificar un viaje:

- 🥾 **Senderos** de cada área: distancia, duración, dificultad y tipo (ida y vuelta / circuito / travesía).
- ⭐ **Evaluación** (puntaje), mejor época para visitar y dificultad de acceso.
- 🏘️ **Pueblos cercanos** (puertas de entrada): distancia, tiempo estimado de viaje y **cantidad estimada de tours** disponibles desde cada pueblo.
- 🎒 Actividades, superficie, altitud, año de creación y enlace a CONAF.

Incluye el **Sistema Nacional de Áreas Silvestres Protegidas (SNASPE) completo**: **92 áreas protegidas** — **47 parques nacionales** (los 46 oficiales de CONAF + Cabo Froward, el más reciente) y las **45 reservas nacionales** —, de Arica a Cabo de Hornos, más Rapa Nui, Juan Fernández y los grandes parques de la Patagonia (Kawésqar, Torres del Paine, Bernardo O'Higgins, etc.).

## 🚀 Cómo ejecutarlo

El proyecto es **100% estático** (HTML + CSS + JavaScript, sin dependencias que instalar). Como carga los datos con `fetch()`, necesita un servidor local (no basta con abrir el archivo directamente).

```bash
# Opción 1: Python (viene preinstalado en Mac/Linux)
python3 -m http.server 8000

# Opción 2: Node
npx serve .
```

Luego abre <http://localhost:8000> en tu navegador.

> El mapa usa tiles de OpenStreetMap y la librería Leaflet desde CDN, por lo que la primera carga requiere conexión a internet.

## 🗂️ Estructura

```
Turismo_Chile/
├── index.html          # Página principal (mapa + panel)
├── css/styles.css      # Estilos
├── js/app.js           # Lógica del mapa, filtros y panel de detalle
├── data/lugares.json   # 📊 Base de datos de áreas protegidas
└── README.md
```

## ➕ Cómo agregar un nuevo lugar

Todo vive en `data/lugares.json`. Agrega un objeto al arreglo `lugares` con este formato:

```json
{
  "id": "identificador-unico",
  "nombre": "Parque Nacional Ejemplo",
  "tipo": "parque_nacional",            // o "reserva_nacional", "monumento_natural"
  "region": "Los Lagos",
  "coordenadas": [-41.13, -72.41],       // [latitud, longitud]
  "superficie_ha": 12345,
  "creado": 1990,
  "altitud_m": "50-2000",
  "descripcion": "Texto descriptivo…",
  "evaluacion": {
    "puntaje": 4.7,
    "fuente": "Reseñas de visitantes",
    "mejor_epoca": "Diciembre a Marzo",
    "dificultad_acceso": "Media"
  },
  "senderos": [
    { "nombre": "Sendero X", "distancia_km": 8, "duracion": "3 h", "dificultad": "Media", "tipo": "Ida y vuelta" }
  ],
  "actividades": ["Trekking", "Camping"],
  "pueblos_cercanos": [
    {
      "nombre": "Pueblo Cercano",
      "distancia_km": 30,
      "tiempo_estimado": "40 min en auto",
      "tours_disponibles": true,
      "tours_estimados": 6,
      "descripcion": "Puerta de entrada principal."
    }
  ],
  "entrada_pagada": true,
  "sitio_web": "https://www.conaf.cl/..."
}
```

Guarda y recarga la página: el marcador, la ficha y el buscador se generan automáticamente.

## ✨ Funcionalidades

- Buscador por nombre, región, descripción o pueblo (insensible a tildes).
- Filtros por tipo de área (parque / reserva) con leyenda de colores.
- Panel lateral con ficha completa al hacer clic en un marcador o en la lista.
- Diseño responsive (móvil y escritorio).

## ⚠️ Sobre los datos

Los datos son de **elaboración propia** a partir de información pública de CONAF y guías de viaje. Coordenadas, distancias, tiempos y cantidad de tours son **aproximados y referenciales**; verifica siempre en fuentes oficiales antes de viajar (estado de senderos, tarifas y accesos cambian por temporada).

## 🛣️ Próximos pasos posibles

- Sumar los 19 monumentos naturales del SNASPE (El Morado, Los Pingüinos, La Portada, Contulmo, Salar de Surire…).
- Capas de rutas y curvas de nivel.
- Fichas de tours reales con operadores y precios.
- Geolocalización del usuario y cálculo de ruta al parque.
