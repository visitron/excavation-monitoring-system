import React, { useState } from 'react';
import { MapContainer, TileLayer, Polygon, Popup } from 'react-leaflet';
import { useMapStore } from '../store';
import 'leaflet/dist/leaflet.css';
import { Loader } from 'lucide-react';

interface Boundary {
  id: string;
  name: string;
  is_legal: boolean;
  geometry: any;
}

interface ExcavationDetection {
  id: string;
  timestamp: string;
  geometry: any;
  confidence?: number;
  area_ha?: number;
}

interface ExcavationMapProps {
  boundaries?: Boundary[];
  excavationMask?: ExcavationDetection;
  selectedTimestamp?: string | null;
  isLoading?: boolean;
  onFeatureClick?: (featureId: string, type: string) => void;
}

/**
 * ExcavationMap Component
 * 
 * Interactive Leaflet-based map displaying:
 * - Legal mine boundaries (blue)
 * - No-go zone polygons (red dashed)
 * - Excavation detection layers (color-coded by confidence)
 * - Clickable features with metadata
 */
export const ExcavationMap: React.FC<ExcavationMapProps> = ({
  boundaries = [],
  excavationMask,
  selectedTimestamp,
  isLoading = false,
  onFeatureClick,
}) => {
  const { mapCenter, mapZoom } = useMapStore();
  const [hoveredFeature, setHoveredFeature] = useState<string | null>(null);

  const getPolygonColor = (isLegal: boolean) => {
    return isLegal ? '#2563eb' : '#ef4444';
  };

  const getExcavationColor = (confidence?: number) => {
    if (!confidence) return '#fbbf24'; // Amber for unknown confidence
    if (confidence >= 0.8) return '#ef4444'; // Red for high confidence
    if (confidence >= 0.6) return '#f97316'; // Orange
    if (confidence >= 0.4) return '#eab308'; // Yellow
    return '#84cc16'; // Lime for low confidence
  };

  const parseGeometry = (geometry: any): [number, number][] => {
    if (!geometry) return [];
    if (geometry.type === 'Polygon') {
      return geometry.coordinates[0].map((coord: any) => [coord[1], coord[0]]);
    }
    if (geometry.type === 'MultiPolygon') {
      return geometry.coordinates[0][0].map((coord: any) => [coord[1], coord[0]]);
    }
    return [];
  };

  const calculateArea = (geometry: any): number => {
    // Rough area calculation (in degrees squared, approximate)
    const coords = parseGeometry(geometry);
    if (coords.length < 3) return 0;
    
    let area = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const [lat1, lon1] = coords[i];
      const [lat2, lon2] = coords[i + 1];
      area += (lon1 * lat2 - lon2 * lat1);
    }
    return Math.abs(area) / 2;
  };

  return (
    <div className="w-full h-full rounded-lg overflow-hidden shadow-lg relative bg-gray-100">
      {isLoading && (
        <div className="absolute inset-0 bg-black/30 flex items-center justify-center z-50 rounded-lg">
          <div className="bg-white rounded-lg shadow-lg px-6 py-4 flex items-center gap-3">
            <Loader className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-gray-700 font-medium">Loading map data...</span>
          </div>
        </div>
      )}

      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
      >
        {/* Satellite Basemap */}
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution='&copy; Esri'
          maxZoom={18}
        />

        {/* Legal Boundaries */}
        {boundaries
          .filter(b => b.is_legal)
          .map((boundary) => (
            <Polygon
              key={boundary.id}
              positions={parseGeometry(boundary.geometry)}
              color={getPolygonColor(true)}
              weight={3}
              dashArray=""
              fillOpacity={0.05}
              eventHandlers={{
                click: () => onFeatureClick?.(boundary.id, 'boundary'),
                mouseover: () => setHoveredFeature(boundary.id),
                mouseout: () => setHoveredFeature(null),
              }}
              className={hoveredFeature === boundary.id ? 'opacity-80' : ''}
            >
              <Popup>
                <div className="p-2 space-y-1">
                  <h4 className="font-bold text-gray-900">{boundary.name}</h4>
                  <p className="text-xs text-gray-600">Legal Boundary</p>
                  <p className="text-xs font-mono text-gray-500">
                    Area: {calculateArea(boundary.geometry).toFixed(4)}°²
                  </p>
                </div>
              </Popup>
            </Polygon>
          ))}

        {/* No-Go Zones */}
        {boundaries
          .filter(b => !b.is_legal)
          .map((boundary) => (
            <Polygon
              key={boundary.id}
              positions={parseGeometry(boundary.geometry)}
              color={getPolygonColor(false)}
              weight={2}
              dashArray="5, 5"
              fillOpacity={0.15}
              eventHandlers={{
                click: () => onFeatureClick?.(boundary.id, 'nogo_zone'),
                mouseover: () => setHoveredFeature(boundary.id),
                mouseout: () => setHoveredFeature(null),
              }}
            >
              <Popup>
                <div className="p-2 space-y-1">
                  <h4 className="font-bold text-gray-900">{boundary.name}</h4>
                  <p className="text-xs text-red-600 font-semibold">No-Go Zone</p>
                  <p className="text-xs font-mono text-gray-500">
                    Area: {calculateArea(boundary.geometry).toFixed(4)}°²
                  </p>
                </div>
              </Popup>
            </Polygon>
          ))}

        {/* Excavation Detection Overlay */}
        {excavationMask && (
          <Polygon
            positions={parseGeometry(excavationMask.geometry)}
            color={getExcavationColor(excavationMask.confidence)}
            weight={1.5}
            fillOpacity={0.6}
            eventHandlers={{
              click: () => onFeatureClick?.(excavationMask.id, 'excavation'),
              mouseover: () => setHoveredFeature(excavationMask.id),
              mouseout: () => setHoveredFeature(null),
            }}
          >
            <Popup>
              <div className="p-2 space-y-1">
                <h4 className="font-bold text-gray-900">Excavation Detection</h4>
                <p className="text-xs text-gray-600">
                  {selectedTimestamp && new Date(selectedTimestamp).toLocaleDateString()}
                </p>
                {excavationMask.confidence && (
                  <p className="text-xs text-gray-600">
                    Confidence: {(excavationMask.confidence * 100).toFixed(1)}%
                  </p>
                )}
                {excavationMask.area_ha && (
                  <p className="text-xs font-mono text-gray-500">
                    Area: {excavationMask.area_ha.toFixed(4)} ha
                  </p>
                )}
              </div>
            </Popup>
          </Polygon>
        )}
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-4 text-sm space-y-3 max-w-xs z-40">
        <h4 className="font-semibold text-gray-900">Legend</h4>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-blue-600 bg-blue-50"></div>
            <span className="text-gray-700">Legal Boundary</span>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="w-4 h-4 border-2 border-red-500 bg-red-100"
              style={{ borderStyle: 'dashed' }}
            ></div>
            <span className="text-gray-700">No-Go Zone</span>
          </div>
          <div className="space-y-1">
            <p className="text-gray-600 text-xs font-medium">Excavation Confidence:</p>
            {[
              { color: '#ef4444', label: 'High (>80%)' },
              { color: '#f97316', label: 'Medium (60-80%)' },
              { color: '#eab308', label: 'Low (40-60%)' },
              { color: '#84cc16', label: 'Very Low (<40%)' },
            ].map(({ color, label }) => (
              <div key={label} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm"
                  style={{ backgroundColor: color }}
                ></div>
                <span className="text-gray-600 text-xs">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
