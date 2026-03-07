import { useState, useEffect, useCallback, useRef } from 'react'
import MapView from './components/Map'
import Sidebar from './components/Sidebar'
import './App.css'

export const LAYERS_CONFIG = [
  {
    id: 'crime',
    label: 'Crime Heatmap',
    icon: '🚨',
    color: '#ff4d4d',
    defaultOn: true,
    description: 'Crime incident density — Cincinnati PD open data',
  },
  {
    id: 'flood',
    label: 'FEMA Flood Zones',
    icon: '🌊',
    color: '#4488ff',
    defaultOn: false,
    description: '100-year flood risk zones (FEMA NFHL)',
  },
  {
    id: 'schools',
    label: 'Schools',
    icon: '🏫',
    color: '#44bb44',
    defaultOn: false,
    description: 'Public & private K-12 schools',
  },
  {
    id: 'hospitals',
    label: 'Hospitals & Medical',
    icon: '🏥',
    color: '#ff3333',
    defaultOn: false,
    description: 'Hospitals, clinics, urgent care',
  },
  {
    id: 'grocery',
    label: 'Grocery Stores',
    icon: '🛒',
    color: '#ff8c00',
    defaultOn: false,
    description: 'Supermarkets and grocery stores',
  },
  {
    id: 'parks',
    label: 'Parks & Green Space',
    icon: '🌳',
    color: '#22aa22',
    defaultOn: false,
    description: 'Parks, nature areas, recreation',
  },
  {
    id: 'transit',
    label: 'Public Transit Stops',
    icon: '🚌',
    color: '#9944dd',
    defaultOn: false,
    description: 'Bus stops (SORTA / TANK)',
  },
  {
    id: 'fire',
    label: 'Fire Stations',
    icon: '🚒',
    color: '#cc3300',
    defaultOn: false,
    description: 'Fire stations (response time proxy)',
  },
  {
    id: 'restaurants',
    label: 'Restaurants & Dining',
    icon: '🍽️',
    color: '#e05c00',
    defaultOn: false,
    description: 'Restaurants, cafes, and bars',
  },
]

const BBOX = '38.88,-84.85,39.35,-84.10'

async function fetchCrimeData() {
  const url =
    'https://data.cincinnati-oh.gov/resource/k59e-2pvf.json' +
    '?$limit=5000' +
    '&$where=latitude_x IS NOT NULL AND longitude_x IS NOT NULL' +
    '&$select=latitude_x,longitude_x,offense,date_reported' +
    '&$order=date_reported DESC'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return json
    .filter((d) => d.latitude_x && d.longitude_x)
    .map((d) => ({
      lat: parseFloat(d.latitude_x),
      lng: parseFloat(d.longitude_x),
      offense: d.offense,
    }))
}

