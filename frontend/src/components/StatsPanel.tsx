import React from 'react';
import { AlertTriangle, TrendingUp, BarChart3, Clock } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'green' | 'orange' | 'purple';
  trend?: {
    direction: 'up' | 'down';
    percentage: number;
  };
}

const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  unit,
  icon,
  color,
  trend,
}) => {
  const colorMap = {
    blue: { bg: 'bg-light', border: 'border-primary', text: 'text-primary', icon: 'text-primary' },
    red: { bg: 'bg-light', border: 'border-danger', text: 'text-danger', icon: 'text-danger' },
    green: { bg: 'bg-light', border: 'border-success', text: 'text-success', icon: 'text-success' },
    orange: { bg: 'bg-light', border: 'border-warning', text: 'text-warning', icon: 'text-warning' },
    purple: { bg: 'bg-light', border: 'border-info', text: 'text-info', icon: 'text-info' },
  };

  const colors = colorMap[color];

  return (
    <div className={`${colors.bg} rounded p-4 border border-2 ${colors.border}`}>
      <div className="d-flex justify-content-between align-items-start mb-2">
        <div className={`${colors.icon} p-2 rounded bg-white`}>
          {icon}
        </div>
        {trend && (
          <div className={`badge ${
            trend.direction === 'up' ? 'bg-danger' : 'bg-success'
          }`}>
            {trend.direction === 'up' ? '↑' : '↓'} {trend.percentage.toFixed(1)}%
          </div>
        )}
      </div>
      <p className="small text-muted text-uppercase fw-semibold mb-1">{label}</p>
      <div className={`fs-3 fw-bold ${colors.text}`}>
        {typeof value === 'number' ? value.toFixed(4) : value}
      </div>
      {unit && <p className={`small ${colors.text} opacity-75 mt-1`}>{unit}</p>}
    </div>
  );
};

interface StatsPanelProps {
  legalAreaCurrent: number;
  noGoAreaCurrent: number;
  legalAreaPrevious?: number;
  noGoAreaPrevious?: number;
  violationCount: number;
  lastViolationDate?: string;
  dataPointCount: number;
  lastUpdateDate?: string;
}

/**
 * StatsPanel Component
 * 
 * Displays key monitoring metrics including:
 * - Current excavation areas
 * - Trend indicators
 * - Violation statistics
 * - Data freshness
 */
export const StatsPanel: React.FC<StatsPanelProps> = ({
  legalAreaCurrent,
  noGoAreaCurrent,
  legalAreaPrevious = legalAreaCurrent,
  noGoAreaPrevious = noGoAreaCurrent,
  violationCount,
  lastViolationDate,
  dataPointCount,
  lastUpdateDate,
}) => {
  const legalTrend = legalAreaCurrent > legalAreaPrevious ? {
    direction: 'up' as const,
    percentage: ((legalAreaCurrent - legalAreaPrevious) / legalAreaPrevious) * 100,
  } : {
    direction: 'down' as const,
    percentage: ((legalAreaPrevious - legalAreaCurrent) / legalAreaPrevious) * 100,
  };

  const noGoTrend = noGoAreaCurrent > noGoAreaPrevious ? {
    direction: 'up' as const,
    percentage: ((noGoAreaCurrent - noGoAreaPrevious) / noGoAreaPrevious) * 100,
  } : {
    direction: 'down' as const,
    percentage: ((noGoAreaPrevious - noGoAreaCurrent) / noGoAreaPrevious) * 100,
  };

  return (
    <div className="space-y-4">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Legal Area"
          value={legalAreaCurrent}
          unit="hectares"
          icon={<BarChart3 className="w-5 h-5" />}
          color="blue"
          trend={legalTrend}
        />

        <StatCard
          label="No-Go Area"
          value={noGoAreaCurrent}
          unit="hectares"
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
          trend={noGoTrend}
        />

        <StatCard
          label="Violations"
          value={violationCount}
          unit="detected"
          icon={<AlertTriangle className="w-5 h-5" />}
          color={violationCount > 0 ? 'red' : 'green'}
        />

        <StatCard
          label="Data Points"
          value={dataPointCount}
          unit="timestamps"
          icon={<BarChart3 className="w-5 h-5" />}
          color="purple"
        />
      </div>

      {/* Status Information */}
      <div className="bg-white rounded-lg shadow p-4 space-y-3">
        <h4 className="font-semibold text-gray-900 text-sm">Status</h4>

        {lastUpdateDate && (
          <div className="flex items-center justify-between text-sm py-2 border-b border-gray-200">
            <div className="flex items-center gap-2 text-gray-600">
              <Clock className="w-4 h-4" />
              <span>Last Updated</span>
            </div>
            <span className="font-mono text-gray-700 text-xs">
              {new Date(lastUpdateDate).toLocaleTimeString()}
            </span>
          </div>
        )}

        {lastViolationDate && (
          <div className="flex items-center justify-between text-sm py-2">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-4 h-4" />
              <span>Last Violation</span>
            </div>
            <span className="font-mono text-gray-700 text-xs">
              {new Date(lastViolationDate).toLocaleString()}
            </span>
          </div>
        )}

        {!lastViolationDate && (
          <div className="flex items-center justify-between text-sm py-2">
            <div className="flex items-center gap-2 text-green-600">
              <TrendingUp className="w-4 h-4" />
              <span>No Violations</span>
            </div>
            <span className="font-semibold text-green-600">✓ Clear</span>
          </div>
        )}
      </div>

      {/* Alert Zone */}
      {noGoAreaCurrent > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg">
          <p className="text-sm font-semibold text-red-900 mb-1">⚠️ Active Violation</p>
          <p className="text-xs text-red-700">
            {noGoAreaCurrent.toFixed(4)} ha of excavation detected in no-go zones
          </p>
        </div>
      )}
    </div>
  );
};
