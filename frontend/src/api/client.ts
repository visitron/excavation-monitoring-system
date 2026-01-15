import axios, { AxiosInstance } from 'axios';
import type {
  AoI,
  Boundary,
  TimeSeriesResponse,
  ViolationEvent,
  GeoJSONPolygon,
  AnalysisJobStatus,
  ExcavationDetection,
} from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
const WS_BASE_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Error handling interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', {
      status: error.response?.status,
      url: error.response?.config?.url,
      data: error.response?.data,
    });
    return Promise.reject(error);
  }
);

/** API ENDPOINTS */

// AOI endpoints
export const aoi = {
  create: (data: any) => apiClient.post<AoI>('/aoi', data),
  list: (skip: number = 0, limit: number = 100) => 
    apiClient.get<AoI[]>('/aoi', { params: { skip, limit } }),
  get: (id: string) => apiClient.get<AoI>(`/aoi/${id}`),
};

// Boundary endpoints
export const boundaries = {
  create: (data: any) => apiClient.post<Boundary>('/boundaries', data),
  list: (aoiId: string, skip: number = 0, limit: number = 100) => 
    apiClient.get<Boundary[]>('/boundaries', { params: { aoi_id: aoiId, skip, limit } }),
  get: (id: string) => apiClient.get<Boundary>(`/boundaries/${id}`),
  getByAoI: (aoiId: string) => 
    apiClient.get<Boundary[]>('/boundaries', { params: { aoi_id: aoiId } }),
};

// Time-series endpoints - for analytics dashboard
export const timeseries = {
  get: (aoiId: string, params?: any) => 
    apiClient.get<TimeSeriesResponse>(`/timeseries/${aoiId}`, { params }),
  getByAoI: (aoiId: string) =>
    apiClient.get<TimeSeriesResponse>(`/timeseries/${aoiId}`),
};

// Map data endpoints - for spatial visualization
export const maps = {
  getExcavationLayer: (aoiId: string, timestamp: string) =>
    apiClient.get<ExcavationDetection>(`/maps/${aoiId}/excavation/${timestamp}`),
  
  getTimestamps: (aoiId: string) =>
    apiClient.get<string[]>(`/maps/${aoiId}/timestamps`),
  
  getExcavationByAoI: (aoiId: string) =>
    apiClient.get<ExcavationDetection[]>(`/maps/${aoiId}/excavation`),
};

// Violation endpoints
export const violations = {
  list: (aoiId: string, params?: any) => 
    apiClient.get<ViolationEvent[]>(`/violations/${aoiId}`, { params }),
  
  history: (aoiId: string, params?: any) =>
    apiClient.get<ViolationEvent[]>(`/violations/${aoiId}/history`, { params }),
  
  getByAoI: (aoiId: string) =>
    apiClient.get<ViolationEvent[]>(`/violations/${aoiId}`),
  
  create: (data: any) => apiClient.post<ViolationEvent>('/violations', data),
  resolve: (violationId: string) => 
    apiClient.patch<ViolationEvent>(`/violations/${violationId}/resolve`),
};

// Analysis endpoints
export const analysis = {
  run: (aoiId: string, config?: Record<string, any>) => 
    apiClient.post<AnalysisJobStatus>('/analysis/run', { aoi_id: aoiId, ...config }),
  
  status: (jobId: string) => 
    apiClient.get<AnalysisJobStatus>(`/analysis/status/${jobId}`),
  
  runAnalysis: (aoiId: string) =>
    apiClient.post<AnalysisJobStatus>('/analysis/run', { aoi_id: aoiId }),
  
  getAnalysisStatus: (jobId: string) =>
    apiClient.get<AnalysisJobStatus>(`/analysis/status/${jobId}`),
};

// Health check
export const health = {
  check: () => apiClient.get('/health'),
};

/** HELPER FUNCTIONS */

/**
 * Convert lat/lng coordinates to GeoJSON polygon
 * Expects [[lat, lng], [lat, lng], ...] and converts to GeoJSON [[lng, lat], [lng, lat], ...]
 */
export function polygonToGeoJSON(coordinates: [number, number][]): GeoJSONPolygon {
  if (coordinates.length < 3) {
    throw new Error('Polygon must have at least 3 vertices');
  }

  // Convert from [lat, lng] to [lng, lat] and close the ring
  const geoJsonCoords = coordinates.map(([lat, lng]) => [lng, lat] as [number, number]);

  // Close the polygon if not already closed
  const firstCoord = geoJsonCoords[0];
  const lastCoord = geoJsonCoords[geoJsonCoords.length - 1];
  if (firstCoord[0] !== lastCoord[0] || firstCoord[1] !== lastCoord[1]) {
    geoJsonCoords.push(firstCoord);
  }

  return {
    type: 'Polygon',
    coordinates: [geoJsonCoords],
  };
}

/** WEBSOCKET HELPERS */

export const createWebSocketURL = (aoiId: string): string => {
  return `${WS_BASE_URL}/ws/violations/${aoiId}`;
};