async function fetchOverpassData(layerId) {
  const queries = {
    schools: `[out:json][timeout:25];(node["amenity"="school"](${BBOX});way["amenity"="school"](${BBOX}););out center;`,
    hospitals: `[out:json][timeout:25];(node["amenity"~"hospital|clinic|doctors|pharmacy"](${BBOX});way["amenity"~"hospital|clinic|doctors"](${BBOX}););out center;`,
    grocery: `[out:json][timeout:25];(node["shop"~"supermarket|grocery"](${BBOX});way["shop"~"supermarket|grocery"](${BBOX}););out center;`,
    parks: `[out:json][timeout:25];(node["leisure"="park"](${BBOX});way["leisure"="park"](${BBOX});relation["leisure"="park"](${BBOX}););out center;`,
    transit: `[out:json][timeout:25];node["highway"="bus_stop"](${BBOX});out;`,
    fire: `[out:json][timeout:25];(node["amenity"="fire_station"](${BBOX});way["amenity"="fire_station"](${BBOX}););out center;`,
    restaurants: `[out:json][timeout:25];(node["amenity"~"restaurant|cafe|bar|fast_food"](${BBOX}););out;`,
  }
  const q = queries[layerId]
  if (!q) return []
  const url = `https://overpass-api.de/api/interpreter?data=${encodeURIComponent(q)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  return json.elements
    .map((el) => ({
      lat: el.lat ?? el.center?.lat,
      lng: el.lon ?? el.center?.lon,
      name: el.tags?.name || el.tags?.['name:en'] || layerId,
      tags: el.tags ?? {},
    }))
    .filter((d) => d.lat && d.lng)
}

export default function App() {
  const [activeLayers, setActiveLayers] = useState(() => {
    const init = {}
    LAYERS_CONFIG.forEach((l) => (init[l.id] = l.defaultOn))
    return init
  })
  const [layerData, setLayerData] = useState({})
  const [loadingLayers, setLoadingLayers] = useState({})
  const [flyTo, setFlyTo] = useState(null)
  const [selectedLocation, setSelectedLocation] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const fetchedRef = useRef(new Set())

  const loadLayer = useCallback(
    async (layerId) => {
      if (fetchedRef.current.has(layerId) || layerId === 'flood') return
      fetchedRef.current.add(layerId)
      setLoadingLayers((p) => ({ ...p, [layerId]: true }))
      try {
        let data
        if (layerId === 'crime') {
          data = await fetchCrimeData()
        } else {
          data = await fetchOverpassData(layerId)
        }
        setLayerData((p) => ({ ...p, [layerId]: data }))
      } catch (err) {
        fetchedRef.current.delete(layerId) // allow retry
        setLayerData((p) => ({ ...p, [layerId]: { error: err.message } }))
      } finally {
        setLoadingLayers((p) => ({ ...p, [layerId]: false }))
      }
    },
    []
  )

  const toggleLayer = useCallback(
    (layerId) => {
      setActiveLayers((prev) => {
        const next = { ...prev, [layerId]: !prev[layerId] }
        if (next[layerId]) loadLayer(layerId)
        return next
      })
    },
    [loadLayer]
  )

  // Auto-load default-on layers
  useEffect(() => {
    LAYERS_CONFIG.forEach((l) => {
      if (l.defaultOn) loadLayer(l.id)
    })
  }, []) // eslint-disable-line

  const handleSearchChange = useCallback(async (q) => {
    setSearchQuery(q)
    if (!q.trim()) {
      setSearchResults([])
      return
    }
    try {
      const url =
        `https://nominatim.openstreetmap.org/search?format=json&limit=6` +
        `&q=${encodeURIComponent(q + ' Cincinnati Ohio')}` +
        `&countrycodes=us&accept-language=en`
      const res = await fetch(url)
      const results = await res.json()
      setSearchResults(results)
    } catch (_) {
      setSearchResults([])
    }
  }, [])

  const handleResultClick = useCallback((result) => {
    setFlyTo({ center: [parseFloat(result.lat), parseFloat(result.lon)], zoom: 15, ts: Date.now() })
    setSearchQuery('')
    setSearchResults([])
  }, [])

  return (
    <div className="app">
      <header className="app-header">
        <h1>🏠 Cincinnati / NKY House Location Assistant</h1>
        <div className="search-wrap">
          <input
            className="search-input"
            type="text"
            placeholder="Search address or neighborhood..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && setSearchResults([])}
          />
          {searchResults.length > 0 && (
            <ul className="search-dropdown">
              {searchResults.map((r, i) => (
                <li key={i} onMouseDown={() => handleResultClick(r)}>
                  {r.display_name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <div className="app-body">
        <Sidebar
          layers={LAYERS_CONFIG}
          activeLayers={activeLayers}
          loadingLayers={loadingLayers}
          layerData={layerData}
          onToggle={toggleLayer}
          selectedLocation={selectedLocation}
        />
        <div className="map-wrap">
          <MapView
            activeLayers={activeLayers}
            layerData={layerData}
            flyTo={flyTo}
            onLocationSelect={setSelectedLocation}
          />
        </div>
      </div>
    </div>
  )
}
