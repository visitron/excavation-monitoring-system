import React from 'react';
import { Eye, EyeOff, Layers } from 'lucide-react';

interface Layer {
  id: string;
  name: string;
  visible: boolean;
  description?: string;
  color?: string;
}

interface MapControlsProps {
  /** Available map layers */
  layers: Layer[];
  /** Callback when layer visibility changes */
  onLayerToggle: (layerId: string, visible: boolean) => void;
}

/**
 * MapControls Component
 * 
 * Provides controls for toggling map layers on/off.
 * Allows users to control visibility of legal boundaries,
 * no-go zones, and excavation detection layers.
 */
export const MapControls: React.FC<MapControlsProps> = ({
  layers,
  onLayerToggle,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
        <Layers className="w-5 h-5 text-gray-600" />
        <h3 className="font-semibold text-gray-900">Map Layers</h3>
      </div>

      <div className="space-y-2 p-4 max-h-64 overflow-y-auto">
        {layers.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No layers available</p>
        ) : (
          layers.map((layer) => (
            <label
              key={layer.id}
              className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer transition group"
            >
              <input
                type="checkbox"
                checked={layer.visible}
                onChange={(e) => onLayerToggle(layer.id, e.target.checked)}
                className="mt-1 w-4 h-4 text-blue-600 rounded focus:ring-blue-500 cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  {layer.color && (
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: layer.color }}
                    />
                  )}
                  <span className="font-medium text-gray-900 group-hover:text-gray-700">
                    {layer.name}
                  </span>
                  {layer.visible ? (
                    <Eye className="w-4 h-4 text-green-500 flex-shrink-0 ml-auto" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-gray-400 flex-shrink-0 ml-auto" />
                  )}
                </div>
                {layer.description && (
                  <p className="text-xs text-gray-500">{layer.description}</p>
                )}
              </div>
            </label>
          ))
        )}
      </div>
    </div>
  );
};
