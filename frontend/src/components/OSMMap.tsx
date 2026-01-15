import React, { useEffect, useRef, useState, useCallback } from 'react';
import { MapContainer, TileLayer, FeatureGroup } from 'react-leaflet';
import { EditControl } from 'react-leaflet-draw';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import { Loader } from 'lucide-react';
import type { Boundary, ExcavationDetection, GeoJSONPolygon } from '../types';

interface OSMMapProps {
  boundaries: Boundary[];
  excavationMask?: ExcavationDetection[];
  selectedTimestamp?: string | null;
  isLoading?: boolean;
  onPolygonDrawn: (type: 'aoi' | 'legal' | 'nogo', polygon: GeoJSONPolygon) => void;
  onFeatureClick?: (feature: any) => void;
}

/**
 * Interactive OpenStreetMap component with Leaflet drawing tools
 * - Draw AOI, Legal Boundary, and No-Go Zone polygons
 * - Visualize excavation detection results
 * - Click on features to view details
 */
export const OSMMap: React.FC<OSMMapProps> = ({
  boundaries,
  excavationMask = [],
  selectedTimestamp,
  isLoading = false,
  onPolygonDrawn,
  onFeatureClick,
}) => {
  const featureGroupRef = useRef<L.FeatureGroup>(null);
  const layersRef = useRef<Map<string, L.Layer>>(new Map());
  const [drawingMode, setDrawingMode] = useState<'aoi' | 'legal' | 'nogo' | null>(null);
  const [mapCenter] = useState<[number, number]>([20.5937, 78.9629]); // India center
  const [mapZoom] = useState(5);

  // Color mapping for polygon types
  const getPolygonColor = (type: string): string => {
    switch (type) {
      case 'aoi':
        return '#3B82F6'; // Blue
      case 'legal':
        return '#10B981'; // Green
      case 'nogo':
        return '#EF4444'; // Red
      default:
        return '#6B7280'; // Gray
    }
  };

  // Color based on excavation confidence
  const getExcavationColor = (confidence: number): string => {
    if (confidence > 0.8) return '#EF4444'; // Red
    if (confidence > 0.6) return '#F97316'; // Orange
    if (confidence > 0.4) return '#EAB308'; // Yellow
    return '#22C55E'; // Lime
  };

  // Handle polygon drawing completion
  const handleDrawCreated = useCallback(
    (e: any) => {
      const layer = e.layer;
      if (layer instanceof L.Polygon && drawingMode) {
        const latlngs = layer.getLatLngs()[0]; // Get outer ring
        const coords = (latlngs as any[]).map((latLng: L.LatLng) => [latLng.lng, latLng.lat] as [number, number]);

        const geoJson: GeoJSONPolygon = {
          type: 'Polygon',
          coordinates: [coords],
        };

        onPolygonDrawn(drawingMode, geoJson);
        setDrawingMode(null);

        // Remove the drawn layer
        if (featureGroupRef.current) {
          featureGroupRef.current.removeLayer(layer);
        }
      }
    },
    [drawingMode, onPolygonDrawn]
  );

  // Add boundary polygons to map
  useEffect(() => {
    if (!featureGroupRef.current) return;

    // Clear existing boundary layers
    layersRef.current.forEach((layer, key) => {
      if (key.startsWith('boundary-')) {
        featureGroupRef.current?.removeLayer(layer);
        layersRef.current.delete(key);
      }
    });

    // Add new boundaries
    boundaries.forEach((boundary) => {
      const coords = boundary.geometry.coordinates[0];
      const latlngs = coords.map(([lng, lat]) => [lat, lng] as [number, number]);

      const polygon = L.polygon(latlngs, {
        color: getPolygonColor(boundary.boundary_type),
        weight: 2,
        opacity: 0.8,
        fillOpacity: 0.4,
      });

      polygon.bindPopup(`
        <div class="text-sm font-semibold">${boundary.boundary_type.toUpperCase()}</div>
        <p class="text-xs">${boundary.name}</p>
        <p class="text-xs text-gray-600">${new Date(boundary.created_at).toLocaleDateString()}</p>
      `);

      if (onFeatureClick) {
        polygon.on('click', () => onFeatureClick(boundary));
      }

      polygon.addTo(featureGroupRef.current!);
      layersRef.current.set(`boundary-${boundary.id}`, polygon);
    });
  }, [boundaries, onFeatureClick]);

  // Add excavation detection polygons
  useEffect(() => {
    if (!featureGroupRef.current) return;

    // Clear existing excavation layers
    layersRef.current.forEach((layer, key) => {
      if (key.startsWith('excavation-')) {
        featureGroupRef.current?.removeLayer(layer);
        layersRef.current.delete(key);
      }
    });

    // Add excavations for selected timestamp
    if (selectedTimestamp) {
      excavationMask
        .filter((e) => String(e.timestamp) === String(selectedTimestamp))
        .forEach((excavation) => {
          const coords = excavation.geometry.coordinates[0];
          const latlngs = coords.map(([lng, lat]) => [lat, lng] as [number, number]);

          const polygon = L.polygon(latlngs, {
            color: getExcavationColor(excavation.confidence),
            weight: 2,
            opacity: 0.7,
            fillOpacity: 0.3,
            dashArray: '5, 5',
          });

          polygon.bindPopup(`
            <div class="text-sm font-semibold">Excavation Detected</div>
            <p class="text-xs">Confidence: ${(excavation.confidence * 100).toFixed(1)}%</p>
            <p class="text-xs text-gray-600">${new Date(excavation.timestamp).toLocaleDateString()}</p>
          `);

          if (onFeatureClick) {
            polygon.on('click', () => onFeatureClick(excavation));
          }

          polygon.addTo(featureGroupRef.current!);
          layersRef.current.set(`excavation-${excavation.id}`, polygon);
        });
    }
  }, [excavationMask, selectedTimestamp, onFeatureClick]);

  return (
    <div className="relative w-full h-full bg-gray-900">
      {isLoading && (
        <div className="absolute inset-0 bg-black/50 z-20 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader className="animate-spin text-white" size={32} />
            <p className="text-white text-sm">Loading map data...</p>
          </div>
        </div>
      )}

      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        className="w-full h-full"
        style={{ zIndex: 1 }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FeatureGroup ref={featureGroupRef}>
          {drawingMode && (
            <EditControl
              position="topleft"
              onCreated={handleDrawCreated}
              draw={{
                polygon: {
                  allowIntersection: false,
                  drawError: {
                    color: '#e1e100',
                    message: 'Polygons cannot intersect!',
                  },
                  shapeOptions: {
                    color: getPolygonColor(drawingMode),
                    weight: 2,
                    opacity: 0.8,
                    fillOpacity: 0.4,
                  },
                },
                circle: false,
                circlemarker: false,
                marker: false,
                polyline: false,
                rectangle: false,
              }}
              edit={{}}
            />
          )}
        </FeatureGroup>
      </MapContainer>

      {/* Legend */}
      <div className="absolute top-4 right-4 bg-white/95 p-4 rounded-lg shadow-lg z-10 max-w-xs">
        <h3 className="font-bold text-sm mb-3 text-gray-900">Legend</h3>
        <div className="space-y-2 text-xs text-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded border border-blue-600"></div>
            <span>Area of Interest (AOI)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded border border-green-600"></div>
            <span>Legal Mine Boundary</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded border border-red-600"></div>
            <span>No-Go Zone</span>
          </div>
          <hr className="my-2" />
          <div className="text-xs font-semibold mb-1 text-gray-900">Excavation Confidence:</div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded border border-red-600" style={{ borderRadius: '2px' }}></div>
            <span>&gt;80%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded border border-orange-600" style={{ borderRadius: '2px' }}></div>
            <span>60-80%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded border border-yellow-600" style={{ borderRadius: '2px' }}></div>
            <span>40-60%</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-lime-500 rounded border border-lime-600" style={{ borderRadius: '2px' }}></div>
            <span>&lt;40%</span>
          </div>
        </div>
      </div>

      {/* Drawing Controls */}
      {!isLoading && (
        <div className="absolute bottom-4 left-4 flex flex-wrap gap-2 z-10">
          <button
            onClick={() => setDrawingMode(drawingMode === 'aoi' ? null : 'aoi')}
            className={`px-4 py-2 rounded font-medium text-sm transition ${
              drawingMode === 'aoi'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-blue-50'
            }`}
          >
            ✏️ Draw AOI
          </button>
          <button
            onClick={() => setDrawingMode(drawingMode === 'legal' ? null : 'legal')}
            className={`px-4 py-2 rounded font-medium text-sm transition ${
              drawingMode === 'legal'
                ? 'bg-green-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-green-50'
            }`}
          >
            ✏️ Draw Legal
          </button>
          <button
            onClick={() => setDrawingMode(drawingMode === 'nogo' ? null : 'nogo')}
            className={`px-4 py-2 rounded font-medium text-sm transition ${
              drawingMode === 'nogo'
                ? 'bg-red-600 text-white shadow-lg'
                : 'bg-white text-gray-700 hover:bg-red-50'
            }`}
          >
            ✏️ Draw No-Go
          </button>
        </div>
      )}

      {/* Drawing Instructions */}
      {drawingMode && (
        <div className="absolute bottom-20 left-4 bg-amber-50 border border-amber-300 rounded-lg p-3 z-10 max-w-xs">
          <p className="text-sm font-semibold text-amber-900 mb-1">📍 Drawing Mode Active</p>
          <p className="text-xs text-amber-800">
            Click on the map to draw {drawingMode.toUpperCase()}, then double-click to finish.
          </p>
        </div>
      )}
    </div>
  );
};

export default OSMMap;
