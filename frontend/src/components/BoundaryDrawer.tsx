import React, { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiClient } from '../api/client';
import { Trash2, Plus } from 'lucide-react';

interface DrawnBoundary {
  aoi_id: string;
  name: string;
  description: string;
  coordinates: number[][][] | null;
}

interface BoundaryDrawerProps {
  type: 'legal' | 'nogo';
}

// Fix leaflet marker icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export const BoundaryDrawer: React.FC<BoundaryDrawerProps> = ({ type }) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const polyline = useRef<L.Polyline | null>(null);
  const polygon = useRef<L.Polygon | null>(null);
  const markers = useRef<L.CircleMarker[]>([]);
  
  const [aoiList, setAoiList] = useState<any[]>([]);
  const [drawnBoundary, setDrawnBoundary] = useState<DrawnBoundary>({
    aoi_id: '',
    name: '',
    description: '',
    coordinates: null,
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  const title = type === 'legal' ? '⚖️ Draw Legal Mine Boundary' : '🚫 Draw No-Go Zone';
  const buttonColor = type === 'legal' ? '#2563eb' : '#ef4444';
  const markerColor = type === 'legal' ? '#2563eb' : '#ef4444';
  const borderColor = type === 'legal' ? '#1e40af' : '#b91c1c';

  // Fetch AOI list
  useEffect(() => {
    const fetchAoIs = async () => {
      try {
        const response = await apiClient.get('/aoi?skip=0&limit=100');
        setAoiList(response.data);
      } catch (err) {
        console.error('Failed to fetch AOIs:', err);
        setMessage({ type: 'error', text: 'Failed to fetch AOIs' });
      }
    };
    fetchAoIs();
  }, []);

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

  // Handle map clicks
  useEffect(() => {
    if (!map.current || !isDrawing) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      const latlng = e.latlng;
      const newPoints = [...points, latlng];
      setPoints(newPoints);

      markers.current.forEach(m => m.remove());
      markers.current = [];
      if (polyline.current) polyline.current.remove();

      newPoints.forEach((point, index) => {
        const marker = L.circleMarker(point, {
          radius: 6,
          fillColor: markerColor,
          color: borderColor,
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        }).addTo(map.current!);

        const label = L.tooltip({ permanent: true, direction: 'top' })
          .setContent((index + 1).toString())
          .setLatLng(point);
        marker.bindTooltip(label);

        markers.current.push(marker);
      });

      if (newPoints.length > 1) {
        polyline.current = L.polyline(newPoints, {
          color: markerColor,
          weight: 2,
          opacity: 0.7,
        }).addTo(map.current!);
      }
    };

    map.current.on('click', handleMapClick);

    return () => {
      if (map.current) {
        map.current.off('click', handleMapClick);
      }
    };
  }, [isDrawing, points, markerColor, borderColor]);

  const finishDrawing = () => {
    if (points.length < 3) {
      setMessage({ type: 'error', text: 'You need at least 3 points to form a polygon' });
      return;
    }

    const closedPoints = [...points, points[0]];
    const coords = closedPoints.map(p => [p.lng, p.lat]);

    if (polyline.current) polyline.current.remove();
    if (polygon.current) polygon.current.remove();

    polygon.current = L.polygon(closedPoints, {
      color: markerColor,
      weight: 2,
      opacity: 0.8,
      fillColor: markerColor,
      fillOpacity: 0.2,
    }).addTo(map.current!);

    setDrawnBoundary((prev) => ({ ...prev, coordinates: [coords] }));
    setIsDrawing(false);
    setMessage({ type: 'success', text: `✓ Boundary complete! ${points.length} vertices` });
  };

  const clearDrawing = () => {
    setPoints([]);
    setDrawnBoundary({ ...drawnBoundary, coordinates: null });
    
    markers.current.forEach(m => m.remove());
    markers.current = [];
    if (polyline.current) polyline.current.remove();
    if (polygon.current) polygon.current.remove();
    
    setIsDrawing(false);
    setMessage(null);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDrawnBoundary((prev) => ({ ...prev, name: e.target.value }));
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDrawnBoundary((prev) => ({ ...prev, description: e.target.value }));
  };

  const handleAoiChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setDrawnBoundary((prev) => ({ ...prev, aoi_id: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!drawnBoundary.aoi_id) {
      setMessage({ type: 'error', text: 'Please select an AOI' });
      return;
    }

    if (!drawnBoundary.name.trim()) {
      setMessage({ type: 'error', text: 'Please enter a boundary name' });
      return;
    }

    if (!drawnBoundary.coordinates || drawnBoundary.coordinates[0].length < 4) {
      setMessage({ type: 'error', text: 'Please draw a polygon with at least 3 points' });
      return;
    }

    setLoading(true);
    setMessage(null);
    
    try {
      const payload = {
        aoi_id: drawnBoundary.aoi_id,
        name: drawnBoundary.name,
        description: drawnBoundary.description || undefined,
        geometry: {
          type: 'Polygon',
          coordinates: drawnBoundary.coordinates,
        },
        is_legal: type === 'legal',
      };

      const response = await apiClient.post('/boundaries', payload);
      setMessage({ type: 'success', text: `✓ ${type === 'legal' ? 'Legal boundary' : 'No-go zone'} "${response.data.name}" created!` });
      
      clearDrawing();
      setDrawnBoundary({ aoi_id: '', name: '', description: '', coordinates: null });
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to create boundary';
      setMessage({ type: 'error', text: errorMsg });
      console.error('Boundary creation error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex flex-column h-100 bg-light" style={{height: '100vh'}}>
      {/* Header */}
      <div className="bg-white border-bottom border-gray-300 p-3 shadow-sm">
        <h1 className="h3 fw-bold text-dark mb-0">{title}</h1>
        <p className="text-secondary mt-2 mb-0 small">
          {!isDrawing ? 'Click the "Start Drawing" button to begin' : 'Click on the map to add points. Press "Finish" when done.'}
        </p>
      </div>

      <div className="d-flex flex-1 gap-3 p-3 overflow-hidden" style={{flex: 1}}>
        {/* Map Container */}
        <div className="d-flex flex-column rounded overflow-hidden shadow-sm bg-white border border-gray-300 flex-1" style={{flex: 1}}>
          <div 
            ref={mapContainer} 
            className="flex-1 w-100 bg-secondary"
            style={{ minHeight: '400px', flex: 1 }}
          />
          
          {/* Map Controls */}
          <div className="bg-white border-top border-gray-300 p-3 d-flex gap-2">
            {!isDrawing ? (
              <button
                type="button"
                onClick={() => {
                  clearDrawing();
                  setIsDrawing(true);
                  setMessage(null);
                }}
                className="btn d-flex align-items-center gap-2"
                style={{ backgroundColor: buttonColor, color: 'white' }}
              >
                <Plus size={18} />
                Start Drawing
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={finishDrawing}
                  disabled={points.length < 3}
                  className="btn btn-success d-flex align-items-center gap-2"
                >
                  ✓ Finish ({points.length} points)
                </button>
                <button
                  type="button"
                  onClick={() => setIsDrawing(false)}
                  className="btn btn-secondary d-flex align-items-center gap-2"
                >
                  Cancel
                </button>
              </>
            )}
            
            {drawnBoundary.coordinates && (
              <button
                type="button"
                onClick={clearDrawing}
                className="btn btn-danger d-flex align-items-center gap-2 ms-auto"
              >
                <Trash2 size={18} />
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Form Sidebar */}
        <div className="bg-white rounded shadow-sm p-4 overflow-y-auto d-flex flex-column border border-gray-300" style={{width: '320px'}}>
          <form onSubmit={handleSubmit} className="d-flex flex-column" style={{gap: '1.5rem'}}>
            {/* Messages */}
            {message && (
              <div
                className={`p-3 rounded text-sm fw-medium border ${
                  message.type === 'success'
                    ? 'bg-light text-success border-success'
                    : 'bg-light text-danger border-danger'
                }`}
              >
                {message.text}
              </div>
            )}

            {/* Status */}
            {isDrawing && (
              <div className="bg-light border border-primary rounded p-3">
                <p className="small text-primary fw-medium mb-0">
                  🎯 Drawing mode: Click map to add {points.length === 0 ? 'points' : `${3 - points.length} more point${3 - points.length === 1 ? '' : 's'}`}
                </p>
              </div>
            )}

            {/* Boundary Info */}
            {drawnBoundary.coordinates && (
              <div className="bg-light border border-success rounded p-3">
                <p className="small text-success fw-medium mb-0">
                  ✓ Boundary drawn with {drawnBoundary.coordinates[0].length - 1} vertices
                </p>
              </div>
            )}

            {/* AOI Selection */}
            <div>
              <label className="form-label small fw-medium text-dark">
                Select AOI <span className="text-danger">*</span>
              </label>
              <select
                value={drawnBoundary.aoi_id}
                onChange={handleAoiChange}
                className="form-select form-select-sm"
                required
              >
                <option value="">-- Choose an AOI --</option>
                {aoiList.map((aoi) => (
                  <option key={aoi.id} value={aoi.id}>
                    {aoi.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Name Field */}
            <div>
              <label className="form-label small fw-medium text-dark">
                Boundary Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={drawnBoundary.name}
                onChange={handleNameChange}
                placeholder={`e.g., ${type === 'legal' ? 'North Legal Area' : 'Restricted Zone A'}`}
                className="form-control form-control-sm"
                required
              />
            </div>

            {/* Description Field */}
            <div>
              <label className="form-label small fw-medium text-dark">
                Description
              </label>
              <textarea
                value={drawnBoundary.description}
                onChange={handleDescriptionChange}
                placeholder={`e.g., ${type === 'legal' ? 'Licensed mining area' : 'Environmentally sensitive region'}`}
                rows={4}
                className="form-control form-control-sm"
              />
            </div>

            {/* Instructions */}
            <div className="bg-light border border-warning rounded p-3">
              <p className="small fw-semibold text-warning mb-2">📍 Steps:</p>
              <ol className="small text-warning ps-4 mb-0">
                <li><strong>1.</strong> Select an AOI</li>
                <li><strong>2.</strong> Click "Start Drawing"</li>
                <li><strong>3.</strong> Click map to add points</li>
                <li><strong>4.</strong> Need ≥3 points</li>
                <li><strong>5.</strong> Click "Finish" to complete</li>
              </ol>
            </div>

            <div style={{flex: 1}}></div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !drawnBoundary.coordinates || !drawnBoundary.aoi_id}
              className="w-100 btn btn-primary fw-semibold"
            >
              {loading ? '⏳ Creating...' : '✓ Create Boundary'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
