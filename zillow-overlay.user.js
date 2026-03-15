// ==UserScript==
// @name         Cincinnati / NKY Map Overlay
// @namespace    https://github.com/Unaccountable/Cincinnati-Neighborhood-Explorer
// @version      1.1
// @description  Overlays the Cincinnati/NKY House Location Assistant on top of Zillow's map. Requires local server running at http://localhost:5173
// @author       Cincinnati Neighborhood Explorer
// @match        https://www.zillow.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

;(function () {
  'use strict'

  const MAP_URL = 'http://localhost:5173/map.html'
  let mapboxMap = null
  let _receivingLeafletSync = false

  // ── Phase 1 (document-start): intercept mapboxgl.Map constructor ───────────
  // Runs before Zillow's JS so we can wrap Map() and capture every instance.

  function isMapLike (v) {
    return v != null &&
      typeof v === 'object' &&
      typeof v.getCenter === 'function' &&
      typeof v.jumpTo   === 'function' &&
      typeof v.on       === 'function'
  }

  function wrapMapboxGL (mgl) {
    if (!mgl || !mgl.Map || mgl._cincyWrapped) return
    mgl._cincyWrapped = true
    const Orig = mgl.Map
    function PatchedMap (...args) {
      const inst = new Orig(...args)
      mapboxMap = inst
      return inst
    }
    PatchedMap.prototype = Orig.prototype
    Object.setPrototypeOf(PatchedMap, Orig)
    mgl.Map = PatchedMap
  }

  // Intercept when window.mapboxgl is first assigned
  let _mgl
  try {
    Object.defineProperty(window, 'mapboxgl', {
      configurable: true,
      get: () => _mgl,
      set: (v) => { _mgl = v; wrapMapboxGL(v) },
    })
  } catch (_) {
    // Already defined — wrap whatever is there now, poll for changes
    if (window.mapboxgl) wrapMapboxGL(window.mapboxgl)
  }

  // ── Phase 2 (DOM ready): UI + fallback map detection ──────────────────────
  function domReady (fn) {
    if (document.readyState !== 'loading') fn()
    else document.addEventListener('DOMContentLoaded', fn)
  }

  // Duck-type scan: walk DOM ancestors + window globals looking for a Mapbox map.
  // This catches cases where Zillow bundles Mapbox without exposing window.mapboxgl.
  function findMapboxMapByDOM () {
    const canvas = document.querySelector('.mapboxgl-canvas')
    if (!canvas) return null

    const knownKeys = ['_map', '__mapboxgl__', '_mapboxgl', 'map', '_mapboxMap', '__map__']
    let el = canvas.parentElement
    while (el && el !== document.documentElement) {
      for (const k of knownKeys) {
        try { if (isMapLike(el[k])) return el[k] } catch (_) {}
      }
      // Brute-force all enumerable own properties
      try {
        for (const k of Object.keys(el)) {
          try { if (isMapLike(el[k])) return el[k] } catch (_) {}
        }
      } catch (_) {}
      el = el.parentElement
    }

    // Last resort: scan window globals
    try {
      for (const k of Object.keys(window)) {
        try { if (isMapLike(window[k])) return window[k] } catch (_) {}
      }
    } catch (_) {}

    return null
  }

  domReady(() => {
    // ── Inject styles ────────────────────────────────────────────────────────
    const style = document.createElement('style')
    style.textContent = `
      #cincy-iframe {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        border: none;
        opacity: 0.55;
        pointer-events: none;
        z-index: 500;
        transition: opacity 0.2s;
      }
      #cincy-controls {
        position: fixed;
        top: 72px;
        right: 16px;
        background: rgba(15, 17, 23, 0.92);
        color: #dde2ee;
        padding: 12px 14px;
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
        font-size: 13px;
        z-index: 10000;
        display: flex;
        flex-direction: column;
        gap: 9px;
        min-width: 170px;
        box-shadow: 0 4px 24px rgba(0,0,0,0.6);
        border: 1px solid rgba(255,255,255,0.08);
        user-select: none;
      }
      #cincy-controls .cincy-title {
        font-weight: 700;
        font-size: 13px;
        color: #fff;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      #cincy-controls label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        color: #b0b8cc;
      }
      #cincy-controls label:hover { color: #fff; }
      #cincy-controls input[type=range] {
        width: 100%;
        accent-color: #3d8fe0;
        cursor: pointer;
      }
      #cincy-status {
        font-size: 11px;
        color: #545f78;
        margin-top: -2px;
      }
      #cincy-controls .cincy-section {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      #cincy-controls .cincy-label-sm {
        font-size: 11px;
        color: #545f78;
        margin-bottom: 1px;
      }
    `
    document.head.appendChild(style)

    // ── iframe ───────────────────────────────────────────────────────────────
    const iframe = document.createElement('iframe')
    iframe.id = 'cincy-iframe'
    iframe.src = MAP_URL
    document.body.appendChild(iframe)

    // ── Controls panel ───────────────────────────────────────────────────────
    const controls = document.createElement('div')
    controls.id = 'cincy-controls'
    controls.innerHTML = `
      <div class="cincy-title">🗺 Cincy Overlay</div>
      <label>
        <input type="checkbox" id="cincy-toggle" checked>
        Show overlay
      </label>
      <div class="cincy-section">
        <div class="cincy-label-sm">Opacity</div>
        <input type="range" id="cincy-opacity" min="10" max="90" value="55">
      </div>
      <label>
        <input type="checkbox" id="cincy-interact">
        Enable clicks
      </label>
      <div id="cincy-status">Searching for map…</div>
    `
    document.body.appendChild(controls)

    // ── Control wiring ───────────────────────────────────────────────────────
    document.getElementById('cincy-toggle').addEventListener('change', (e) => {
      iframe.style.display = e.target.checked ? 'block' : 'none'
    })
    document.getElementById('cincy-opacity').addEventListener('input', (e) => {
      iframe.style.opacity = e.target.value / 100
    })
    // "Enable clicks" lets you interact with the overlay (pan, toggle layers).
    // Uncheck to click Zillow listings again.
    document.getElementById('cincy-interact').addEventListener('change', (e) => {
      iframe.style.pointerEvents = e.target.checked ? 'all' : 'none'
    })

    // ── Viewport sync ────────────────────────────────────────────────────────
    function syncViewport (mbMap) {
      const c = mbMap.getCenter()
      const z = mbMap.getZoom()
      // Mapbox GL uses 512px tiles; Leaflet uses 256px → add 1 zoom level
      iframe.contentWindow?.postMessage(
        { type: 'syncViewport', lat: c.lat, lng: c.lng, zoom: z + 1 },
        '*'
      )
    }

    // Overlay → Zillow: user panned the Leaflet map, move Zillow to match
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'leafletMoved' && mapboxMap) {
        _receivingLeafletSync = true
        mapboxMap.jumpTo({ center: [e.data.lng, e.data.lat], zoom: e.data.zoom })
        // Mapbox fires 'move' async; clear the flag after animation frame settles
        setTimeout(() => { _receivingLeafletSync = false }, 150)
      }
    })

    function attachSync (mbMap) {
      mapboxMap = mbMap
      const status = document.getElementById('cincy-status')
      status.textContent = 'Map synced ✓'
      status.style.color = '#3dbb3d'

      // Zillow → overlay (skip if we triggered the move)
      const onMove = () => { if (!_receivingLeafletSync) syncViewport(mbMap) }
      mbMap.on('move', onMove)
      mbMap.on('zoomend', onMove)
      syncViewport(mbMap)
    }

    // Poll: give constructor interception time to work, then fall back to DOM scan
    let attempts = 0
    const poll = setInterval(() => {
      attempts++
      const found = mapboxMap || findMapboxMapByDOM()
      if (found) {
        clearInterval(poll)
        attachSync(found)
      } else if (attempts >= 60) {
        clearInterval(poll)
        const status = document.getElementById('cincy-status')
        status.textContent = 'Map not found — try reloading'
        status.style.color = '#f04040'
      }
    }, 500)
  })

})()
