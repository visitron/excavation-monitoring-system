import React, { useEffect, useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';

interface TimeSliderProps {
  /** Available timestamps in ISO format */
  timestamps: string[];
  /** Currently selected timestamp */
  selectedTimestamp: string | null;
  /** Callback when timestamp is selected */
  onTimestampChange: (timestamp: string) => void;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * TimeSlider Component
 * 
 * Interactive temporal navigation for excavation detection layers.
 * Displays available satellite imagery timestamps and allows users to
 * navigate through time to see excavation evolution.
 */
export const TimeSlider: React.FC<TimeSliderProps> = ({
  timestamps,
  selectedTimestamp,
  onTimestampChange,
  isLoading = false,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayDate, setDisplayDate] = useState<string>('');

  // Initialize with selected timestamp
  useEffect(() => {
    if (selectedTimestamp && timestamps.includes(selectedTimestamp)) {
      const index = timestamps.indexOf(selectedTimestamp);
      setCurrentIndex(index);
      setDisplayDate(format(parseISO(selectedTimestamp), 'MMM dd, yyyy HH:mm'));
    }
  }, [selectedTimestamp, timestamps]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const newIndex = currentIndex - 1;
      setCurrentIndex(newIndex);
      onTimestampChange(timestamps[newIndex]);
    }
  };

  const handleNext = () => {
    if (currentIndex < timestamps.length - 1) {
      const newIndex = currentIndex + 1;
      setCurrentIndex(newIndex);
      onTimestampChange(timestamps[newIndex]);
    }
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(e.target.value, 10);
    setCurrentIndex(index);
    onTimestampChange(timestamps[index]);
  };

  const handleDateInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDisplayDate(value);
    
    // Try to find matching timestamp
    const parsed = parseISO(value);
    const foundTimestamp = timestamps.find(ts => {
      const tsDate = parseISO(ts);
      return Math.abs(tsDate.getTime() - parsed.getTime()) < 86400000; // Within 1 day
    });

    if (foundTimestamp) {
      const index = timestamps.indexOf(foundTimestamp);
      setCurrentIndex(index);
      onTimestampChange(foundTimestamp);
    }
  };

  if (timestamps.length === 0) {
    return (
      <div className="bg-white rounded shadow p-5">
        <div className="text-center py-5">
          <Calendar className="w-12 h-12 text-secondary mx-auto mb-2" style={{width: '48px', height: '48px'}} />
          <p className="text-secondary fw-medium">No imagery available</p>
          <p className="small text-secondary opacity-75">Load data to see available timestamps</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded shadow p-5">
      <div className="d-flex align-items-center justify-content-between mb-4">
        <h3 className="h5 fw-semibold text-dark mb-0">Temporal Navigation</h3>
        <span className="small text-secondary font-monospace">
          {currentIndex + 1} of {timestamps.length}
        </span>
      </div>

      {/* Date Display and Input */}
      <div className="d-flex align-items-center gap-2">
        <Calendar className="w-5 h-5 text-secondary" style={{width: '20px', height: '20px'}} />
        <input
          type="datetime-local"
          value={displayDate.replace(', ', 'T').replace(' ', 'T')}
          onChange={handleDateInput}
          disabled={isLoading}
          className="form-control form-control-sm"
        />
      </div>

      {/* Slider */}
      <div className="mt-2">
        <input
          type="range"
          min="0"
          max={timestamps.length - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          disabled={isLoading}
          className="form-range"
          style={{
            background: `linear-gradient(to right, #0d6efd 0%, #0d6efd ${(currentIndex / (timestamps.length - 1)) * 100}%, #e9ecef ${(currentIndex / (timestamps.length - 1)) * 100}%, #e9ecef 100%)`
          }}
        />
        <div className="d-flex justify-content-between small text-secondary px-1 mt-1">
          <span>{format(parseISO(timestamps[0]), 'MMM dd')}</span>
          <span>{format(parseISO(timestamps[timestamps.length - 1]), 'MMM dd')}</span>
        </div>
      </div>

      {/* Navigation Buttons */}
      <div className="d-flex gap-2 mt-3">
        <button
          onClick={handlePrevious}
          disabled={currentIndex === 0 || isLoading}
          className="btn btn-light flex-1 d-flex align-items-center justify-content-center gap-2"
          title="Previous timestamp"
        >
          <ChevronLeft className="w-4 h-4" style={{width: '16px', height: '16px'}} />
          <span className="small fw-medium">Previous</span>
        </button>
        <button
          onClick={handleNext}
          disabled={currentIndex === timestamps.length - 1 || isLoading}
          className="btn btn-primary flex-1 d-flex align-items-center justify-content-center gap-2"
          title="Next timestamp"
        >
          <span className="small fw-medium">Next</span>
          <ChevronRight className="w-4 h-4" style={{width: '16px', height: '16px'}} />
        </button>
      </div>

      {/* Quick Timeline Preview */}
      <div className="row row-cols-7 g-1 pt-3 border-top mt-3">
        {timestamps.slice(-7).map((ts, idx) => (
          <div key={ts} className="col">
            <button
              onClick={() => {
                const fullIndex = timestamps.length - 7 + idx;
                setCurrentIndex(fullIndex);
                onTimestampChange(timestamps[fullIndex]);
              }}
              disabled={isLoading}
              className={`btn btn-sm w-100 ${
                currentIndex === timestamps.length - 7 + idx
                  ? 'btn-primary fw-semibold'
                  : 'btn-light'
              }`}
              title={format(parseISO(ts), 'MMM dd')}
            >
              {format(parseISO(ts), 'd')}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
