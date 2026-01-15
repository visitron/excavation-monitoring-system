import React, { useState, useRef, useEffect } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { apiClient } from '../api/client';
import { Trash2, Plus } from 'lucide-react';

interface DrawnPolygon {
  name: string;
  description: string;
  coordinates: number[][][] | null;
}

// Fix leaflet marker icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

export const AOIDrawer: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const [points, setPoints] = useState<L.LatLng[]>([]);
  const polyline = useRef<L.Polyline | null>(null);
  const polygon = useRef<L.Polygon | null>(null);
  const markers = useRef<L.CircleMarker[]>([]);
  
  const [drawnPolygon, setDrawnPolygon] = useState<DrawnPolygon>({
    name: '',
    description: '',
    coordinates: null,
  });
  
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Initialize map (only once)
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      // Create map
      map.current = L.map(mapContainer.current, {
        center: [36.206, -112.913],
        zoom: 12,
        zoomControl: true,
      });

      // Add OSM tiles
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

  // Handle map clicks (updates when isDrawing changes)
  useEffect(() => {
    if (!map.current || !isDrawing) return;

    const handleMapClick = (e: L.LeafletMouseEvent) => {
      console.log('Map clicked', e.latlng);
      
      const latlng = e.latlng;
      const newPoints = [...points, latlng];
      setPoints(newPoints);

      // Clear previous markers and lines
      markers.current.forEach(m => m.remove());
      markers.current = [];
      if (polyline.current) polyline.current.remove();

      // Draw markers
      newPoints.forEach((point, index) => {
        const marker = L.circleMarker(point, {
          radius: 6,
          fillColor: '#2563eb',
          color: '#1e40af',
          weight: 2,
          opacity: 1,
          fillOpacity: 0.8,
        }).addTo(map.current!);

        // Add label
        const label = L.tooltip({ permanent: true, direction: 'top' })
          .setContent((index + 1).toString())
          .setLatLng(point);
        marker.bindTooltip(label);

        markers.current.push(marker);
      });

      // Draw polyline
      if (newPoints.length > 1) {
        polyline.current = L.polyline(newPoints, {
          color: '#2563eb',
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
  }, [isDrawing, points]);

  const finishDrawing = () => {
    if (points.length < 3) {
      setMessage({ type: 'error', text: 'You need at least 3 points to form a polygon' });
      return;
    }

    // Create closed polygon
    const closedPoints = [...points, points[0]];
    const coords = closedPoints.map(p => [p.lng, p.lat]);

    // Clear polyline and show polygon
    if (polyline.current) polyline.current.remove();
    if (polygon.current) polygon.current.remove();

    polygon.current = L.polygon(closedPoints, {
      color: '#2563eb',
      weight: 2,
      opacity: 0.8,
      fillColor: '#3b82f6',
      fillOpacity: 0.2,
    }).addTo(map.current!);

    setDrawnPolygon((prev) => ({ ...prev, coordinates: [coords] }));
    setIsDrawing(false);
    setMessage({ type: 'success', text: `✓ Polygon complete! ${points.length} vertices` });
  };

  const clearDrawing = () => {
    setPoints([]);
    setDrawnPolygon({ ...drawnPolygon, coordinates: null });
    
    // Clear map
    markers.current.forEach(m => m.remove());
    markers.current = [];
    if (polyline.current) polyline.current.remove();
    if (polygon.current) polygon.current.remove();
    
    setIsDrawing(false);
    setMessage(null);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDrawnPolygon((prev) => ({ ...prev, name: e.target.value }));
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDrawnPolygon((prev) => ({ ...prev, description: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!drawnPolygon.name.trim()) {
      setMessage({ type: 'error', text: 'Please enter an AOI name' });
      return;
    }

    if (!drawnPolygon.coordinates || drawnPolygon.coordinates[0].length < 4) {
      setMessage({ type: 'error', text: 'Please draw a polygon with at least 3 points' });
      return;
    }

    setLoading(true);
    setMessage(null);
    
    try {
      const payload = {
        name: drawnPolygon.name,
        description: drawnPolygon.description || undefined,
        geometry: {
          type: 'Polygon',
          coordinates: drawnPolygon.coordinates,
        },
      };

      const response = await apiClient.post('/aoi', payload);
      setMessage({ type: 'success', text: `✓ AOI "${response.data.name}" created successfully!` });
      
      // Reset
      clearDrawing();
      setDrawnPolygon({ name: '', description: '', coordinates: null });
    } catch (error: any) {
      const errorMsg = error.response?.data?.detail || error.message || 'Failed to create AOI';
      setMessage({ type: 'error', text: errorMsg });
      console.error('AOI creation error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex flex-column h-100 bg-light" style={{height: '100vh'}}>
      {/* Header */}
      <div className="bg-white border-bottom border-gray-300 p-3 shadow-sm">
        <h1 className="h3 fw-bold text-dark mb-0">✏️ Draw Area of Interest</h1>
        <p className="text-secondary mt-2 mb-0 small">
          {!isDrawing ? 'Click the "Start Drawing" button to begin' : 'Click on the map to add points. Press Enter when done.'}
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
                className="btn btn-primary d-flex align-items-center gap-2"
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
            
            {drawnPolygon.coordinates && (
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

            {/* Polygon Info */}
            {drawnPolygon.coordinates && (
              <div className="bg-light border border-success rounded p-3">
                <p className="small text-success fw-medium mb-0">
                  ✓ Polygon drawn with {drawnPolygon.coordinates[0].length - 1} vertices
                </p>
              </div>
            )}

            {/* Name Field */}
            <div>
              <label className="form-label small fw-medium text-dark">
                AOI Name <span className="text-danger">*</span>
              </label>
              <input
                type="text"
                value={drawnPolygon.name}
                onChange={handleNameChange}
                placeholder="e.g., Mining Site Alpha"
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
                value={drawnPolygon.description}
                onChange={handleDescriptionChange}
                placeholder="e.g., User-defined Area of Interest"
                rows={4}
                className="form-control form-control-sm"
              />
            </div>

            {/* Instructions */}
            <div className="bg-light border border-warning rounded p-3">
              <p className="small fw-semibold text-warning mb-2">📍 Steps:</p>
              <ol className="small text-warning ps-4 mb-0">
                <li><strong>1.</strong> Click "Start Drawing"</li>
                <li><strong>2.</strong> Click map to add points</li>
                <li><strong>3.</strong> Need ≥3 points</li>
                <li><strong>4.</strong> Click "Finish" to complete</li>
              </ol>
            </div>

            <div style={{flex: 1}}></div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading || !drawnPolygon.coordinates}
              className="w-100 btn btn-primary fw-semibold"
            >
              {loading ? '⏳ Creating AOI...' : '✓ Create AOI'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

