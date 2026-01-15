import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import DrawAOIPage from './pages/DrawAOI';
import DrawLegalBoundaryPage from './pages/DrawLegalBoundary';
import DrawNoGoZonePage from './pages/DrawNoGoZone';
import DrawGeometriesPage from './pages/DrawGeometries';
import './index.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/draw-aoi" element={<DrawAOIPage />} />
        <Route path="/draw-legal-boundary" element={<DrawLegalBoundaryPage />} />
        <Route path="/draw-nogo-zone" element={<DrawNoGoZonePage />} />
        <Route path="/geometries" element={<DrawGeometriesPage />} />
      </Routes>
    </Router>
  );
}

export default App;
