// ==UserScript==
// @name         Cincinnati / NKY Map Overlay
// @namespace    https://github.com/Unaccountable/Cincinnati-Neighborhood-Explorer
// @version      1.3
// @description  Overlays the Cincinnati/NKY House Location Assistant on top of Zillow's map. Requires local server running at http://localhost:5173
// @author       Cincinnati Neighborhood Explorer
// @match        https://www.zillow.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

;(function () {
  'use strict'

  const MAP_URL = 'http://localhost:5173/map.html'
  let googleMap = null
  let _receivingLeafletSync = false
  let iframeReady = false

  // Layer config — mirrors LAYERS_CONFIG in map.html
  const LAYERS = [
    { id: 'crime',            label: 'Crime Heatmap',    on: true  },
    { id: 'flood',            label: 'Flood Zones',      on: false },
    { id: 'schools',          label: 'Schools',          on: false },
    { id: 'hospitals',        label: 'Hospitals',        on: false },
    { id: 'grocery',          label: 'Grocery Stores',   on: false },
    { id: 'parks',            label: 'Parks',            on: false },
    { id: 'transit',          label: 'Transit Stops',    on: false },
    { id: 'fire',             label: 'Fire Stations',    on: false },
    { id: 'restaurants',      label: 'Restaurants',      on: false },
    { id: 'neighborhoods',    label: 'Neighborhoods',    on: false },
    { id: 'income',           label: 'Income & Value',   on: false },
    { id: 'zoning',           label: 'Zoning',           on: false },
    { id: 'school-districts', label: 'School Districts', on: false },
    { id: 'police-districts', label: 'Police Districts', on: false },
    { id: 'historic',         label: 'Historic',         on: false },
  ]

  // ── Phase 1 (document-start): intercept google.maps.Map ───────────────────
  function wrapGoogleMaps (maps) {
    if (!maps || !maps.Map || maps._cincyWrapped) return
    maps._cincyWrapped = true
    const Orig = maps.Map
    function PatchedMap (...args) {
      const inst = new Orig(...args)
      googleMap = inst
      return inst
    }
    PatchedMap.prototype = Orig.prototype
    Object.setPrototypeOf(PatchedMap, Orig)
    maps.Map = PatchedMap
  }

  let _google
  try {
    Object.defineProperty(window, 'google', {
      configurable: true,
      get: () => _google,
      set: (v) => {
        _google = v
        if (v?.maps?.Map) {
          wrapGoogleMaps(v.maps)
        } else if (v?.maps) {
          let _maps = v.maps
          try {
            Object.defineProperty(v, 'maps', {
              configurable: true,
              get: () => _maps,
              set: (m) => { _maps = m; if (m?.Map) wrapGoogleMaps(m) },
            })
          } catch (_) {}
        }
      },
    })
  } catch (_) {
    if (window.google?.maps?.Map) wrapGoogleMaps(window.google.maps)
  }

  // ── Phase 2 (DOM ready) ────────────────────────────────────────────────────
  function domReady (fn) {
    if (document.readyState !== 'loading') fn()
    else document.addEventListener('DOMContentLoaded', fn)
  }

  // instanceof scan — works if the instance is a window global
  function findGoogleMapByInstanceOf () {
    const Map = window.google?.maps?.Map
    if (!Map) return null
    for (const key of Object.keys(window)) {
      try { if (window[key] instanceof Map) return window[key] } catch (_) {}
    }
    return null
  }

  // Prototype patch — most reliable method when the instance is in a closure.
  // Wraps getCenter() on the prototype; Google Maps calls it during every render,
  // so `this` will be the live map instance the next time the map moves or renders.
  let _protoPatchApplied = false
  function applyPrototypePatch (onFound) {
    const Map = window.google?.maps?.Map
    if (!Map || _protoPatchApplied) return
    _protoPatchApplied = true
    const orig = Map.prototype.getCenter
    Map.prototype.getCenter = function (...args) {
      // Restore immediately so we don't interfere with normal operation
      Map.prototype.getCenter = orig
      onFound(this)
      return orig.apply(this, args)
    }
  }

  // Duck-type DOM scan including non-enumerable properties
  function findGoogleMapByDOM () {
    const container = document.querySelector('.gm-style')
    if (!container) return null
    let el = container
    while (el && el !== document.documentElement) {
      try {
        const keys = [
          ...Object.keys(el),
          ...Object.getOwnPropertyNames(el).filter(k => !Object.keys(el).includes(k))
        ]
        for (const k of keys) {
          try {
            const v = el[k]
            if (v && typeof v === 'object' &&
                typeof v.getCenter === 'function' &&
                typeof v.setCenter === 'function' &&
                typeof v.getZoom   === 'function') return v
          } catch (_) {}
        }
      } catch (_) {}
      el = el.parentElement
    }
    return null
  }

  domReady(() => {
    // ── Styles ───────────────────────────────────────────────────────────────
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
        min-width: 180px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 4px 24px rgba(0,0,0,0.6);
        border: 1px solid rgba(255,255,255,0.08);
        user-select: none;
      }
      #cincy-controls::-webkit-scrollbar { width: 4px; }
      #cincy-controls::-webkit-scrollbar-thumb { background: #2e3345; border-radius: 2px; }
      .cincy-title { font-weight: 700; font-size: 13px; color: #fff; display: flex; align-items: center; gap: 6px; }
      #cincy-controls label { display: flex; align-items: center; gap: 8px; cursor: pointer; color: #b0b8cc; }
      #cincy-controls label:hover { color: #fff; }
      #cincy-controls input[type=range] { width: 100%; accent-color: #3d8fe0; cursor: pointer; }
      #cincy-status { font-size: 11px; color: #545f78; margin-top: -2px; }
      .cincy-section { display: flex; flex-direction: column; gap: 4px; }
      .cincy-label-sm { font-size: 11px; color: #545f78; margin-bottom: 1px; }
      .cincy-divider { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 2px 0; }
      .cincy-layers-header { display: flex; align-items: center; justify-content: space-between; cursor: pointer; color: #b0b8cc; font-size: 12px; font-weight: 600; }
      .cincy-layers-header:hover { color: #fff; }
      .cincy-layers-list { display: flex; flex-direction: column; gap: 5px; margin-top: 2px; }
      .cincy-layer-row { display: flex; align-items: center; gap: 8px; cursor: pointer; color: #b0b8cc; font-size: 12px; padding: 2px 0; }
      .cincy-layer-row:hover { color: #fff; }
      .cincy-toggle { width: 28px; height: 16px; border-radius: 8px; background: #2e3345; position: relative; flex-shrink: 0; transition: background 0.2s; }
      .cincy-toggle.on { background: #3d8fe0; }
      .cincy-toggle::after { content: ''; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; border-radius: 50%; background: #fff; transition: transform 0.2s; }
      .cincy-toggle.on::after { transform: translateX(12px); }
    `
    document.head.appendChild(style)

    // ── iframe ───────────────────────────────────────────────────────────────
    const iframe = document.createElement('iframe')
    iframe.id = 'cincy-iframe'
    iframe.src = MAP_URL
    iframe.addEventListener('load', () => { iframeReady = true })
    document.body.appendChild(iframe)

    // ── Controls panel ───────────────────────────────────────────────────────
    const layerStates = {}
    LAYERS.forEach(l => { layerStates[l.id] = l.on })

    const controls = document.createElement('div')
    controls.id = 'cincy-controls'
    controls.innerHTML = `
      <div class="cincy-title">🗺 Cincy Overlay</div>
      <label><input type="checkbox" id="cincy-toggle" checked> Show overlay</label>
      <div class="cincy-section">
        <div class="cincy-label-sm">Opacity</div>
        <input type="range" id="cincy-opacity" min="10" max="90" value="55">
      </div>
      <label><input type="checkbox" id="cincy-interact"> Enable clicks (drag to align)</label>
      <hr class="cincy-divider">
      <div class="cincy-layers-header" id="cincy-layers-header">Layers <span id="cincy-layers-arrow">▾</span></div>
      <div class="cincy-layers-list" id="cincy-layers-list"></div>
      <hr class="cincy-divider">
      <div id="cincy-status">Searching for map…</div>
    `
    document.body.appendChild(controls)

    // Build layer rows
    const layerList = document.getElementById('cincy-layers-list')
    LAYERS.forEach(layer => {
      const row = document.createElement('div')
      row.className = 'cincy-layer-row'
      row.innerHTML = `<div class="cincy-toggle${layer.on ? ' on' : ''}" id="cincy-t-${layer.id}"></div><span>${layer.label}</span>`
      row.addEventListener('click', () => {
        layerStates[layer.id] = !layerStates[layer.id]
        document.getElementById(`cincy-t-${layer.id}`).classList.toggle('on', layerStates[layer.id])
        sendToIframe({ type: 'toggleLayer', layerId: layer.id })
      })
      layerList.appendChild(row)
    })

    // Collapse/expand layers
    let layersOpen = true
    document.getElementById('cincy-layers-header').addEventListener('click', () => {
      layersOpen = !layersOpen
      document.getElementById('cincy-layers-list').style.display = layersOpen ? 'flex' : 'none'
      document.getElementById('cincy-layers-arrow').textContent = layersOpen ? '▾' : '▸'
    })

    // ── Control wiring ───────────────────────────────────────────────────────
    document.getElementById('cincy-toggle').addEventListener('change', (e) => {
      iframe.style.display = e.target.checked ? 'block' : 'none'
    })
    document.getElementById('cincy-opacity').addEventListener('input', (e) => {
      iframe.style.opacity = e.target.value / 100
    })
    // Enable clicks: lets you drag/interact with the overlay to manually align maps.
    // Uncheck to go back to clicking Zillow listings.
    document.getElementById('cincy-interact').addEventListener('change', (e) => {
      iframe.style.pointerEvents = e.target.checked ? 'all' : 'none'
    })

    // ── postMessage helper — waits for iframe to be ready ────────────────────
    function sendToIframe (msg) {
      if (iframeReady) {
        iframe.contentWindow?.postMessage(msg, '*')
      } else {
        iframe.addEventListener('load', () => {
          iframe.contentWindow?.postMessage(msg, '*')
        }, { once: true })
      }
    }

    // ── Viewport sync ────────────────────────────────────────────────────────
    function syncViewport (gMap) {
      const c = gMap.getCenter()
      const z = gMap.getZoom()
      // Google Maps and Leaflet both use 256px tiles — zoom levels match directly
      sendToIframe({ type: 'syncViewport', lat: c.lat(), lng: c.lng(), zoom: z })
    }

    // Overlay → Zillow: user dragged the Leaflet map, move Zillow to match
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'leafletMoved' && googleMap) {
        _receivingLeafletSync = true
        googleMap.setCenter({ lat: e.data.lat, lng: e.data.lng })
        googleMap.setZoom(e.data.zoom)
        setTimeout(() => { _receivingLeafletSync = false }, 150)
      }
    })

    function attachSync (gMap) {
      googleMap = gMap
      const status = document.getElementById('cincy-status')
      status.textContent = 'Map synced ✓'
      status.style.color = '#3dbb3d'

      // rAF polling — reads Google Maps position every frame (~60fps) and
      // forwards to Leaflet only when it actually changed. Much smoother
      // than event-based sync which fires after movement ends.
      let lastLat = null, lastLng = null, lastZoom = null
      function rafSync () {
        if (!_receivingLeafletSync) {
          try {
            const c   = gMap.getCenter()
            const z   = gMap.getZoom()
            const lat = c.lat(), lng = c.lng()
            if (lat !== lastLat || lng !== lastLng || z !== lastZoom) {
              lastLat = lat; lastLng = lng; lastZoom = z
              sendToIframe({ type: 'syncViewport', lat, lng, zoom: z })
            }
          } catch (_) {}
        }
        requestAnimationFrame(rafSync)
      }
      requestAnimationFrame(rafSync)
      syncViewport(gMap) // initial sync
    }

    // Poll for the map instance using all available methods
    let attempts = 0
    const poll = setInterval(() => {
      attempts++

      // 1. Constructor intercept may have already set googleMap
      // 2. instanceof scan (works if stored as window global)
      // 3. DOM duck-type scan (includes non-enumerable props)
      const found = googleMap || findGoogleMapByInstanceOf() || findGoogleMapByDOM()
      if (found) {
        clearInterval(poll)
        attachSync(found)
        return
      }

      // 4. Prototype patch — fires the next time ANY map method is called.
      //    Apply once google.maps.Map is available; the map will call getCenter
      //    on its own within milliseconds during normal rendering.
      applyPrototypePatch((inst) => {
        clearInterval(poll)
        attachSync(inst)
      })

      if (attempts >= 60) {
        clearInterval(poll)
        const status = document.getElementById('cincy-status')
        status.textContent = 'Map not found — try reloading'
        status.style.color = '#f04040'
      }
    }, 500)
  })

})()
