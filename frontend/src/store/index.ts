// / <reference types="vite/client" />
import { create } from 'zustand';

declare global {
  interface ImportMeta {
    readonly env: {
      readonly VITE_WS_URL?: string;
      readonly VITE_API_URL?: string;
    };
  }
}

/** TIME SERIES STATE */
interface TimeSeriesPoint {
  timestamp: string;
  excavated_area_ha: number;
  smoothed_area_ha?: number;
  excavation_rate_ha_day?: number;
  anomaly_score?: number;
  confidence?: number;
}

interface TimeSeriesState {
  legalBoundary: TimeSeriesPoint[];
  noGoZones: TimeSeriesPoint[];
  summaryStats: Record<string, number>;
  loading: boolean;
  error: string | null;
  setData: (legal: TimeSeriesPoint[], nogo: TimeSeriesPoint[], stats: Record<string, number>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearData: () => void;
}

export const useTimeSeriesStore = create<TimeSeriesState>((set) => ({
  legalBoundary: [],
  noGoZones: [],
  summaryStats: {},
  loading: false,
  error: null,
  setData: (legal, nogo, stats) => set({ legalBoundary: legal, noGoZones: nogo, summaryStats: stats, error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clearData: () => set({ legalBoundary: [], noGoZones: [], summaryStats: {}, error: null }),
}));

/** VIOLATION STATE */
export interface Violation {
  id: string;
  event_type: string;
  detection_date: string;
  excavated_area_ha: number;
  severity: string;
  description?: string;
  is_resolved: boolean;
  resolved_date?: string;
}

interface ViolationState {
  violations: Violation[];
  loading: boolean;
  error: string | null;
  setViolations: (violations: Violation[]) => void;
  addViolation: (violation: Violation) => void;
  removeViolation: (violationId: string) => void;
  updateViolation: (violationId: string, updates: Partial<Violation>) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearViolations: () => void;
}

export const useViolationStore = create<ViolationState>((set) => ({
  violations: [],
  loading: false,
  error: null,
  setViolations: (violations) => set({ violations, error: null }),
  addViolation: (violation) => set((state) => ({
    violations: [violation, ...state.violations],
  })),
  removeViolation: (violationId) => set((state) => ({
    violations: state.violations.filter(v => v.id !== violationId),
  })),
  updateViolation: (violationId, updates) => set((state) => ({
    violations: state.violations.map(v =>
      v.id === violationId ? { ...v, ...updates } : v
    ),
  })),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  clearViolations: () => set({ violations: [], error: null }),
}));

/** WEBSOCKET STATE */
interface WebSocketState {
  isConnected: boolean;
  connect: (aoiId: string, onMessage: (data: any) => void) => void;
  disconnect: () => void;
  reconnectAttempts: number;
  incrementReconnectAttempts: () => void;
  resetReconnectAttempts: () => void;
}

export const useWebSocketStore = create<WebSocketState>((set) => {
  let ws: WebSocket | null = null;
  let reconnectInterval: NodeJS.Timeout | null = null;

  return {
    isConnected: false,
    reconnectAttempts: 0,

    connect: (aoiId: string, onMessage: (data: any) => void) => {
      const wsBaseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/api/v1';
      const wsUrl = `${wsBaseUrl}/ws/violations/${aoiId}`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          set({ isConnected: true, reconnectAttempts: 0 });
          console.log('WebSocket connected:', wsUrl);
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            onMessage(data);
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        ws.onclose = () => {
          set({ isConnected: false });
          console.log('WebSocket disconnected');
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          set({ isConnected: false });
        };
      } catch (error) {
        console.error('Failed to create WebSocket:', error);
        set({ isConnected: false });
      }
    },

    disconnect: () => {
      if (ws) {
        ws.close();
        set({ isConnected: false });
      }
      if (reconnectInterval) {
        clearInterval(reconnectInterval);
      }
    },

    incrementReconnectAttempts: () =>
      set((state) => ({ reconnectAttempts: state.reconnectAttempts + 1 })),

    resetReconnectAttempts: () =>
      set({ reconnectAttempts: 0 }),
  };
});

/** MAP STATE */
interface LayerVisibility {
  [layerId: string]: boolean;
}

interface MapState {
  selectedAoI: string | null;
  mapCenter: [number, number];
  mapZoom: number;
  layerVisibility: LayerVisibility;
  selectedTimestamp: string | null;
  availableTimestamps: string[];
  highlightedFeature: string | null;
  setSelectedAoI: (aoiId: string | null) => void;
  setMapView: (center: [number, number], zoom: number) => void;
  toggleLayer: (layerId: string, visible: boolean) => void;
  setLayerVisibility: (visibility: LayerVisibility) => void;
  setSelectedTimestamp: (timestamp: string | null) => void;
  setAvailableTimestamps: (timestamps: string[]) => void;
  setHighlightedFeature: (featureId: string | null) => void;
  resetToDefault: () => void;
}

export const useMapStore = create<MapState>((set) => ({
  selectedAoI: null,
  mapCenter: [36.206, -112.913], // Default: Nevada mining region
  mapZoom: 12,
  layerVisibility: {
    legal_boundary: true,
    nogo_zones: true,
    excavation_detection: true,
  },
  selectedTimestamp: null,
  availableTimestamps: [],
  highlightedFeature: null,

  setSelectedAoI: (aoiId) => set({ selectedAoI: aoiId }),

  setMapView: (center, zoom) => set({ mapCenter: center, mapZoom: zoom }),

  toggleLayer: (layerId, visible) =>
    set((state) => ({
      layerVisibility: {
        ...state.layerVisibility,
        [layerId]: visible,
      },
    })),

  setLayerVisibility: (visibility) => set({ layerVisibility: visibility }),

  setSelectedTimestamp: (timestamp) => set({ selectedTimestamp: timestamp }),

  setAvailableTimestamps: (timestamps) => set({ availableTimestamps: timestamps }),

  setHighlightedFeature: (featureId) => set({ highlightedFeature: featureId }),

  resetToDefault: () =>
    set({
      selectedAoI: null,
      mapCenter: [36.206, -112.913],
      mapZoom: 12,
      layerVisibility: {
        legal_boundary: true,
        nogo_zones: true,
        excavation_detection: true,
      },
      selectedTimestamp: null,
      availableTimestamps: [],
      highlightedFeature: null,
    }),
}));

/** UI STATE */
interface UIState {
  sidebarOpen: boolean;
  alertsPanelExpanded: boolean;
  selectedTab: 'map' | 'analytics' | 'settings';
  toggleSidebar: () => void;
  toggleAlertsPanel: () => void;
  setSelectedTab: (tab: 'map' | 'analytics' | 'settings') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  alertsPanelExpanded: true,
  selectedTab: 'map',
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleAlertsPanel: () => set((state) => ({ alertsPanelExpanded: !state.alertsPanelExpanded })),
  setSelectedTab: (tab) => set({ selectedTab: tab }),
}));
