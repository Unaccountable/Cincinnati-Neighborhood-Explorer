export default function Sidebar({ layers, activeLayers, loadingLayers, layerData, onToggle, selectedLocation }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-scroll">

        {/* ── Layer toggles ── */}
        <div className="sidebar-section">
          <div className="section-title">Map Layers</div>
          <div className="layer-list">
            {layers.map((layer) => {
              const on      = activeLayers[layer.id]
              const loading = loadingLayers[layer.id]
              const d       = layerData[layer.id]
              const count   = Array.isArray(d) ? d.length : null
              const err     = d?.error

              return (
                <div
                  key={layer.id}
                  className={`layer-item${on ? ' active' : ''}`}
                  onClick={() => onToggle(layer.id)}
                >
                  <div className={`layer-toggle${on ? ' on' : ''}`} />
                  <div className="layer-icon">{layer.icon}</div>
                  <div className="layer-text">
                    <div className="layer-label">{layer.label}</div>
                    <div className="layer-desc">{layer.description}</div>
                    {loading && <div className="layer-badge loading">Loading…</div>}
                    {err     && <div className="layer-badge error">⚠ {err}</div>}
                    {count !== null && !loading && (
                      <div className="layer-badge ok">{count.toLocaleString()} features loaded</div>
                    )}
                    {layer.id === 'flood' && on && (
                      <div className="layer-badge ok">FEMA WMS active</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Selected location info ── */}
        <div className={`sidebar-section info-section`}>
          <div className="section-title">📍 Location Info</div>
          {selectedLocation ? (
            <div className="location-grid">
              {selectedLocation.neighbourhood && (
                <div className="loc-row">
                  <span className="loc-key">Neighborhood</span>
                  <span className="loc-val">{selectedLocation.neighbourhood}</span>
                </div>
              )}
              {selectedLocation.city && (
                <div className="loc-row">
                  <span className="loc-key">City / Area</span>
                  <span className="loc-val">{selectedLocation.city}</span>
                </div>
              )}
              {selectedLocation.county && (
                <div className="loc-row">
                  <span className="loc-key">County</span>
                  <span className="loc-val">{selectedLocation.county}</span>
                </div>
              )}
              {selectedLocation.postcode && (
                <div className="loc-row">
                  <span className="loc-key">ZIP Code</span>
                  <span className="loc-val">{selectedLocation.postcode}</span>
                </div>
              )}
              {selectedLocation.nearbyCrime !== undefined && (
                <div className="loc-row">
                  <span className="loc-key">Crime ({selectedLocation.nearbyRadius})</span>
                  <span
                    className={`loc-val ${
                      selectedLocation.nearbyCrime === 0
                        ? 'risk-low'
                        : selectedLocation.nearbyCrime < 6
                        ? 'risk-low'
                        : selectedLocation.nearbyCrime < 20
                        ? 'risk-med'
                        : 'risk-high'
                    }`}
                  >
                    {selectedLocation.nearbyCrime} incidents
                  </span>
                </div>
              )}
              <div className="loc-row">
                <span className="loc-key">Coordinates</span>
                <span className="loc-val" style={{ fontSize: 10 }}>
                  {selectedLocation.lat.toFixed(5)}, {selectedLocation.lng.toFixed(5)}
                </span>
              </div>
              {selectedLocation.displayName && (
                <div className="loc-address">{selectedLocation.displayName}</div>
              )}
            </div>
          ) : (
            <p className="click-hint">Click anywhere on the map</p>
          )}
        </div>

        {/* ── Crime legend ── */}
        <div className="sidebar-section">
          <div className="section-title">Crime Heatmap Legend</div>
          <div className="legend-list">
            {[
              { color: '#0000ff', label: 'Very low density' },
              { color: '#00cc00', label: 'Low density' },
              { color: '#ffff00', label: 'Moderate density' },
              { color: '#ff8000', label: 'High density' },
              { color: '#ff0000', label: 'Very high density' },
            ].map((item) => (
              <div key={item.label} className="legend-item">
                <div className="legend-dot" style={{ background: item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Flood legend ── */}
        <div className="sidebar-section">
          <div className="section-title">Flood Zone Legend</div>
          <div className="legend-list">
            {[
              { color: '#4488ff', label: 'Zone A / AE — 100-yr flood (high risk)' },
              { color: '#aabbff', label: 'Zone X (shaded) — 500-yr flood (moderate)' },
              { color: '#dddddd', label: 'Zone X — minimal flood hazard' },
            ].map((item) => (
              <div key={item.label} className="legend-item">
                <div className="legend-dot" style={{ background: item.color }} />
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Tips ── */}
        <div className="sidebar-section">
          <div className="section-title">Tips</div>
          <ul className="tips-list">
            <li>Click the map to see location details including nearby crime count</li>
            <li>Use the layer control (top-right of map) to switch base maps</li>
            <li>Crime data is from Cincinnati PD (Hamilton County only)</li>
            <li>Flood layer uses live FEMA NFHL data — blue = high risk</li>
            <li>Search an address or neighborhood to jump to it</li>
            <li>POI layers load on demand — toggle to fetch</li>
          </ul>
        </div>

        {/* ── Data sources ── */}
        <div className="sidebar-section">
          <div className="section-title">Data Sources</div>
          <ul className="tips-list">
            <li>Crime: Cincinnati Open Data (Socrata)</li>
            <li>Flood: FEMA National Flood Hazard Layer</li>
            <li>POIs: OpenStreetMap / Overpass API</li>
            <li>Geocoding: Nominatim / OSM</li>
            <li>Basemaps: OSM, Esri, OpenTopoMap</li>
          </ul>
        </div>

      </div>
    </aside>
  )
}
