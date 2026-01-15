export interface GeoJSONPoint {
  type: 'Point';
  coordinates: [number, number];
}

export interface GeoJSONLineString {
  type: 'LineString';
  coordinates: [number, number][];
}

export interface GeoJSONPolygon {
  type: 'Polygon';
  coordinates: [number, number][][];
}

export type GeoJSONGeometry = GeoJSONPoint | GeoJSONLineString | GeoJSONPolygon;

export interface GeoJSONFeature<T extends GeoJSONGeometry = GeoJSONGeometry> {
  type: 'Feature';
  geometry: T;
  properties?: Record<string, any>;
}

export interface TimeSeriesPoint {
  timestamp: string | number;
  excavated_area_ha: number;
  smoothed_area_ha?: number;
  excavation_rate_ha_day?: number;
  anomaly_score?: number;
  confidence?: number;
}

export interface TimeSeriesResponse {
  aoi_id: string;
  legal_boundary: TimeSeriesPoint[];
  nogo_zones: TimeSeriesPoint[];
  summary_stats?: {
    total_excavated_ha?: number;
    average_rate_ha_day?: number;
    peak_confidence?: number;
    current_violations?: number;
  };
}

export interface Boundary {
  id: string;
  aoi_id: string;
  name: string;
  description?: string;
  geometry: GeoJSONPolygon;
  is_legal: boolean;
  boundary_type: 'aoi' | 'legal' | 'nogo';
  created_at: string;
  updated_at: string;
}

export interface AoI {
  id: string;
  name: string;
  description?: string;
  geometry: GeoJSONPolygon;
  created_at: string;
  updated_at: string;
}

export interface ExcavationDetection {
  id: string;
  timestamp: string | number;
  confidence: number;
  geometry: GeoJSONPolygon;
  area_ha?: number;
}

export interface ViolationEvent {
  id: string;
  aoi_id: string;
  nogo_zone_id: string;
  event_type: 'VIOLATION_START' | 'ESCALATION' | 'VIOLATION_RESOLVED';
  detection_date: string;
  excavated_area_ha: number;
  description?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  is_resolved: boolean;
  resolved_date?: string;
  event_metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface AnalysisJobStatus {
  job_id: string;
  config_id: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  progress_percent: number;
  error_message?: string;
  result_metadata?: Record<string, any>;
  started_at?: string;
  completed_at?: string;
}

export interface MapControlsState {
  selectedTimestamp: string | null;
  highlightedFeature: string | null;
  layerVisibility: {
    legal_boundary: boolean;
    nogo_zones: boolean;
    excavation_mask: boolean;
    violations: boolean;
  };
}
