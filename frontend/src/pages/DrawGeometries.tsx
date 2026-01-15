import React, { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiClient } from '../api/client';
import { ChevronRight, X, MapPin } from 'lucide-react';

// Add animation styles
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateX(100px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .animate-slideIn {
    animation: slideIn 0.3s ease-out;
  }
`;
document.head.appendChild(styleSheet);

interface AoI {
  id: string;
  name: string;
  description?: string;
  geometry?: any;
}

interface Boundary {
  id: string;
  name: string;
  description?: string;
  is_legal: boolean;
  geometry?: any;
}

type DrawMode = 'none' | 'legal' | 'nogo';

// Fix leaflet marker icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export const DrawGeometriesPage: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layerGroup = useRef<L.LayerGroup>(new L.LayerGroup());
  
  const [aoiList, setAoiList] = useState<AoI[]>([]);
  const [selectedAoI, setSelectedAoI] = useState<string>('');
  const [selectedAoIData, setSelectedAoIData] = useState<AoI | null>(null);
  const [boundaries, setBoundaries] = useState<Boundary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Drawing state
  const [drawMode, setDrawMode] = useState<DrawMode>('none');
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]);
  const [polyline, setPolyline] = useState<L.Polyline | null>(null);
  const [drawName, setDrawName] = useState('');
  const [drawDescription, setDrawDescription] = useState('');
  const [isSubmittingBoundary, setIsSubmittingBoundary] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = L.map(mapContainer.current, {
        center: [36.206, -112.913],
        zoom: 12,
        zoomControl: true,
      });

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map.current);

      map.current.addLayer(layerGroup.current);

      return () => {
        if (map.current) {
          map.current.remove();
          map.current = null;
        }
      };
    } catch (err) {
      console.error('Map initialization error:', err);
    }
  }, []);

  // Fetch AOI list
  useEffect(() => {
    const fetchAoIs = async () => {
      try {
        const response = await apiClient.get('/aoi?skip=0&limit=100');
        setAoiList(response.data);
      } catch (err) {
        console.error('Failed to fetch AOIs:', err);
      }
    };
    fetchAoIs();
  }, []);

  // Helper function to convert GeoJSON to Leaflet LatLng array
  const convertGeoJSONToLatLng = (geojsonCoordinates: any[]): [number, number][] => {
    console.log('Converting GeoJSON coordinates:', geojsonCoordinates);
    
    // Handle Polygon coordinates: [[[lng, lat], [lng, lat], ...]]
    if (geojsonCoordinates && geojsonCoordinates.length > 0) {
      const firstRing = geojsonCoordinates[0];
      console.log('First ring:', firstRing);
      
      if (Array.isArray(firstRing) && firstRing.length > 0) {
        // Convert from GeoJSON [lng, lat] to Leaflet [lat, lng]
        const result = firstRing.map((coord: number[]) => {
          console.log('Converting coord:', coord, 'to [lat, lng]:', [coord[1], coord[0]]);
          return [coord[1], coord[0]] as [number, number];
        });
        console.log('Final converted coords:', result);
        return result;
      }
    }
    console.log('No coordinates found!');
    return [];
  };

  // Handle AOI selection
  const handleSelectAoI = async (aoiId: string) => {
    setSelectedAoI(aoiId);
    setLoading(true);

    try {
      // Fetch AOI details
      const aoiResponse = await apiClient.get(`/aoi/${aoiId}`);
      console.log('AOI Response:', aoiResponse.data);
      setSelectedAoIData(aoiResponse.data);

      // Fetch boundaries for this AOI
      const boundariesResponse = await apiClient.get(`/boundaries/${aoiId}`);
      console.log('Boundaries Response:', boundariesResponse.data);
      setBoundaries(boundariesResponse.data || []);

      // Clear and redraw map
      if (layerGroup.current) {
        layerGroup.current.clearLayers();
      }

      // Draw AOI boundary
      if (aoiResponse.data.geometry && aoiResponse.data.geometry.coordinates) {
        console.log('=== Drawing AOI ===');
        console.log('AOI Geometry:', aoiResponse.data.geometry);
        const coords = convertGeoJSONToLatLng(aoiResponse.data.geometry.coordinates);
        console.log('Converted AOI coords:', coords);
        
        if (coords.length >= 3) {
          console.log('Creating polygon with', coords.length, 'points');
          const polygon = L.polygon(coords, {
            color: '#3b82f6',
            weight: 3,
            opacity: 0.8,
            fillColor: '#3b82f6',
            fillOpacity: 0.2,
          })
            .bindPopup(`<strong>${aoiResponse.data.name}</strong><br/>${aoiResponse.data.description || ''}`)
            .addTo(layerGroup.current);

          console.log('Polygon created:', polygon);
          
          // Fit map to AOI bounds
          const bounds = L.latLngBounds(coords);
          console.log('Bounds:', bounds);
          if (map.current) {
            map.current.fitBounds(bounds, { padding: [50, 50] });
          }
        } else {
          console.log('Not enough coordinates for polygon:', coords.length);
        }
      } else {
        console.log('No geometry in AOI response:', aoiResponse.data);
      }

      // Draw Legal Boundaries
      if (Array.isArray(boundariesResponse.data)) {
        console.log('=== Drawing Legal Boundaries ===');
        console.log('All boundaries:', boundariesResponse.data);
        
        boundariesResponse.data
          .filter((b: Boundary) => b.is_legal)
          .forEach((boundary: Boundary) => {
            console.log('Legal boundary:', boundary);
            if (boundary.geometry && boundary.geometry.coordinates) {
              const coords = convertGeoJSONToLatLng(boundary.geometry.coordinates);
              console.log('Converted legal boundary coords:', coords);
              
              if (coords.length >= 3) {
                L.polygon(coords, {
                  color: '#10b981',
                  weight: 2,
                  opacity: 0.8,
                  fillColor: '#10b981',
                  fillOpacity: 0.2,
                })
                  .bindPopup(`<strong>${boundary.name}</strong><br/><span style="color:green">✓ Legal Boundary</span>`)
                  .addTo(layerGroup.current);
              }
            } else {
              console.log('Legal boundary has no geometry:', boundary);
            }
          });

        // Draw No-Go Zones
        console.log('=== Drawing No-Go Zones ===');
        boundariesResponse.data
          .filter((b: Boundary) => !b.is_legal)
          .forEach((boundary: Boundary) => {
            console.log('No-go zone:', boundary);
            if (boundary.geometry && boundary.geometry.coordinates) {
              const coords = convertGeoJSONToLatLng(boundary.geometry.coordinates);
              console.log('Converted no-go coords:', coords);
              
              if (coords.length >= 3) {
                L.polygon(coords, {
                  color: '#ef4444',
                  weight: 2,
                  opacity: 0.8,
                  fillColor: '#ef4444',
                  fillOpacity: 0.2,
                })
                  .bindPopup(`<strong>${boundary.name}</strong><br/><span style="color:red">✗ No-Go Zone</span>`)
                  .addTo(layerGroup.current);
              }
            } else {
              console.log('No-go zone has no geometry:', boundary);
            }
          });
      } else {
        console.log('Boundaries response is not an array:', boundariesResponse.data);
      }
    } catch (err) {
      console.error('Failed to fetch AOI data:', err);
      setError(`Failed to load AOI: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Start drawing mode
  const startDrawing = (mode: DrawMode) => {
    if (!selectedAoI) {
      setError('Please select an AOI first');
      return;
    }
    setDrawMode(mode);
    setDrawPoints([]);
    setDrawName('');
    setDrawDescription('');
    if (polyline) {
      map.current?.removeLayer(polyline);
      setPolyline(null);
    }
  };

  // Handle map click for drawing
  useEffect(() => {
    if (drawMode === 'none' || !map.current) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      const newPoints = [...drawPoints, [lat, lng] as [number, number]];
      setDrawPoints(newPoints);

      // Update polyline
      if (polyline) {
        map.current?.removeLayer(polyline);
      }

      if (newPoints.length > 1) {
        const newPolyline = L.polyline(newPoints, {
          color: drawMode === 'legal' ? '#10b981' : '#ef4444',
          weight: 2,
          opacity: 0.8,
        }).addTo(map.current!);
        setPolyline(newPolyline);
      }

      // Add marker
      L.circleMarker([lat, lng], {
        radius: 6,
        fillColor: drawMode === 'legal' ? '#10b981' : '#ef4444',
        color: '#fff',
        weight: 2,
        opacity: 1,
        fillOpacity: 0.8,
      })
        .bindPopup(`Point ${newPoints.length}`)
        .addTo(layerGroup.current);
    };

    map.current?.on('click', handleMapClick);
    return () => {
      map.current?.off('click', handleMapClick);
    };
  }, [drawMode, drawPoints, polyline]);

  // Finish drawing and submit boundary
  const finishDrawing = async () => {
    if (drawPoints.length < 3) {
      setError('Need at least 3 points to create a polygon');
      return;
    }

    if (!drawName.trim()) {
      setError('Please enter a name for this boundary');
      return;
    }

    setIsSubmittingBoundary(true);
    try {
      // Close the polygon by adding first point at end if not already there
      const closedPoints = [...drawPoints];
      if (closedPoints[0] !== closedPoints[closedPoints.length - 1]) {
        closedPoints.push(closedPoints[0]);
      }

      // Convert [lat, lng] to GeoJSON [lng, lat]
      const geojsonCoords = closedPoints.map(([lat, lng]) => [lng, lat]);

      const payload = {
        aoi_id: selectedAoI,
        name: drawName,
        description: drawDescription,
        is_legal: drawMode === 'legal',
        geometry: {
          type: 'Polygon',
          coordinates: [geojsonCoords],
        },
      };

      await apiClient.post('/boundaries', payload);

      // Refresh boundaries
      const boundariesResponse = await apiClient.get(`/boundaries/${selectedAoI}`);
      setBoundaries(boundariesResponse.data || []);

      // Redraw map
      layerGroup.current.clearLayers();
      if (selectedAoIData?.geometry) {
        const coords = convertGeoJSONToLatLng(selectedAoIData.geometry.coordinates);
        L.polygon(coords, {
          color: '#3b82f6',
          weight: 3,
          opacity: 0.8,
          fillColor: '#3b82f6',
          fillOpacity: 0.2,
        }).addTo(layerGroup.current);
      }

      boundariesResponse.data?.forEach((boundary: Boundary) => {
        if (boundary.geometry?.coordinates) {
          const coords = convertGeoJSONToLatLng(boundary.geometry.coordinates);
          if (coords.length >= 3) {
            L.polygon(coords, {
              color: boundary.is_legal ? '#10b981' : '#ef4444',
              weight: 2,
              opacity: 0.8,
              fillColor: boundary.is_legal ? '#10b981' : '#ef4444',
              fillOpacity: 0.2,
            })
              .bindPopup(`<strong>${boundary.name}</strong><br/>${boundary.is_legal ? '✓ Legal' : '✗ No-Go'}`)
              .addTo(layerGroup.current);
          }
        }
      });

      // Reset drawing
      setDrawMode('none');
      setDrawPoints([]);
      setDrawName('');
      setDrawDescription('');
      if (polyline) {
        map.current?.removeLayer(polyline);
        setPolyline(null);
      }

      setError(null);
    } catch (err) {
      setError(`Failed to create boundary: ${err}`);
    } finally {
      setIsSubmittingBoundary(false);
    }
  };

  // Cancel drawing
  const cancelDrawing = () => {
    setDrawMode('none');
    setDrawPoints([]);
    setDrawName('');
    setDrawDescription('');
    if (polyline) {
      map.current?.removeLayer(polyline);
      setPolyline(null);
    }
    layerGroup.current.clearLayers();
    
    // Redraw boundaries
    if (selectedAoIData?.geometry) {
      const coords = convertGeoJSONToLatLng(selectedAoIData.geometry.coordinates);
      L.polygon(coords, {
        color: '#3b82f6',
        weight: 3,
        opacity: 0.8,
        fillColor: '#3b82f6',
        fillOpacity: 0.2,
      }).addTo(layerGroup.current);
    }

    boundaries.forEach((boundary) => {
      if (boundary.geometry?.coordinates) {
        const coords = convertGeoJSONToLatLng(boundary.geometry.coordinates);
        if (coords.length >= 3) {
          L.polygon(coords, {
            color: boundary.is_legal ? '#10b981' : '#ef4444',
            weight: 2,
            opacity: 0.8,
            fillColor: boundary.is_legal ? '#10b981' : '#ef4444',
            fillOpacity: 0.2,
          }).addTo(layerGroup.current);
        }
      }
    });
  };

  return (
    <div className="d-flex flex-column" style={{ height: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Header */}
      <div className="bg-primary border-bottom p-4 shadow-sm">
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <h1 className="h3 fw-bold text-white d-flex align-items-center gap-3 mb-0">
              <span style={{fontSize: '2.5rem'}}>📍</span>
              Geometry Manager
            </h1>
            <p className="text-light mt-2 mb-0">Create and manage Areas of Interest, Legal Boundaries, and No-Go Zones</p>
          </div>
          <div className="text-light small">
            <p className="mb-1">Total AOIs: <span className="fw-bold text-white">{aoiList.length}</span></p>
            <p className="mb-0">Total Boundaries: <span className="fw-bold text-white">{boundaries.length}</span></p>
          </div>
        </div>
      </div>

      <div className="d-flex flex-1 gap-3 p-3" style={{overflow: 'hidden'}}>
        {/* Sidebar - AOI List and Tools */}
        <div style={{width: '320px'}} className="bg-white rounded shadow-sm overflow-y-auto d-flex flex-column border">
          {/* Create Buttons */}
          <div className="p-4 border-bottom bg-light sticky-top" style={{top: 0, zIndex: 10}}>
            <h2 className="h5 fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <span style={{fontSize: '1.25rem'}}>⚡</span>
              Create New
            </h2>
            
            <a
              href="/draw-aoi"
              className="d-flex align-items-center justify-content-between w-100 px-3 py-2 bg-light border border-primary rounded text-decoration-none"
              style={{backgroundColor: '#e7f1ff'}}
            >
              <span className="d-flex align-items-center gap-2">
                <span style={{fontSize: '1.5rem'}}>➕</span>
                <div>
                  <p className="fw-bold text-dark mb-0">New AOI</p>
                  <p className="small text-secondary mb-0">Area of Interest</p>
                </div>
              </span>
              <ChevronRight size={20} className="text-primary" />
            </a>

            <button
              onClick={() => startDrawing('legal')}
              disabled={drawMode !== 'none' || !selectedAoI}
              className={`d-flex align-items-center justify-content-between w-100 px-3 py-2 rounded border mt-3 ${drawMode === 'legal' ? 'border-success' : 'border-success'}`}
              style={drawMode === 'legal' ? {backgroundColor: '#d1e7dd', opacity: 1} : {backgroundColor: '#f0fdf4', opacity: !selectedAoI && drawMode === 'none' ? 0.5 : 1}}
            >
              <span className="d-flex align-items-center gap-2">
                <span style={{fontSize: '1.5rem'}}>⚖️</span>
                <div>
                  <p className="fw-bold text-dark mb-0">Legal Boundary</p>
                  <p className="small text-secondary mb-0">{drawMode === 'legal' ? '🎯 Click map to draw...' : 'Mine boundary'}</p>
                </div>
              </span>
              <MapPin size={20} className={`${drawMode === 'legal' ? 'text-green-700 animate-bounce' : 'text-green-600'} group-hover:translate-x-1 transition-transform`} />
            </button>

            <button
              onClick={() => startDrawing('nogo')}
              disabled={drawMode !== 'none' || !selectedAoI}
              className={`d-flex align-items-center justify-content-between w-100 px-3 py-2 rounded border mt-3 ${drawMode === 'nogo' ? 'border-danger' : 'border-danger'}`}
              style={drawMode === 'nogo' ? {backgroundColor: '#f8d7da', opacity: 1} : {backgroundColor: '#ffe5e5', opacity: !selectedAoI && drawMode === 'none' ? 0.5 : 1}}
            >
              <span className="d-flex align-items-center gap-2">
                <span style={{fontSize: '1.5rem'}}>🚫</span>
                <div>
                  <p className="fw-bold text-dark mb-0">No-Go Zone</p>
                  <p className="small text-secondary mb-0">{drawMode === 'nogo' ? '🎯 Click map to draw...' : 'Restricted area'}</p>
                </div>
              </span>
              <MapPin size={20} className={`text-danger`} />
            </button>
          </div>

          {/* AOI List */}
          <div className="flex-1 p-4 overflow-y-auto">
            <h2 className="h5 fw-bold text-dark mb-3 d-flex align-items-center gap-2">
              <span style={{fontSize: '1.25rem'}}>📌</span>
              Areas of Interest
            </h2>
            
            {error && (
              <div className="mb-4 p-3 bg-danger bg-opacity-10 border border-danger rounded text-danger small">
                <p className="fw-semibold mb-0">⚠️ {error}</p>
              </div>
            )}
            
            {aoiList.length === 0 ? (
              <div className="text-center py-5">
                <p style={{fontSize: '3rem'}} className="mb-2">📭</p>
                <p className="small fw-medium text-secondary">No AOIs created yet.</p>
                <p className="small text-secondary opacity-75 mt-2">Create one to get started!</p>
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {aoiList.map((aoi) => (
                  <button
                    key={aoi.id}
                    onClick={() => {
                      setError(null);
                      handleSelectAoI(aoi.id);
                    }}
                    className={`w-100 text-start px-3 py-2 rounded border transition-all duration-200 ${
                      selectedAoI === aoi.id
                        ? 'border-primary bg-light'
                        : 'border-light bg-white'
                    }`}
                    disabled={loading}
                  >
                    <p className="fw-bold text-dark d-flex align-items-center gap-2 mb-0">
                      {selectedAoI === aoi.id && <span className="text-primary">✓</span>}
                      {aoi.name}
                    </p>
                    <p className="small text-secondary mt-1 mb-0">📝 {aoi.description || 'No description'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected AOI Info */}
          {selectedAoIData && (
            <div className="p-4 border-top bg-light">
              <h3 className="fw-bold text-dark mb-3 d-flex align-items-center gap-2">
                <span style={{fontSize: '1.25rem'}}>ℹ️</span>
                Selected AOI
              </h3>
              <div className="d-flex flex-column gap-2">
                <div className="bg-white p-3 rounded border border-primary">
                  <p className="small text-primary fw-semibold text-uppercase mb-1">Name</p>
                  <p className="fw-bold text-dark mt-1 mb-0">{selectedAoIData.name}</p>
                </div>
                <div className="bg-white p-3 rounded border border-primary">
                  <p className="small text-primary fw-semibold text-uppercase mb-2">Boundaries</p>
                  <div className="d-flex gap-2 mt-1">
                    {boundaries.length > 0 ? (
                      <>
                        <span className="badge bg-success">⚖️ {boundaries.filter(b => b.is_legal).length}</span>
                        <span className="badge bg-danger">🚫 {boundaries.filter(b => !b.is_legal).length}</span>
                      </>
                    ) : (
                      <span className="small text-secondary">None yet</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Map Container */}
        <div className="flex-grow-1 rounded shadow-sm bg-white d-flex flex-column border" style={{minWidth: 0}}>
          <div 
            ref={mapContainer} 
            className="flex-grow-1 w-100"
            style={{ height: 0, flexBasis: 'auto' }}
          >
            {loading && (
              <div className="position-absolute top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center" style={{backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 50}}>
                <div className="bg-white p-5 rounded shadow-lg text-center">
                  <div style={{fontSize: '2.5rem'}} className="mb-3">🌍</div>
                  <p className="text-dark fw-bold h6">Loading AOI...</p>
                  <p className="small text-secondary mt-2">Fetching geometry data...</p>
                </div>
              </div>
            )}
            {!selectedAoI && (
              <div className="position-absolute top-0 start-0 end-0 bottom-0 d-flex align-items-center justify-content-center bg-light">
                <div className="text-center">
                  <p style={{fontSize: '4rem'}} className="mb-3">🗺️</p>
                  <p className="text-secondary fw-semibold">Select an AOI from the list</p>
                  <p className="small text-secondary mt-2">to view its boundaries on the map</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Map Legend */}
          <div className="bg-light border-top p-3 shadow-sm">
            <div className="d-flex gap-3">
              <div className="d-flex align-items-center gap-2 px-2 py-1 bg-light border border-primary rounded">
                <div style={{width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#0d6efd'}}></div>
                <span className="small fw-semibold text-dark">AOI</span>
              </div>
              <div className="d-flex align-items-center gap-2 px-2 py-1 bg-light border border-success rounded">
                <div style={{width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#198754'}}></div>
                <span className="small fw-semibold text-dark">Legal</span>
              </div>
              <div className="d-flex align-items-center gap-2 px-2 py-1 bg-light border border-danger rounded">
                <div style={{width: '16px', height: '16px', borderRadius: '50%', backgroundColor: '#dc3545'}}></div>
                <span className="small fw-semibold text-dark">No-Go</span>
              </div>
            </div>
          </div>
        </div>

        {/* Drawing Form - Positioned outside map container */}
        {drawMode !== 'none' && (
          <div className="position-fixed bg-white rounded shadow-lg p-4 border" style={{top: '100px', right: '20px', width: '360px', maxHeight: '90vh', overflowY: 'auto', zIndex: 1050}}>
            <div className="d-flex align-items-center justify-content-between mb-4">
              <h3 className="fw-bold text-dark h5 d-flex align-items-center gap-2 mb-0">
                {drawMode === 'legal' ? '⚖️ Legal Boundary' : '🚫 No-Go Zone'}
              </h3>
              <button
                onClick={cancelDrawing}
                className="btn btn-light btn-sm"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>
            
            <div className={`rounded p-3 mb-4 small border-start border-5 ${
              drawMode === 'legal' 
                ? 'bg-light text-success border-success' 
                : 'bg-light text-danger border-danger'
            }`}>
              <p className="fw-bold d-flex align-items-center gap-2 mb-0">
                <span>📍</span>
                Points: {drawPoints.length}/3+
              </p>
              <p className="small mt-2 mb-0 opacity-75">Click the map to add points</p>
            </div>
            
            <div className="mb-4">
              <label className="form-label small fw-bold">
                Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={drawName}
                onChange={(e) => setDrawName(e.target.value)}
                placeholder="e.g., Zone A, Mining Area"
                className="form-control form-control-sm"
              />
            </div>
            <div className="mb-4">
              <label className="form-label small fw-bold">Description</label>
              <textarea
                value={drawDescription}
                onChange={(e) => setDrawDescription(e.target.value)}
                placeholder="Optional details..."
                rows={2}
                className="form-control form-control-sm"
              />
            </div>
            
            <div className="d-flex gap-2">
              <button
                onClick={finishDrawing}
                disabled={isSubmittingBoundary || drawPoints.length < 3 || !drawName.trim()}
                className="btn btn-primary flex-1 btn-sm"
              >
                {isSubmittingBoundary ? '⏳ Saving...' : '✓ Save'}
              </button>
              <button
                onClick={cancelDrawing}
                className="btn btn-secondary flex-1 btn-sm"
              >
                ✕ Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DrawGeometriesPage;
