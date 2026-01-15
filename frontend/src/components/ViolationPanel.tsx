import React, { useEffect, useState } from 'react';
import { useViolationStore, useWebSocketStore } from '../store';
import { AlertCircle, CheckCircle, TrendingUp, Wifi, WifiOff, Trash2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';

interface ViolationPanelProps {
  aoiId?: string;
  onViolationHighlight?: (violationId: string) => void;
  autoConnect?: boolean;
}

/**
 * ViolationPanel Component
 * 
 * Real-time alert display with WebSocket integration.
 * Shows:
 * - No-go zone violations
 * - Incremental excavation growth events
 * - Connected/disconnected status
 * - Alert severity indicators
 */
export const ViolationPanel: React.FC<ViolationPanelProps> = ({
  aoiId = 'default-aoi',
  onViolationHighlight,
  autoConnect = true,
}) => {
  const { violations, addViolation, setViolations } = useViolationStore();
  const { isConnected, connect, disconnect } = useWebSocketStore();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    // Connect to WebSocket for real-time alerts if autoConnect is enabled
    if (autoConnect) {
      connect(aoiId, (data) => {
        if (data.type === 'violation_alert') {
          const newViolation = {
            id: data.data.event_id || `violation-${Date.now()}`,
            event_type: data.data.event_type || 'VIOLATION_START',
            detection_date: data.data.detection_date || new Date().toISOString(),
            excavated_area_ha: data.data.excavated_area_ha || 0,
            severity: data.data.severity || 'HIGH',
            description: data.data.description || 'Excavation detected in no-go zone',
            is_resolved: false,
            resolved_date: undefined,
          };
          addViolation(newViolation);
          onViolationHighlight?.(newViolation.id);
        } else if (data.type === 'violation_resolved') {
          // Handle violation resolution
          setViolations(
            violations.map(v =>
              v.id === data.data.event_id
                ? { ...v, is_resolved: true, resolved_date: new Date().toISOString() }
                : v
            )
          );
        }
      });

      return () => {
        disconnect();
      };
    }
  }, [aoiId, autoConnect]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-light border-start border-5 border-danger text-danger';
      case 'HIGH':
        return 'bg-light border-start border-5 border-warning text-warning';
      case 'MEDIUM':
        return 'bg-light border-start border-5 border-info text-info';
      case 'LOW':
        return 'bg-light border-start border-5 border-primary text-primary';
      default:
        return 'bg-light border-start border-5 border-secondary text-secondary';
    }
  };

  const getSeverityBadge = (severity: string) => {
    const severityMap = {
      CRITICAL: { bg: 'bg-danger', label: 'Critical' },
      HIGH: { bg: 'bg-warning', label: 'High' },
      MEDIUM: { bg: 'bg-info', label: 'Medium' },
      LOW: { bg: 'bg-primary', label: 'Low' },
    };
    const config = severityMap[severity as keyof typeof severityMap] || severityMap.LOW;
    return config;
  };

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'VIOLATION_START':
        return <AlertCircle className="w-5 h-5 text-danger" />;
      case 'ESCALATION':
        return <TrendingUp className="w-5 h-5 text-warning" />;
      case 'VIOLATION_RESOLVED':
        return <CheckCircle className="w-5 h-5 text-success" />;
      default:
        return <AlertCircle className="w-5 h-5 text-secondary" />;
    }
  };

  const getEventLabel = (eventType: string) => {
    return eventType.replace(/_/g, ' ');
  };

  const clearAll = () => {
    setViolations([]);
  };

  const activeViolations = violations.filter(v => !v.is_resolved);
  const resolvedViolations = violations.filter(v => v.is_resolved);

  return (
    <div className="d-flex flex-column h-100 bg-light rounded">
      {/* Header */}
      <div className="px-4 py-3 bg-white border-bottom border-gray-300 flex-shrink-0">
        <div className="d-flex align-items-center justify-content-between mb-3">
          <h3 className="h5 fw-semibold text-dark mb-0">Real-Time Alerts</h3>
          <div className="d-flex align-items-center gap-2">
            <div className={`rounded-circle ${
              isConnected ? 'bg-success' : 'bg-secondary'
            }`} style={{width: '12px', height: '12px', animation: isConnected ? 'pulse 2s infinite' : 'none'}} />
            <span className="small fw-medium text-secondary">
              {isConnected ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>

        {/* Connection Status Detail */}
        {autoConnect && (
          <div className={`small px-2 py-1 rounded d-flex align-items-center gap-1 ${
            isConnected
              ? 'bg-light text-success border border-success'
              : 'bg-light text-secondary border border-secondary'
          }`}>
            {isConnected ? (
              <>
                <Wifi className="w-4 h-4" style={{width: '16px', height: '16px'}} />
                <span>WebSocket connected to alerts stream</span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4" style={{width: '16px', height: '16px'}} />
                <span>Attempting to connect...</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Alerts List */}
      <div className="flex-1 overflow-y-auto">
        {violations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 px-4">
            <CheckCircle className="w-12 h-12 text-green-400 mb-3" />
            <p className="text-gray-600 font-medium text-center">No violations detected</p>
            <p className="text-xs text-gray-500 text-center mt-1">
              Excavation activity is within approved zones
            </p>
          </div>
        ) : (
          <div className="space-y-2 p-4">
            {/* Active Violations */}
            {activeViolations.length > 0 && (
              <>
                <div className="sticky top-0 bg-gray-50 px-2 py-1 mb-2">
                  <p className="text-xs font-semibold text-red-700 uppercase tracking-wide">
                    Active Violations ({activeViolations.length})
                  </p>
                </div>
                {activeViolations.map((violation) => (
                  <div
                    key={violation.id}
                    className={`p-3 rounded-lg cursor-pointer transition border ${getSeverityColor(
                      violation.severity
                    )} ${expandedId === violation.id ? 'ring-2 ring-offset-1 ring-blue-400' : ''}`}
                    onClick={() => {
                      setExpandedId(expandedId === violation.id ? null : violation.id);
                      onViolationHighlight?.(violation.id);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-0.5">
                        {getEventIcon(violation.event_type)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="font-semibold text-sm">
                            {getEventLabel(violation.event_type)}
                          </h4>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded text-white ${
                            getSeverityBadge(violation.severity).bg
                          }`}>
                            {getSeverityBadge(violation.severity).label}
                          </span>
                        </div>

                        <p className="text-xs opacity-75 mb-2">
                          {format(parseISO(violation.detection_date), 'MMM dd HH:mm:ss')}
                        </p>

                        {expandedId === violation.id && (
                          <div className="mt-3 space-y-2 text-xs opacity-90 bg-black/5 p-2 rounded">
                            <p>
                              <span className="font-mono opacity-75">Area:</span>{' '}
                              <span className="font-bold">{violation.excavated_area_ha.toFixed(4)} ha</span>
                            </p>
                            {violation.description && (
                              <p className="break-words">{violation.description}</p>
                            )}
                          </div>
                        )}

                        <p className="text-xs font-mono opacity-75 mt-2 truncate">
                          ID: {violation.id.substring(0, 12)}...
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}

            {/* Resolved Violations */}
            {resolvedViolations.length > 0 && (
              <>
                <div className="sticky top-0 bg-gray-50 px-2 py-1 mb-2 mt-4">
                  <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">
                    Resolved ({resolvedViolations.length})
                  </p>
                </div>
                {resolvedViolations.map((violation) => (
                  <div
                    key={violation.id}
                    className="p-3 rounded-lg bg-green-50 border border-green-200 opacity-60 hover:opacity-100 transition"
                  >
                    <div className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <h4 className="font-semibold text-sm text-green-900">
                          {getEventLabel(violation.event_type)}
                        </h4>
                        <p className="text-xs text-green-700">
                          Resolved on {format(parseISO(violation.resolved_date || ''), 'MMM dd HH:mm:ss')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      {violations.length > 0 && (
        <div className="px-4 py-3 border-t border-gray-200 bg-white flex-shrink-0">
          <button
            onClick={clearAll}
            className="w-full px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear All
          </button>
        </div>
      )}
    </div>
  );
};
