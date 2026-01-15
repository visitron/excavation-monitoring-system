import React from 'react';
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  ComposedChart
} from 'recharts';
import { useTimeSeriesStore } from '../store';
import { format, parseISO } from 'date-fns';
import { TrendingUp } from 'lucide-react';

type ChartType = 'area' | 'rate' | 'comparison' | 'cumulative';

/**
 * ExcavationChart Component
 * 
 * Multi-view analytics dashboard showing:
 * - Excavation area trends (legal boundary vs no-go zones)
 * - Excavation rate over time
 * - Comparative analysis
 * - Cumulative excavation growth
 */
export const ExcavationChart: React.FC = () => {
  const { legalBoundary, noGoZones, summaryStats } = useTimeSeriesStore();
  const [chartType, setChartType] = React.useState<ChartType>('area');

  // Prepare chart data
  const chartData = legalBoundary.map((legal, idx) => {
    const nogo = noGoZones[idx];
    const prevLegal = idx > 0 ? legalBoundary[idx - 1].excavated_area_ha : legal.excavated_area_ha;
    const rate = legal.excavated_area_ha - prevLegal;

    return {
      date: format(parseISO(legal.timestamp), 'MMM dd'),
      timestamp: legal.timestamp,
      legal_area: legal.excavated_area_ha,
      legal_smooth: legal.smoothed_area_ha || legal.excavated_area_ha,
      nogo_area: nogo?.excavated_area_ha || 0,
      nogo_smooth: nogo?.smoothed_area_ha || 0,
      rate: rate > 0 ? rate : 0,
      legal_cumulative: legalBoundary.slice(0, idx + 1).reduce((sum, d) => sum + d.excavated_area_ha, 0) / (idx + 1),
      nogo_cumulative: noGoZones.slice(0, idx + 1).reduce((sum, d) => sum + (d?.excavated_area_ha || 0), 0) / (idx + 1),
    };
  });

  if (chartData.length === 0) {
    return (
      <div className="text-center text-secondary py-5">
        <TrendingUp className="w-12 h-12 text-muted mx-auto mb-2" style={{width: '48px', height: '48px'}} />
        <p className="fw-medium">No data available</p>
        <p className="small">Load time-series data to see excavation trends</p>
      </div>
    );
  }

  const commonProps = {
    data: chartData,
    margin: { top: 5, right: 30, left: 0, bottom: 5 } as any,
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 rounded shadow border border-gray-300">
          <p className="fw-semibold text-dark">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="small">
              {entry.name}: {typeof entry.value === 'number' ? entry.value.toFixed(4) : entry.value}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderChart = () => {
    switch (chartType) {
      case 'area':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart {...commonProps}>
              <defs>
                <linearGradient id="colorLegal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#1f2937" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#1f2937" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorNoGo" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis label={{ value: 'Area (ha)', angle: -90, position: 'insideLeft' }} stroke="#6b7280" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Area
                type="monotone"
                dataKey="legal_smooth"
                stroke="#1f2937"
                fillOpacity={1}
                fill="url(#colorLegal)"
                name="Legal Boundary"
              />
              <Area
                type="monotone"
                dataKey="nogo_smooth"
                stroke="#dc2626"
                fillOpacity={1}
                fill="url(#colorNoGo)"
                name="No-Go Zone"
              />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'rate':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis label={{ value: 'Daily Rate (ha)', angle: -90, position: 'insideLeft' }} stroke="#6b7280" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="rate" fill="#f59e0b" name="Excavation Rate" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'comparison':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis label={{ value: 'Area (ha)', angle: -90, position: 'insideLeft' }} stroke="#6b7280" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="legal_area" fill="#3b82f6" name="Legal Area (Raw)" opacity={0.7} />
              <Bar dataKey="nogo_area" fill="#ef4444" name="No-Go Area (Raw)" opacity={0.7} />
              <Line
                type="monotone"
                dataKey="legal_smooth"
                stroke="#1f2937"
                strokeWidth={2}
                dot={false}
                name="Legal Trend"
              />
              <Line
                type="monotone"
                dataKey="nogo_smooth"
                stroke="#dc2626"
                strokeWidth={2}
                dot={false}
                name="No-Go Trend"
              />
            </ComposedChart>
          </ResponsiveContainer>
        );

      case 'cumulative':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" stroke="#6b7280" />
              <YAxis label={{ value: 'Cumulative Area (ha)', angle: -90, position: 'insideLeft' }} stroke="#6b7280" />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="legal_cumulative"
                stroke="#1f2937"
                strokeWidth={2}
                dot={false}
                name="Legal Cumulative"
              />
              <Line
                type="monotone"
                dataKey="nogo_cumulative"
                stroke="#dc2626"
                strokeWidth={2}
                dot={false}
                name="No-Go Cumulative"
              />
            </LineChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Chart Type Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="h5 fw-semibold mb-4 text-dark">Excavation Activity</h3>

        <div className="d-flex flex-wrap gap-2 mb-4">
          {[
            { id: 'area', label: 'Area Trends', icon: '📈' },
            { id: 'rate', label: 'Daily Rate', icon: '📊' },
            { id: 'comparison', label: 'Comparison', icon: '⚖️' },
            { id: 'cumulative', label: 'Cumulative', icon: '📑' },
          ].map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setChartType(id as ChartType)}
              className={`btn px-4 py-2 fw-medium transition d-flex align-items-center gap-2 ${
                chartType === id
                  ? 'btn-primary'
                  : 'btn-light text-dark border'
              }`}
            >
              <span>{icon}</span>
              <span className="d-none d-sm-inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="bg-light rounded p-4 border">
          {renderChart()}
        </div>

        <p className="small text-secondary mt-3">
          Showing {chartData.length} data points | Last updated: {chartData[chartData.length - 1]?.timestamp ? new Date(chartData[chartData.length - 1].timestamp).toLocaleString() : 'N/A'}
        </p>
      </div>

      {/* Summary Statistics */}
      <div className="row g-3">
        <div className="col-6 col-sm-3">
          <div className="bg-light rounded p-3 border border-primary">
            <p className="small text-primary text-uppercase fw-semibold">Max Legal Area</p>
            <p className="h5 fw-bold text-primary mt-1">
              {(summaryStats.legal_max_ha || 0).toFixed(4)}
            </p>
            <p className="small text-primary mt-1">hectares</p>
          </div>
        </div>

        <div className="col-6 col-sm-3">
          <div className="bg-light rounded p-3 border border-danger">
            <p className="small text-danger text-uppercase fw-semibold">Max No-Go Area</p>
            <p className="h5 fw-bold text-danger mt-1">
              {(summaryStats.nogo_max_ha || 0).toFixed(4)}
            </p>
            <p className="small text-danger mt-1">hectares</p>
          </div>
        </div>

        <div className="col-6 col-sm-3">
          <div className="bg-light rounded p-3 border border-warning">
            <p className="small text-warning text-uppercase fw-semibold">Avg Rate (Legal)</p>
            <p className="h5 fw-bold text-warning mt-1">
              {(summaryStats.legal_avg_rate || 0).toFixed(4)}
            </p>
            <p className="small text-warning mt-1">ha/day</p>
          </div>
        </div>

        <div className="col-6 col-sm-3">
          <div className="bg-light rounded p-3 border border-info">
            <p className="small text-info text-uppercase fw-semibold">Avg Rate (No-Go)</p>
            <p className="h5 fw-bold text-info mt-1">
              {(summaryStats.nogo_avg_rate || 0).toFixed(4)}
            </p>
            <p className="small text-info mt-1">ha/day</p>
          </div>
        </div>
      </div>
    </div>
  );
};
