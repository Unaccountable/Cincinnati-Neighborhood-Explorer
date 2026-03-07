import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, LayersControl, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet.heat'

// Fix Vite + Leaflet default icon paths
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

function makeDivIcon(emoji, bg) {
  return L.divIcon({
    html: `<div style="background:${bg};border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.45);border:2px solid rgba(255,255,255,0.7)">${emoji}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

const POI = {
  schools:     { emoji: '🏫', bg: '#2a8a2a' },
  hospitals:   { emoji: '🏥', bg: '#cc1111' },
  grocery:     { emoji: '🛒', bg: '#d97000' },
  parks:       { emoji: '🌳', bg: '#177017' },
  transit:     { emoji: '🚌', bg: '#7722cc' },
  fire:        { emoji: '🚒', bg: '#cc2200' },
  restaurants: { emoji: '🍽️', bg: '#b54400' },
}

// ── Layer manager (uses useMap hook) ──────────────────────────────────────────
function LayerManager({ activeLayers, layerData, flyTo, onLocationSelect }) {
  const map = useMap()
  const refs = useRef({})

  // FlyTo when search selects a result
  useEffect(() => {
    if (flyTo?.ts) {
      map.flyTo(flyTo.center, flyTo.zoom ?? 15, { duration: 1.2 })
    }
  }, [map, flyTo?.ts]) // eslint-disable-line

  // ── Crime heatmap ──────────────────────────────────────────────────────────
  useEffect(() => {
    const data = layerData.crime
    const on   = activeLayers.crime

    if (on && Array.isArray(data) && data.length > 0 && !refs.current.crime) {
      const pts = data.map((d) => [d.lat, d.lng, 0.6])
      refs.current.crime = L.heatLayer(pts, {
        radius: 18,
        blur: 14,
        maxZoom: 18,
        gradient: { 0.15: '#0000ff', 0.35: '#00ff00', 0.55: '#ffff00', 0.75: '#ff8000', 1.0: '#ff0000' },
      }).addTo(map)
    } else if (!on && refs.current.crime) {
      refs.current.crime.remove()
      delete refs.current.crime
    }
  }, [map, activeLayers.crime, layerData.crime])

  // ── FEMA Flood WMS ─────────────────────────────────────────────────────────
  useEffect(() => {
    const on = activeLayers.flood
    if (on && !refs.current.flood) {
      refs.current.flood = L.tileLayer.wms(
        'https://hazards.fema.gov/gis/nfhl/services/public/NFHL/MapServer/WMSServer',
        {
          layers: '28',
          format: 'image/png',
          transparent: true,
          opacity: 0.6,
          attribution: '<a href="https://msc.fema.gov" target="_blank">FEMA NFHL</a>',
        }
      ).addTo(map)
    } else if (!on && refs.current.flood) {
      refs.current.flood.remove()
      delete refs.current.flood
    }
  }, [map, activeLayers.flood])

  // ── POI marker layers ──────────────────────────────────────────────────────
  const poiIds = Object.keys(POI)

  poiIds.forEach((id) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const data = layerData[id]
      const on   = activeLayers[id]

      if (on && Array.isArray(data) && data.length > 0 && !refs.current[id]) {
        const cfg  = POI[id]
        const icon = makeDivIcon(cfg.emoji, cfg.bg)
        const grp  = L.layerGroup()

        data.forEach((item) => {
          if (!item.lat || !item.lng) return
          const m = L.marker([item.lat, item.lng], { icon })
          const addr = item.tags?.['addr:street']
            ? `<br><small style="color:#8a93ab">${item.tags['addr:street']}</small>`
            : ''
          m.bindPopup(
            `<b>${cfg.emoji} ${item.name}</b>${addr}`,
            { maxWidth: 200 }
          )
          grp.addLayer(m)
        })

        refs.current[id] = grp
        grp.addTo(map)
      } else if (!on && refs.current[id]) {
        refs.current[id].remove()
        delete refs.current[id]
      }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [map, activeLayers[id], layerData[id]])
  })

  // ── Click → reverse geocode + crime count ─────────────────────────────────
  useMapEvents({
    click: async (e) => {
      const { lat, lng } = e.latlng
      let info = { lat, lng }

      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16`,
          { headers: { 'Accept-Language': 'en' } }
        )
        const d = await res.json()
        info = {
          lat,
          lng,
          displayName: d.display_name,
          city: d.address?.city || d.address?.town || d.address?.suburb || d.address?.village || '',
          county: d.address?.county || '',
          postcode: d.address?.postcode || '',
          state: d.address?.state || '',
          neighbourhood: d.address?.neighbourhood || d.address?.quarter || '',
        }
      } catch (_) {}

      // Count crime incidents within ~0.3 mi radius
      const crime = layerData.crime
      if (Array.isArray(crime)) {
        const nearby = crime.filter((c) => {
          const dlat = c.lat - lat
          const dlng = c.lng - lng
          return dlat * dlat + dlng * dlng < 0.0025 * 0.0025 * 144 // ~0.3 mi
        })
        info.nearbyCrime = nearby.length
        info.nearbyRadius = '0.3 mi'
      }

      onLocationSelect(info)
    },
  })

  return null
}

// ── Main map component ────────────────────────────────────────────────────────
export default function MapView({ activeLayers, layerData, flyTo, onLocationSelect }) {
  return (
    <MapContainer
      center={[39.103, -84.512]}
      zoom={11}
      style={{ height: '100%', width: '100%' }}
      zoomControl
    >
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Street">
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            maxZoom={19}
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Satellite">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            attribution="Tiles &copy; Esri"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Terrain">
          <TileLayer
            url="https://tile.opentopomap.org/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
            maxZoom={17}
          />
        </LayersControl.BaseLayer>
      </LayersControl>

      <LayerManager
        activeLayers={activeLayers}
        layerData={layerData}
        flyTo={flyTo}
        onLocationSelect={onLocationSelect}
      />
    </MapContainer>
  )
}
