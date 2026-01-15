import React, { useEffect, useState } from 'react';
import { apiClient } from '../api/client';
import { AlertCircle, CheckCircle, Loader } from 'lucide-react';

export const BackendHealthCheck: React.FC = () => {
  const [status, setStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [message, setMessage] = useState('Checking backend connection...');
  const [apiUrl, setApiUrl] = useState('');

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const url = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';
        setApiUrl(url);
        
        console.log('Checking health at:', url + '/health');
        const response = await apiClient.get('/health');
        
        if (response.data.status === 'healthy') {
          setStatus('connected');
          setMessage('Backend is running ✓');
        } else {
          setStatus('error');
          setMessage('Backend returned unexpected status');
        }
      } catch (err: any) {
        setStatus('error');
        const errorMsg = err.response?.data?.detail || err.message || 'Cannot connect to backend';
        setMessage(errorMsg);
        console.error('Health check error:', err);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const bgClass = status === 'connected' ? 'bg-light text-success border border-success' :
                  status === 'error' ? 'bg-light text-danger border border-danger' :
                  'bg-light text-info border border-info';

  return (
    <div className={`card border-0 ${bgClass}`}>
      <div className="card-body d-flex align-items-start gap-3 p-3">
        <div className="flex-shrink-0 mt-1">
          {status === 'checking' && <Loader className="spinner-border spinner-border-sm" style={{display: 'inline'}} />}
          {status === 'connected' && <CheckCircle size={20} style={{display: 'inline'}} />}
          {status === 'error' && <AlertCircle size={20} style={{display: 'inline'}} />}
        </div>
        <div className="flex-1">
          <p className="card-title small fw-bold mb-1">{message}</p>
          <p className="small mb-1 opacity-75">API: {apiUrl}</p>
          {status === 'error' && (
            <p className="small opacity-75">
              ✓ Make sure backend is running: python run.py
              <br />
              ✓ Backend should be accessible at http://localhost:8000
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
