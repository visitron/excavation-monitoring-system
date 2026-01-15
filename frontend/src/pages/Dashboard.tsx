import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { timeseries, violations, aoi, analysis } from '../api/client';
import {
  useTimeSeriesStore,
  useViolationStore,
  useMapStore,
  useUIStore,
} from '../store';
import { ExcavationChart } from '../components/ExcavationChart';
import { ViolationPanel } from '../components/ViolationPanel';
import { BackendHealthCheck } from '../components/BackendHealthCheck';
import { TimeSlider } from '../components/TimeSlider';
import { StatsPanel } from '../components/StatsPanel';
import type { AoI } from '../types';
import {
  Loader,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Menu,
  X,
  TrendingUp,
  Plus,
} from 'lucide-react';

interface DashboardProps {
  aoiId?: string;
}

export const Dashboard: React.FC<DashboardProps> = ({ aoiId: initialAoiId }) => {
  // State management
  const [selectedAoI, setSelectedAoI] = useState<string>(initialAoiId || 'default-aoi');
  const [aoiList, setAoiList] = useState<AoI[]>([]);
  const [timestamps, setTimestamps] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisRunning, setAnalysisRunning] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [stats, setStats] = useState({ legalArea: 0, noGoArea: 0, violations: 0 });

  // Store hooks
  const { setData } = useTimeSeriesStore();
  const { setViolations } = useViolationStore();
  const {
    selectedTimestamp,
    setSelectedTimestamp,
    setAvailableTimestamps,
  } = useMapStore();
  const { sidebarOpen, toggleSidebar } = useUIStore();

  // Fetch list of AOIs
  useEffect(() => {
    const fetchAoIs = async () => {
      try {
        const response = await aoi.list(0, 100);
        setAoiList(response.data);
        if (response.data.length === 0) {
          setError('No AOIs found. Please create one first.');
        } else if (selectedAoI === 'default-aoi' || !aoiList.find(a => a.id === selectedAoI)) {
          // If selected AOI doesn't exist, select the first available AOI
          setSelectedAoI(response.data[0].id);
        }
      } catch (err: any) {
        console.error('Failed to fetch AOIs:', err);
        setError(err.response?.data?.detail || 'Failed to fetch AOIs');
      }
    };

    fetchAoIs();
  }, []);

  // Fetch data when AOI changes
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedAoI) return;
      setLoading(true);
      try {
        const [tsResponse, violResponse] = await Promise.all([
          timeseries.getByAoI(selectedAoI),
          violations.getByAoI(selectedAoI),
        ]);

        console.log('TimeSeries Response:', tsResponse.data);
        console.log('Violations Response:', violResponse.data);

        // Extract legal boundary and no-go zone data
        const legalBoundary = (tsResponse.data?.legal_boundary || []).map((p: any) => ({
          ...p,
          timestamp: String(p.timestamp)
        }));
        const noGoZones = (tsResponse.data?.nogo_zones || []).map((p: any) => ({
          ...p,
          timestamp: String(p.timestamp)
        }));
        
        console.log('Legal Boundary:', legalBoundary);
        console.log('No-Go Zones:', noGoZones);
        
        // Calculate current stats from latest data
        const latestLegal = legalBoundary.length > 0 ? legalBoundary[legalBoundary.length - 1] : null;
        const latestNoGo = noGoZones.length > 0 ? noGoZones[noGoZones.length - 1] : null;
        
        // Fallback: Calculate stats from violations if time series is empty
        let legalAreaValue = latestLegal?.excavated_area_ha || 0;
        let noGoAreaValue = latestNoGo?.excavated_area_ha || 0;
        
        if (legalAreaValue === 0 && noGoAreaValue === 0 && violResponse.data.length > 0) {
          // Use violations data as fallback
          const maxViolationArea = Math.max(...violResponse.data.map(v => v.excavated_area_ha));
          noGoAreaValue = maxViolationArea;
          console.log('Using violations data for stats. Max No-Go area:', maxViolationArea);
        }
        
        console.log('Latest Legal:', latestLegal);
        console.log('Latest NoGo:', latestNoGo);
        console.log('Final Stats - Legal:', legalAreaValue, 'NoGo:', noGoAreaValue);
        
        setData(legalBoundary, noGoZones, {});
        setViolations(violResponse.data);
        setStats({ 
          legalArea: legalAreaValue, 
          noGoArea: noGoAreaValue, 
          violations: violResponse.data.length 
        });

        // Extract timestamps from legal boundary data
        if (legalBoundary && legalBoundary.length > 0) {
          const ts = legalBoundary.map((item: any) => item.timestamp);
          setTimestamps(ts);
          setAvailableTimestamps(ts);
          if (!selectedTimestamp && ts.length > 0) {
            setSelectedTimestamp(ts[ts.length - 1]);
          }
        }

        setError(null);
      } catch (err: any) {
        console.error('Failed to fetch data:', err);
        setError(err.response?.data?.detail || 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [selectedAoI]);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const [tsResponse, violResponse] = await Promise.all([
        timeseries.getByAoI(selectedAoI),
        violations.getByAoI(selectedAoI),
      ]);
      
      // Extract legal boundary and no-go zone data
      const legalBoundary = (tsResponse.data?.legal_boundary || []).map((p: any) => ({
        ...p,
        timestamp: String(p.timestamp)
      }));
      const noGoZones = (tsResponse.data?.nogo_zones || []).map((p: any) => ({
        ...p,
        timestamp: String(p.timestamp)
      }));
      
      // Calculate current stats from latest data
      const latestLegal = legalBoundary.length > 0 ? legalBoundary[legalBoundary.length - 1] : null;
      const latestNoGo = noGoZones.length > 0 ? noGoZones[noGoZones.length - 1] : null;
      
      // Fallback: Calculate stats from violations if time series is empty
      let legalAreaValue = latestLegal?.excavated_area_ha || 0;
      let noGoAreaValue = latestNoGo?.excavated_area_ha || 0;
      
      if (legalAreaValue === 0 && noGoAreaValue === 0 && violResponse.data.length > 0) {
        // Use violations data as fallback
        const maxViolationArea = Math.max(...violResponse.data.map(v => v.excavated_area_ha));
        noGoAreaValue = maxViolationArea;
      }
      
      setData(legalBoundary, noGoZones, {});
      setViolations(violResponse.data);
      setStats({ 
        legalArea: legalAreaValue, 
        noGoArea: noGoAreaValue, 
        violations: violResponse.data.length 
      });
      setLastRefresh(new Date());
      setError(null);
    } catch (err: any) {
      console.error('Refresh failed:', err);
      setError('Failed to refresh data');
    } finally {
      setLoading(false);
    }
  };

  const handleRunAnalysis = async () => {
    setAnalysisRunning(true);
    try {
      const response = await analysis.runAnalysis(selectedAoI);
      const jobId = response.data.job_id;

      let completed = false;
      let attempts = 0;
      const maxAttempts = 30;

      while (!completed && attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const statusResponse = await analysis.getAnalysisStatus(jobId);
        if (statusResponse.data.status === 'COMPLETED') {
          await handleRefresh();
          setError(null);
          completed = true;
        } else if (statusResponse.data.status === 'FAILED') {
          setError(`Analysis failed: ${statusResponse.data.error_message}`);
          completed = true;
        }
        attempts++;
      }

      if (!completed) {
        setError('Analysis took too long. Check status manually.');
      }
    } catch (err: any) {
      console.error('Failed to run analysis:', err);
      setError(err.response?.data?.detail || 'Failed to start analysis');
    } finally {
      setAnalysisRunning(false);
      setShowAnalysisModal(false);
    }
  };

  return (
    <div className="d-flex" style={{ height: '100vh', backgroundColor: '#f5f5f5' }}>
      {/* Sidebar */}
      <nav 
        className={`bg-light border-end border-gray-300 p-4 overflow-y-auto ${sidebarOpen ? 'd-block' : 'd-none'}`} 
        style={{ width: sidebarOpen ? '320px' : '0', transition: 'all 0.3s ease', minHeight: '100vh', boxShadow: '2px 0 8px rgba(0,0,0,0.1)' }}
      >
        <div className="mb-4 pb-3 border-bottom border-gray-300">
          <h5 className="text-dark mb-1">📍 Mining Monitor</h5>
          <small className="text-primary">Real-time Monitoring System</small>
        </div>

        <div>
          {/* Health Check */}
          <BackendHealthCheck />

          {/* AOI Selection */}
          <div className="card bg-white border-gray-300 mt-3">
            <div className="card-body p-3">
              <label className="form-label small text-primary mb-2">📌 Area of Interest</label>
              <select
                value={selectedAoI}
                onChange={(e) => setSelectedAoI(e.target.value)}
                className="form-select form-select-sm bg-white text-dark border-gray-300"
              >
                {aoiList.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Time Slider */}
          <div className="mt-3">
            <TimeSlider 
              timestamps={timestamps} 
              selectedTimestamp={selectedTimestamp}
              onTimestampChange={setSelectedTimestamp}
            />
          </div>

          {/* Violation Panel */}
          <div className="mt-3">
            <ViolationPanel aoiId={selectedAoI} />
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-top border-gray-300 mt-3">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="btn btn-outline-primary w-100 mb-2 d-flex align-items-center justify-content-center gap-2"
            >
              <RefreshCw size={18} />
              Refresh Data
            </button>
            <button
              onClick={() => setShowAnalysisModal(true)}
              disabled={analysisRunning}
              className="btn btn-outline-success w-100 d-flex align-items-center justify-content-center gap-2"
            >
              <TrendingUp size={18} />
              Run Analysis
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="flex-grow-1 d-flex flex-column" style={{ minWidth: '0' }}>
        {/* Header */}
        <header className="bg-white border-bottom border-gray-300 px-4 py-3 d-flex align-items-center justify-content-between shadow-sm">
          <button
            onClick={toggleSidebar}
            className="btn btn-outline-primary btn-sm"
            title="Toggle sidebar"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h5 className="mb-0 text-primary">
            {aoiList.find((a) => a.id === selectedAoI)?.name || 'Dashboard'}
          </h5>
          <div className="d-flex align-items-center gap-3">
            <small className="text-muted">
              🕐 {lastRefresh.toLocaleTimeString()}
            </small>
            
            {/* Drawing Tools Dropdown */}
            <div className="dropdown">
              <button className="btn btn-primary btn-sm dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                <Plus size={16} className="me-1" />
                Create
              </button>
              <ul className="dropdown-menu dropdown-menu-end">
                <li><Link to="/draw-aoi" className="dropdown-item"><span className="me-2">➕</span>New AOI</Link></li>
                <li><Link to="/geometries" className="dropdown-item"><span className="me-2">⚖️</span>Legal Boundary</Link></li>
                <li><Link to="/geometries" className="dropdown-item"><span className="me-2">🚫</span>No-Go Zone</Link></li>
              </ul>
            </div>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-grow-1 overflow-auto p-4">
          {error && (
            <div className="alert alert-danger alert-dismissible fade show mb-4" role="alert">
              <AlertCircle size={18} className="me-2" style={{ display: 'inline' }} />
              {error}
              <button type="button" className="btn-close" onClick={() => setError(null)}></button>
            </div>
          )}

          <div className="container-fluid">
            <div className="row g-4">
              {/* Stats Cards */}
              <div className="col-12">
                <StatsPanel 
                  legalAreaCurrent={stats.legalArea}
                  noGoAreaCurrent={stats.noGoArea}
                  violationCount={stats.violations}
                  dataPointCount={timestamps.length}
                />
              </div>

              {/* Analytics Card */}
              <div className="col-lg-8">
                <div className="card bg-white border-gray-300 h-100">
                  <div className="card-header bg-light border-gray-300 py-3">
                    <h5 className="card-title text-success mb-0">
                      <TrendingUp size={18} className="me-2" style={{ display: 'inline' }} />
                      Excavation Analytics
                    </h5>
                  </div>
                  <div className="card-body">
                    {loading ? (
                      <div className="d-flex align-items-center justify-content-center" style={{ height: '300px' }}>
                        <Loader className="text-primary spinner-border" />
                      </div>
                    ) : timestamps.length === 0 ? (
                      <div className="alert alert-info" role="alert">
                        <strong>No analysis data yet.</strong> Click the <strong>"Run Analysis"</strong> button in the sidebar to generate time series data from satellite imagery.
                      </div>
                    ) : (
                      <ExcavationChart />
                    )}
                  </div>
                </div>
              </div>

              {/* Violations Card */}
              <div className="col-lg-4">
                <div className="card bg-white border-gray-300 h-100">
                  <div className="card-header bg-light border-gray-300 py-3">
                    <h5 className="card-title text-danger mb-0">⚠️ Recent Violations</h5>
                  </div>
                  <div className="card-body">
                    <ViolationPanel aoiId={selectedAoI} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Analysis Modal */}
      {showAnalysisModal && (
        <div className="modal d-block" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content bg-white border-gray-300">
              <div className="modal-header border-gray-300">
                <h5 className="modal-title text-dark">🔍 Run Analysis</h5>
                <button 
                  type="button" 
                  className="btn-close" 
                  onClick={() => setShowAnalysisModal(false)}
                ></button>
              </div>
              <div className="modal-body text-dark">
                <p className="small">
                  This will process satellite data and update excavation detections and violations for the selected AOI.
                </p>
              </div>
              <div className="modal-footer border-gray-300">
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={() => setShowAnalysisModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleRunAnalysis}
                  disabled={analysisRunning}
                >
                  {analysisRunning ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2"></span>
                      Running...
                    </>
                  ) : (
                    <>
                      <CheckCircle size={16} className="me-2" style={{ display: 'inline' }} />
                      Start Analysis
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
