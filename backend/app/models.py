"""
Database models for excavation monitoring system.
Uses SQLAlchemy ORM with PostGIS spatial extensions.
"""

from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Boolean, Text
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from geoalchemy2 import Geometry
from datetime import datetime
import uuid

Base = declarative_base()


class AoI(Base):
    """Area of Interest polygon"""
    __tablename__ = "aoi"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, unique=True)
    description = Column(Text)
    geometry = Column(Geometry('POLYGON', srid=4326), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class MinerBoundary(Base):
    """Legal mine boundary polygon"""
    __tablename__ = "miner_boundaries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aoi_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    geometry = Column(Geometry('POLYGON', srid=4326), nullable=False)
    is_legal = Column(Boolean, default=True)  # True for legal, False for no-go zones
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExcavationTimeSeries(Base):
    """Time-series excavation data"""
    __tablename__ = "excavation_timeseries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aoi_id = Column(UUID(as_uuid=True), nullable=False)
    boundary_id = Column(UUID(as_uuid=True), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    excavated_area_ha = Column(Float, nullable=False)  # Raw area
    smoothed_area_ha = Column(Float)  # Smoothed area
    excavation_rate_ha_day = Column(Float)  # Rate of change
    anomaly_score = Column(Float)  # Aggregated anomaly score
    confidence = Column(Float)  # 0-1 confidence in detection
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ExcavationMask(Base):
    """Spatial excavation masks (raster/GeoJSON)"""
    __tablename__ = "excavation_masks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aoi_id = Column(UUID(as_uuid=True), nullable=False)
    timestamp = Column(DateTime, nullable=False)
    # Store GeoJSON representation of mask
    geojson = Column(JSONB)
    # Store raster path (S3 or local)
    raster_path = Column(String(512))
    # Store stats
    total_pixels = Column(Integer)
    excavated_pixels = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)


class ViolationEvent(Base):
    """Detected no-go zone violations"""
    __tablename__ = "violation_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aoi_id = Column(UUID(as_uuid=True), nullable=False)
    nogo_zone_id = Column(UUID(as_uuid=True), nullable=False)
    event_type = Column(String(50), nullable=False)  # VIOLATION_START, ESCALATION, VIOLATION_RESOLVED
    detection_date = Column(DateTime, nullable=False)
    excavated_area_ha = Column(Float)
    description = Column(Text)
    severity = Column(String(20))  # LOW, MEDIUM, HIGH, CRITICAL
    is_resolved = Column(Boolean, default=False)
    resolved_date = Column(DateTime)
    event_metadata = Column(JSONB)  # Additional context
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AnalysisConfig(Base):
    """Configuration for analysis runs"""
    __tablename__ = "analysis_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aoi_id = Column(UUID(as_uuid=True), nullable=False)
    name = Column(String(255), nullable=False)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=False)
    adaptive_threshold = Column(Float)  # Learned threshold
    threshold_method = Column(String(50))  # isolation_forest, statistical, hybrid
    cloud_mask_method = Column(String(50), default='scl')
    smoothing_window = Column(Integer, default=5)
    min_violation_area_ha = Column(Float, default=0.01)
    config_params = Column(JSONB)  # Store all parameters
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AlertSubscription(Base):
    """User subscriptions to alerts"""
    __tablename__ = "alert_subscriptions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    aoi_id = Column(UUID(as_uuid=True), nullable=False)
    user_email = Column(String(255), nullable=False)
    webhook_url = Column(String(512))  # For external notifications
    alert_types = Column(JSONB)  # List of event types to alert on
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AnalysisJob(Base):
    """Track long-running analysis jobs"""
    __tablename__ = "analysis_jobs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    config_id = Column(UUID(as_uuid=True), nullable=False)
    job_type = Column(String(50))  # sentinel2_ingest, threshold_learning, mask_generation
    status = Column(String(20), default='PENDING')  # PENDING, RUNNING, COMPLETED, FAILED
    progress_percent = Column(Float, default=0.0)
    result_metadata = Column(JSONB)
    error_message = Column(Text)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.utcnow)
